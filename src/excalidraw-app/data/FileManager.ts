import { getDataURLMimeType } from "../../data/blob";
import { compressData } from "../../data/encode";
import { isInitializedImageElement } from "../../element/typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
  InitializedExcalidrawImageElement,
} from "../../element/types";
import { t } from "../../i18n";
import {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "../../types";

export class FileManager {
  /** files being fetched */
  private fetchingFiles = new Map<ExcalidrawImageElement["fileId"], true>();
  /** files being saved */
  private savingFiles = new Map<ExcalidrawImageElement["fileId"], true>();
  /* files already saved to persistent storage */
  private savedFiles = new Map<ExcalidrawImageElement["fileId"], true>();

  private _getFiles;
  private _saveFiles;

  constructor({
    getFiles,
    saveFiles,
  }: {
    getFiles: (
      fileIds: FileId[],
    ) => Promise<{
      loadedFiles: BinaryFileData[];
      erroredFiles: FileId[];
    }>;
    saveFiles: (data: {
      addedFiles: Map<FileId, DataURL>;
    }) => Promise<{
      savedFiles: Map<FileId, true>;
      erroredFiles: Map<FileId, true>;
    }>;
  }) {
    this._getFiles = getFiles;
    this._saveFiles = saveFiles;
  }

  /**
   * returns whether file is already saved or being processed
   */
  isFileHandled = (id: FileId) => {
    return (
      this.savedFiles.has(id) ||
      this.fetchingFiles.has(id) ||
      this.savingFiles.has(id)
    );
  };

  isFileSaved = (id: FileId) => {
    return this.savedFiles.has(id);
  };

  saveFiles = async ({
    elements,
    appState,
  }: {
    elements: readonly ExcalidrawElement[];
    appState: Pick<AppState, "files">;
  }) => {
    const addedFiles: Map<FileId, DataURL> = new Map();

    for (const element of elements) {
      if (
        isInitializedImageElement(element) &&
        appState.files[element.fileId] &&
        !this.isFileHandled(element.fileId)
      ) {
        addedFiles.set(element.fileId, appState.files[element.fileId].dataURL);
        this.savingFiles.set(element.fileId, true);
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

  getFiles = async (ids: FileId[]) => {
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

  /** a file element prevents unload only if it's being saved regardless of
   *  its `status`. This ensures that elements who for any reason haven't
   *  beed set to `saved` status don't prevent unload in future sessions.
   *  Technically we should prevent unload when the origin client haven't
   *  yet saved the `status` update to storage, but that should be taken care
   *  of during regular beforeUnload unsaved files check.
   */
  shouldPreventUnload = (elements: readonly ExcalidrawElement[]) => {
    return elements.some((element) => {
      return (
        isInitializedImageElement(element) &&
        !element.isDeleted &&
        this.savingFiles.has(element.fileId)
      );
    });
  };

  /**
   * helper to determine if image element status needs updating
   */
  shouldUpdateImageElementStatus = (
    element: ExcalidrawElement,
  ): element is InitializedExcalidrawImageElement => {
    return (
      isInitializedImageElement(element) &&
      this.isFileSaved(element.fileId) &&
      element.status === "pending"
    );
  };

  reset() {
    this.fetchingFiles.clear();
    this.savingFiles.clear();
    this.savedFiles.clear();
  }
}

export const encodeFilesForUpload = async <M extends readonly string[]>({
  files,
  maxBytes,
  encryptionKey,
  allowedMimeTypes,
}: {
  files: Map<FileId, DataURL>;
  maxBytes: number;
  encryptionKey: string;
  allowedMimeTypes: M;
}) => {
  const processedFiles: {
    id: FileId;
    mimeType: M[number];
    buffer: Uint8Array;
  }[] = [];

  for (const [id, dataURL] of files) {
    const mimeType = getDataURLMimeType(dataURL);

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(t("errors.unsupportedFileType"));
    }

    const buffer = new TextEncoder().encode(dataURL);

    const encodedFile = await compressData<BinaryFileMetadata>(buffer, {
      encryptionKey,
      metadata: {
        id,
        type: mimeType.includes("image/") ? "image" : "other",
        created: Date.now(),
      },
    });

    if (buffer.byteLength > maxBytes) {
      throw new Error(
        t("errors.fileTooBig", {
          maxSize: `${Math.trunc(maxBytes / 1024 / 1024)}MB`,
        }),
      );
    }

    processedFiles.push({
      id,
      mimeType,
      buffer: encodedFile,
    });
  }

  return processedFiles;
};
