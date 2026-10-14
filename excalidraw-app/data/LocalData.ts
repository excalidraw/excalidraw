/**
 * This file deals with saving data state (appState, elements, images, ...)
 * locally to the browser.
 *
 * Notes:
 *
 * - DataState refers to full state of the app: appState, elements, images,
 *   though some state is saved separately (collab username, library) for one
 *   reason or another. We also save different data to different storage
 *   (localStorage, indexedDB).
 */

import { debounce } from "@excalidraw/common";
import { getNonDeletedElements } from "@excalidraw/element";
import {
  createStore,
  entries,
  del,
  getMany,
  set,
  setMany,
  get,
} from "idb-keyval";

import type { LibraryPersistedData } from "@excalidraw/excalidraw/data/library";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type {
  OrderedExcalidrawElement,
  FileId,
} from "@excalidraw/element/types";
import type { AppState, BinaryFileData } from "@excalidraw/excalidraw/types";
import type { MaybePromise } from "@excalidraw/common/utility-types";

import { appJotaiStore, atom } from "../app-jotai";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT, STORAGE_KEYS } from "../app_constants";

import { FileManager } from "./FileManager";
import { FileStatusStore } from "./fileStatusStore";
import { Locker } from "./Locker";
import { updateBrowserStateVersion } from "./tabSync";
import { importFromLocalStorage, withBrowserStorageLock } from "./localStorage";
import { LocalScene } from "./LocalScene";

import type { LocalSceneSnapshot } from "./LocalScene";

const filesStore = createStore("files-db", "files-store");

export const localStorageQuotaExceededAtom = atom(false);
export const localStorageSaveFailedAtom = atom(false);

type SaveOptions = {
  getSnapshot: () => LocalSceneSnapshot;
  onFilesSaved: () => void;
  onSync: (updates: {
    elements?: readonly OrderedExcalidrawElement[];
    appState?: Partial<AppState>;
  }) => void;
};

class LocalFileManager extends FileManager {
  clearObsoleteFiles = async (opts: { currentFileIds: FileId[] }) => {
    await entries(filesStore).then((entries) => {
      for (const [id, imageData] of entries as [FileId, BinaryFileData][]) {
        // if image is unused (not on canvas) & is older than 1 day, delete it
        // from storage. We check `lastRetrieved` we care about the last time
        // the image was used (loaded on canvas), not when it was initially
        // created.
        if (
          (!imageData.lastRetrieved ||
            Date.now() - imageData.lastRetrieved > 24 * 3600 * 1000) &&
          !opts.currentFileIds.includes(id as FileId)
        ) {
          del(id, filesStore);
        }
      }
    });
  };
}

const isQuotaExceededError = (error: any) => {
  return error instanceof DOMException && error.name === "QuotaExceededError";
};

type SavingLockTypes = "collaboration";

export class LocalData {
  private static scene = new LocalScene();
  private static generation = 0;
  private static replaceOnNextSave = false;
  private static scheduled = false;
  private static pending = new Set<Promise<void>>();

  static load = () => {
    this.generation++;
    this._save.cancel();
    this.scheduled = false;
    this.replaceOnNextSave = false;
    return withBrowserStorageLock(() =>
      this.scene.load(importFromLocalStorage()),
    ).catch((error) => {
      console.error(error);
      appJotaiStore.set(localStorageSaveFailedAtom, true);
      return this.scene.load(importFromLocalStorage());
    });
  };

  static getSaveSession = () => this.generation;

  static replaceScene = () => {
    this.generation++;
    this._save.cancel();
    this.scheduled = false;
    this.replaceOnNextSave = true;
  };

