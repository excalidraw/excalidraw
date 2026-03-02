import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import type { SyncableExcalidrawElement } from ".";
import type { AppState, BinaryFileData } from "../../packages/excalidraw/types";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

export interface StorageBackend {
  isSaved: (portal: Portal, elements: readonly ExcalidrawElement[]) => boolean;
  saveToStorageBackend: (
    portal: Portal,
    elements: readonly SyncableExcalidrawElement[],
    appState: AppState,
  ) => Promise<false | readonly SyncableExcalidrawElement[] | null>;
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
    savedFiles: FileId[];
    erroredFiles: FileId[];
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
