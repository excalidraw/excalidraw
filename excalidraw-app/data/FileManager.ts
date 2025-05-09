import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { compressData } from "@excalidraw/excalidraw/data/encode";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import { t } from "@excalidraw/excalidraw/i18n";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
  InitializedExcalidrawImageElement,
} from "@excalidraw/element/types";
import type {
  BinaryFileData,
  BinaryFileMetadata,
  ExcalidrawImperativeAPI,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

type FileVersion = Required<BinaryFileData>["version"];

export class FileManager {
  /** files being fetched */
  private fetchingFiles = new Map<ExcalidrawImageElement["fileId"], true>();
  private erroredFiles_fetch = new Map<
    ExcalidrawImageElement["fileId"],
    true
  >();
  /** files being saved */
  private savingFiles = new Map<
    ExcalidrawImageElement["fileId"],
    FileVersion
  >();
  /* files already saved to persistent storage */
  private savedFiles = new Map<ExcalidrawImageElement["fileId"], FileVersion>();
  private erroredFiles_save = new Map<
    ExcalidrawImageElement["fileId"],
    FileVersion
  >();

  private _getFiles;
  private _saveFiles;

  constructor({
    getFiles,
    saveFiles,
  }: {
    getFiles: (fileIds: FileId[]) => Promise<{
      loadedFiles: BinaryFileData[];
      erroredFiles: Map<FileId, true>;
    }>;
    saveFiles: (data: { addedFiles: Map<FileId, BinaryFileData> }) => Promise<{
      savedFiles: Map<FileId, BinaryFileData>;
      erroredFiles: Map<FileId, BinaryFileData>;
    }>;
  }) {
    this._getFiles = getFiles;
    this._saveFiles = saveFiles;
  }

  /**
   * returns whether file is saved/errored, or being processed
   */
  isFileTracked = (id: FileId) => {
    return (
      this.savedFiles.has(id) ||
      this.savingFiles.has(id) ||
      this.fetchingFiles.has(id) ||
      this.erroredFiles_fetch.has(id) ||
      this.erroredFiles_save.has(id)
    );
  };

  isFileSavedOrBeingSaved = (file: BinaryFileData) => {
    const fileVersion = this.getFileVersion(file);
    return (
      this.savedFiles.get(file.id) === fileVersion ||
      this.savingFiles.get(file.id) === fileVersion
    );
  };

  getFileVersion = (file: BinaryFileData) => {
    return file.version ?? 1;
  };

  saveFiles = async ({
    elements,
    files,
  }: {
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles;
  }) => {
    const addedFiles: Map<FileId, BinaryFileData> = new Map();

    for (const element of elements) {
      const fileData =
        isInitializedImageElement(element) && files[element.fileId];

      if (
        fileData &&
        // NOTE if errored during save, won't retry due to this check
        !this.isFileSavedOrBeingSaved(fileData)
      ) {
        addedFiles.set(element.fileId, files[element.fileId]);
        this.savingFiles.set(element.fileId, this.getFileVersion(fileData));
      }
    }

    try {
      const { savedFiles, erroredFiles } = await this._saveFiles({
        addedFiles,
      });

      for (const [fileId, fileData] of savedFiles) {
        this.savedFiles.set(fileId, this.getFileVersion(fileData));
      }

      for (const [fileId, fileData] of erroredFiles) {
        this.erroredFiles_save.set(fileId, this.getFileVersion(fileData));
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

  getFiles = async (
    ids: FileId[],
  ): Promise<{
    loadedFiles: BinaryFileData[];
    erroredFiles: Map<FileId, true>;
  }> => {
    if (!ids.length) {
      return {
        loadedFiles: [],
        erroredFiles: new Map(),
      };
    }
    for (const id of ids) {
      this.fetchingFiles.set(id, true);
    }

    try {
      const { loadedFiles, erroredFiles } = await this._getFiles(ids);

      for (const file of loadedFiles) {
        this.savedFiles.set(file.id, this.getFileVersion(file));
      }
      for (const [fileId] of erroredFiles) {
        this.erroredFiles_fetch.set(fileId, true);
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
      this.savedFiles.has(element.fileId) &&
      element.status === "pending"
    );
  };

  reset() {
    this.fetchingFiles.clear();
    this.savingFiles.clear();
    this.savedFiles.clear();
    this.erroredFiles_fetch.clear();
    this.erroredFiles_save.clear();
  }
}

export const encodeFilesForUpload = async ({
  files,
  maxBytes,
  encryptionKey,
}: {
  files: Map<FileId, BinaryFileData>;
  maxBytes: number;
  encryptionKey: string;
}) => {
  const processedFiles: {
    id: FileId;
    buffer: Uint8Array;
  }[] = [];

  for (const [id, fileData] of files) {
    const buffer = new TextEncoder().encode(fileData.dataURL);

    const encodedFile = await compressData<BinaryFileMetadata>(buffer, {
      encryptionKey,
      metadata: {
        id,
        mimeType: fileData.mimeType,
        created: Date.now(),
        lastRetrieved: Date.now(),
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
      buffer: encodedFile,
    });
  }

  return processedFiles;
};

export const updateStaleImageStatuses = (params: {
  excalidrawAPI: ExcalidrawImperativeAPI;
  erroredFiles: Map<FileId, true>;
  elements: readonly ExcalidrawElement[];
}) => {
  if (!params.erroredFiles.size) {
    return;
  }
  params.excalidrawAPI.updateScene({
    elements: params.excalidrawAPI
      .getSceneElementsIncludingDeleted()
      .map((element) => {
        if (
          isInitializedImageElement(element) &&
          params.erroredFiles.has(element.fileId)
        ) {
          return newElementWith(element, {
            status: "error",
          });
        }
        return element;
      }),
    captureUpdate: CaptureUpdateAction.NEVER,
  });
};