  private static _save = debounce((options: SaveOptions) => {
    this.scheduled = false;
    const generation = this.generation;
    const isCurrent = () =>
      generation === this.generation && !this.locker.isLocked();
    const operation = withBrowserStorageLock(() => {
      if (!isCurrent()) {
        return;
      }
      const snapshot = options.getSnapshot();
      if (snapshot.appState.isLoading) {
        return;
      }
      const stored = importFromLocalStorage();
      const result = this.scene.reconcile(
        snapshot,
        stored,
        this.replaceOnNextSave,
      );
      let persistedElements: readonly OrderedExcalidrawElement[] =
        result.persistedElements;
      let serializedElements = JSON.stringify(persistedElements);
      const serializedAppState = JSON.stringify(result.appState);
      if (
        serializedElements !==
          localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS) ||
        serializedAppState !==
          localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE)
      ) {
        try {
          localStorage.setItem(
            STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
            serializedElements,
          );
          localStorage.setItem(
            STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
            serializedAppState,
          );
        } catch (error) {
          const compactedElements = getNonDeletedElements(persistedElements);
          if (
            !isQuotaExceededError(error) ||
            compactedElements.length === persistedElements.length
          ) {
            throw error;
          }
          persistedElements = compactedElements;
          serializedElements = JSON.stringify(persistedElements);
          localStorage.setItem(
            STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
            serializedElements,
          );
          localStorage.setItem(
            STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
            serializedAppState,
          );
        }
        updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
      }
      this.scene.accept(persistedElements, result.appState);
      this.replaceOnNextSave = false;
      appJotaiStore.set(localStorageQuotaExceededAtom, false);
      appJotaiStore.set(localStorageSaveFailedAtom, false);
      if (Object.keys(result.updates).length) {
        options.onSync(result.updates);
      }
      return snapshot;
    })
      .then(async (snapshot) => {
        if (!snapshot || !isCurrent()) {
          return;
        }
        await this.fileStorage.saveFiles(snapshot);
        if (isCurrent()) {
          options.onFilesSaved();
        }
      })
      .catch((error) => {
        console.error(error);
        appJotaiStore.set(
          localStorageQuotaExceededAtom,
          isQuotaExceededError(error),
        );
        appJotaiStore.set(
          localStorageSaveFailedAtom,
          !isQuotaExceededError(error),
        );
      });
    this.pending.add(operation);
    void operation.finally(() => this.pending.delete(operation));
  }, SAVE_TO_LOCAL_STORAGE_TIMEOUT);

  /** Saves DataState, including files. Bails if saving is paused */
  static save = (options: SaveOptions) => {
    // we need to make the `isSavePaused` check synchronously (undebounced)
    if (!this.isSavePaused()) {
      this.scheduled = true;
      this._save(options);
    }
  };

  static flushSave = () => {
    this._save.flush();
    return Promise.all([...this.pending]);
  };

  static hasUnsavedChanges = () =>
    this.scheduled ||
    this.pending.size > 0 ||
    appJotaiStore.get(localStorageQuotaExceededAtom) ||
    appJotaiStore.get(localStorageSaveFailedAtom);

  private static locker = new Locker<SavingLockTypes>();

  static pauseSave = (lockType: SavingLockTypes) => {
    this.locker.lock(lockType);
    this.generation++;
    this._save.cancel();
    this.scheduled = false;
  };

  static resumeSave = (lockType: SavingLockTypes) => {
    this.locker.unlock(lockType);
  };

  static isSavePaused = () => {
    return document.hidden || this.locker.isLocked();
  };

  // ---------------------------------------------------------------------------

  static fileStorage = new LocalFileManager({
    onFileStatusChange: FileStatusStore.updateStatuses.bind(FileStatusStore),
    getFiles(ids) {
      return getMany(ids, filesStore).then(
        async (filesData: (BinaryFileData | undefined)[]) => {
          const loadedFiles: BinaryFileData[] = [];
          const erroredFiles = new Map<FileId, true>();

          const filesToSave: [FileId, BinaryFileData][] = [];

          filesData.forEach((data, index) => {
            const id = ids[index];
            if (data) {
              const _data: BinaryFileData = {
                ...data,
                lastRetrieved: Date.now(),
              };
              filesToSave.push([id, _data]);
              loadedFiles.push(_data);
            } else {
              erroredFiles.set(id, true);
            }
          });

          try {
            // save loaded files back to storage with updated `lastRetrieved`
            await setMany(filesToSave, filesStore);
          } catch (error) {
            console.warn(error);
          }

          return { loadedFiles, erroredFiles };
        },
      );
    },
    async saveFiles({ addedFiles }) {
      const savedFiles = new Map<FileId, BinaryFileData>();
      const erroredFiles = new Map<FileId, BinaryFileData>();

      await Promise.all(
        [...addedFiles].map(async ([id, fileData]) => {
          try {
            await set(id, fileData, filesStore);
            savedFiles.set(id, fileData);
          } catch (error: any) {
            console.error(error);
            erroredFiles.set(id, fileData);
          }
        }),
      );

      if (savedFiles.size) {
        updateBrowserStateVersion(STORAGE_KEYS.VERSION_FILES);
      }

      return { savedFiles, erroredFiles };
    },
  });
}
export class LibraryIndexedDBAdapter {
  /** IndexedDB database and store name */
  private static idb_name = STORAGE_KEYS.IDB_LIBRARY;
  /** library data store key */
  private static key = "libraryData";

  private static store = createStore(
    `${LibraryIndexedDBAdapter.idb_name}-db`,
    `${LibraryIndexedDBAdapter.idb_name}-store`,
  );

  static async load() {
    const IDBData = await get<LibraryPersistedData>(
      LibraryIndexedDBAdapter.key,
      LibraryIndexedDBAdapter.store,
    );

    return IDBData || null;
  }

  static save(data: LibraryPersistedData): MaybePromise<void> {
    return set(
      LibraryIndexedDBAdapter.key,
      data,
      LibraryIndexedDBAdapter.store,
    );
  }
}

/** LS Adapter used only for migrating LS library data
 * to indexedDB */
export class LibraryLocalStorageMigrationAdapter {
  static load() {
    const LSData = localStorage.getItem(
      STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY,
    );
    if (LSData != null) {
      const libraryItems: ImportedDataState["libraryItems"] =
        JSON.parse(LSData);
      if (libraryItems) {
        return { libraryItems };
      }
    }
    return null;
  }
  static clear() {
    localStorage.removeItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY);
  }
}
