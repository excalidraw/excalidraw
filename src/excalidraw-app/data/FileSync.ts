import { isInitializedImageElement } from "../../element/typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ImageId,
} from "../../element/types";
import { AppState, BinaryFileData, DataURL } from "../../types";

export class FileSync {
  /** files marked for uploading or fetching, and thus neither operation should
   *  be performed on them until finished */
  pendingFiles = new Map<ExcalidrawImageElement["imageId"], true>();
  /* files already saved to the server (either by this client or remote) */
  savedFiles = new Map<ExcalidrawImageElement["imageId"], true>();

  private _getFiles;
  private _saveFiles;

  constructor({
    getFiles,
    saveFiles,
  }: {
    getFiles: (
      imageIds: ImageId[],
    ) => Promise<{
      loadedFiles: BinaryFileData[];
      erroredFiles: ImageId[];
    }>;
    saveFiles: (data: {
      addedFiles: Map<ImageId, DataURL>;
    }) => Promise<{
      savedFiles: Map<ImageId, true>;
      erroredFiles: Map<ImageId, true>;
    }>;
  }) {
    this._getFiles = getFiles;
    this._saveFiles = saveFiles;
  }

  saveFiles = async ({
    elements,
    appState,
  }: {
    elements: readonly ExcalidrawElement[];
    appState: Pick<AppState, "files">;
  }) => {
    const addedFiles: Map<ImageId, DataURL> = new Map();

    for (const element of elements) {
      if (
        isInitializedImageElement(element) &&
        appState.files[element.imageId] &&
        !this.pendingFiles.has(element.imageId) &&
        !this.savedFiles.has(element.imageId)
      ) {
        addedFiles.set(
          element.imageId,
          appState.files[element.imageId].dataURL,
        );
        this.pendingFiles.set(element.imageId, true);
      }
    }

    try {
      const { savedFiles, erroredFiles } = await this._saveFiles({
        addedFiles,
      });

      for (const [fileId] of savedFiles) {
        this.savedFiles.set(fileId, true);
      }

      return { savedFiles, erroredFiles };
    } finally {
      for (const [fileId] of addedFiles) {
        this.pendingFiles.delete(fileId);
      }
    }
  };

  /**
   * returns whether file is already saved or being processed
   */
  isFileHandled = (id: ImageId) => {
    return this.pendingFiles.has(id) || this.savedFiles.has(id);
  };

  getFiles = async (ids: ImageId[]) => {
    if (!ids.length) {
      return {
        loadedFiles: [],
        erroredFiles: [],
      };
    }
    for (const id of ids) {
      this.pendingFiles.set(id, true);
    }

    try {
      const { loadedFiles, erroredFiles } = await this._getFiles(ids);

      for (const file of loadedFiles) {
        this.savedFiles.set(file.id, true);
      }

      return { loadedFiles, erroredFiles };
    } finally {
      for (const id of ids) {
        this.pendingFiles.delete(id);
      }
    }
  };

  destroy() {
    this.pendingFiles.clear();
    this.savedFiles.clear();
  }
}
