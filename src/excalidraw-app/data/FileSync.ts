import { isInitializedImageElement } from "../../element/typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ImageId,
  InitializedExcalidrawImageElement,
} from "../../element/types";
import { AppState, BinaryFileData, DataURL } from "../../types";

export class FileSync {
  /** files being fetched */
  private fetchingFiles = new Map<ExcalidrawImageElement["imageId"], true>();
  /** files being saved */
  private savingFiles = new Map<ExcalidrawImageElement["imageId"], true>();
  /* files already saved to persistent storage */
  private savedFiles = new Map<ExcalidrawImageElement["imageId"], true>();

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

  /**
   * returns whether file is already saved or being processed
   */
  isFileHandled = (id: ImageId) => {
    return (
      this.savedFiles.has(id) ||
      this.fetchingFiles.has(id) ||
      this.savingFiles.has(id)
    );
  };

  isFileSaved = (id: ImageId) => {
    return this.savedFiles.has(id);
  };

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
        !this.isFileHandled(element.imageId)
      ) {
        addedFiles.set(
          element.imageId,
          appState.files[element.imageId].dataURL,
        );
        this.savingFiles.set(element.imageId, true);
      }
    }

    try {
      const { savedFiles, erroredFiles } = await this._saveFiles({
        addedFiles,
      });

      for (const [fileId] of savedFiles) {
        this.savedFiles.set(fileId, true);
      }

      return {
        savedFiles,
        erroredFiles,
      };
    } finally {
      for (const [fileId] of addedFiles) {
        this.savingFiles.delete(fileId);
      }
    }
  };

  getFiles = async (ids: ImageId[]) => {
    if (!ids.length) {
      return {
        loadedFiles: [],
        erroredFiles: [],
      };
    }
    for (const id of ids) {
      this.fetchingFiles.set(id, true);
    }

    try {
      const { loadedFiles, erroredFiles } = await this._getFiles(ids);

      for (const file of loadedFiles) {
        this.savedFiles.set(file.id, true);
      }

      return { loadedFiles, erroredFiles };
    } finally {
      for (const id of ids) {
        this.fetchingFiles.delete(id);
      }
    }
  };

  /**
   * helper to determine if image element status needs updating
   */
  shouldUpdateImageElementStatus = (
    element: ExcalidrawElement,
  ): element is InitializedExcalidrawImageElement => {
    return (
      isInitializedImageElement(element) &&
      this.isFileSaved(element.imageId) &&
      element.status === "pending"
    );
  };

  reset() {
    this.fetchingFiles.clear();
    this.savingFiles.clear();
    this.savedFiles.clear();
  }
}
