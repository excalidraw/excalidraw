import type { SyncableExcalidrawElement } from ".";
import type {
  ExcalidrawElement,
  FileId,
} from "../../packages/excalidraw/element/types";
import type { AppState, BinaryFileData } from "../../packages/excalidraw/types";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

export interface StorageBackend {
  isSaved: (portal: Portal, elements: readonly ExcalidrawElement[]) => boolean;
  saveToStorageBackend: (
    portal: Portal,
    elements: readonly SyncableExcalidrawElement[],
    appState: AppState,
  ) => Promise<null | SyncableExcalidrawElement[]>;
  loadFromStorageBackend: (
    roomId: string,
    roomKey: string,
    socket: Socket | null,
  ) => Promise<readonly SyncableExcalidrawElement[] | null>;
  saveFilesToStorageBackend: ({
    prefix,
    files,
  }: {
    prefix: string;
    files: {
      id: FileId;
      buffer: Uint8Array;
    }[];
  }) => Promise<{
    savedFiles: Map<FileId, true>;
    erroredFiles: Map<FileId, true>;
  }>;
  loadFilesFromStorageBackend: (
    prefix: string,
    decryptionKey: string,
    filesIds: readonly FileId[],
  ) => Promise<{
    loadedFiles: BinaryFileData[];
    erroredFiles: Map<FileId, true>;
  }>;
}

export interface StoredScene {
  sceneVersion: number;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}
