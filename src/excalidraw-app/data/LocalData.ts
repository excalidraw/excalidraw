/**
 * This file deals with saving data state (appState, elements, images, ...)
 * locally to the browser.
 *
 * Notes:
 *
 * - DataState refers to full state of the app: appState, elements, images,
 *   though some state is saved separately (collab username, library) for one
 *   reason or another. We also save different data to different sotrage
 *   (localStorage, indexedDB).
 */

import { createStore, keys, del, getMany, set } from "idb-keyval";
import { clearAppStateForLocalStorage } from "../../appState";
import { clearElementsForLocalStorage } from "../../element";
import { ExcalidrawElement, FileId } from "../../element/types";
import { AppState, BinaryFileData, BinaryFiles } from "../../types";
import { debounce } from "../../utils";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT, STORAGE_KEYS } from "../app_constants";
import { FileManager } from "./FileManager";
import { Locker } from "./Locker";
import { updateBrowserStateVersion } from "./tabSync";

const filesStore = createStore("files-db", "files-store");

class LocalFileManager extends FileManager {
  clearObsoleteFiles = async (opts: { currentFileIds: FileId[] }) => {
    const allIds = await keys(filesStore);
    for (const id of allIds) {
      if (!opts.currentFileIds.includes(id as FileId)) {
        del(id, filesStore);
      }
    }
  };
}

const saveDataStateToLocalStorage = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(clearElementsForLocalStorage(elements)),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(clearAppStateForLocalStorage(appState)),
    );
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

type SavingLockTypes = "collaboration";

export class LocalData {
  private static _save = debounce(
    async (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
      onFilesSaved: () => void,
    ) => {
      saveDataStateToLocalStorage(elements, appState);

      await this.fileStorage.saveFiles({
        elements,
        files,
      });
      onFilesSaved();
    },
    SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  );

  /** Saves DataState, including files. Bails if saving is paused */
  static save = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    onFilesSaved: () => void,
  ) => {
    // we need to make the `isSavePaused` check synchronously (undebounced)
    if (!this.isSavePaused()) {
      this._save(elements, appState, files, onFilesSaved);
    }
  };

  static flushSave = () => {
    this._save.flush();
  };

  private static locker = new Locker<SavingLockTypes>();

  static pauseSave = (lockType: SavingLockTypes) => {
    this.locker.lock(lockType);
  };

  static resumeSave = (lockType: SavingLockTypes) => {
    this.locker.unlock(lockType);
  };

  static isSavePaused = () => {
    return this.locker.isLocked();
  };

  // ---------------------------------------------------------------------------

  static fileStorage = new LocalFileManager({
    getFiles(ids) {
      return getMany(ids, filesStore).then(
        (filesData: (BinaryFileData | undefined)[]) => {
          const loadedFiles: BinaryFileData[] = [];
          const erroredFiles = new Map<FileId, true>();
          filesData.forEach((data, index) => {
            const id = ids[index];
            if (data) {
              loadedFiles.push(data);
            } else {
              erroredFiles.set(id, true);
            }
          });

          return { loadedFiles, erroredFiles };
        },
      );
    },
    async saveFiles({ addedFiles }) {
      const savedFiles = new Map<FileId, true>();
      const erroredFiles = new Map<FileId, true>();

      // before we use `storage` event synchronization, let's update the flag
      // optimistically. Hopefully nothing fails, and an IDB read executed
      // before an IDB write finishes will read the latest value.
      updateBrowserStateVersion(STORAGE_KEYS.VERSION_FILES);

      await Promise.all(
        [...addedFiles].map(async ([id, fileData]) => {
          try {
            await set(id, fileData, filesStore);
            savedFiles.set(id, true);
          } catch (error: any) {
            console.error(error);
            erroredFiles.set(id, true);
          }
        }),
      );

      return { savedFiles, erroredFiles };
    },
  });
}
