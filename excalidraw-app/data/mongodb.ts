import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

// private
// -----------------------------------------------------------------------------

const MONGODB_BACKEND_URL =
  import.meta.env.VITE_APP_MONGODB_BACKEND_URL || "http://localhost:3003";

// Helper functions for base64 conversion
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// -----------------------------------------------------------------------------

type MongoDBStoredScene = {
  roomId: string;
  data: {
    iv: string; // base64
    ciphertext: string; // base64
  };
  sceneVersion: number;
  updatedAt: string;
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: { iv: string; ciphertext: string },
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = base64ToArrayBuffer(data.ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(data.iv));

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

class MongoDBSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return MongoDBSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    MongoDBSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSavedToMongoDB = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return MongoDBSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToMongoDB = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const response = await fetch(
          `${MONGODB_BACKEND_URL}/api/files/${prefix}/${id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
            },
            body: new Uint8Array(buffer.buffer),
          },
        );

        if (response.ok) {
          savedFiles.push(id);
        } else {
          erroredFiles.push(id);
          console.error(
            `Failed to save file ${id}: ${response.status} ${response.statusText}`,
          );
        }
      } catch (error: any) {
        erroredFiles.push(id);
        console.error(`Error saving file ${id}:`, error);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createMongoDBSceneDocument = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
  displayName?: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  const document: {
    iv: string;
    ciphertext: string;
    sceneVersion: number;
    displayName?: string;
  } = {
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    ciphertext: arrayBufferToBase64(ciphertext),
    sceneVersion,
  };
  
  if (displayName) {
    document.displayName = displayName;
  }
  
  return document;
};

export const saveToMongoDB = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
  displayName?: string,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToMongoDB(portal, elements)
  ) {
    return null;
  }

  try {
    // Get current scene from MongoDB
    const getResponse = await fetch(
      `${MONGODB_BACKEND_URL}/api/rooms/${roomId}`,
    );

    let reconciledElements: SyncableExcalidrawElement[];

    if (getResponse.ok) {
      // Room exists, reconcile with existing data
      const existingData: MongoDBStoredScene = await getResponse.json();
      const prevStoredElements = getSyncableElements(
        restoreElements(
          await decryptElements(existingData.data, roomKey),
          null,
        ),
      );

      reconciledElements = getSyncableElements(
        reconcileElements(
          elements,
          prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
          appState,
        ),
      );
    } else if (getResponse.status === 404) {
      // Room doesn't exist yet, use current elements
      reconciledElements = elements as SyncableExcalidrawElement[];
    } else {
      throw new Error(
        `Failed to fetch room: ${getResponse.status} ${getResponse.statusText}`,
      );
    }

    // Save reconciled elements
    const sceneDocument = await createMongoDBSceneDocument(
      reconciledElements,
      roomKey,
      displayName,
    );

    const saveResponse = await fetch(
      `${MONGODB_BACKEND_URL}/api/rooms/${roomId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sceneDocument),
      },
    );

    if (!saveResponse.ok) {
      throw new Error(
        `Failed to save room: ${saveResponse.status} ${saveResponse.statusText}`,
      );
    }

    MongoDBSceneVersionCache.set(socket, reconciledElements);

    return toBrandedType<RemoteExcalidrawElement[]>(reconciledElements);
  } catch (error) {
    console.error("Error saving to MongoDB:", error);
    return null;
  }
};

export const loadFromMongoDB = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  try {
    const response = await fetch(`${MONGODB_BACKEND_URL}/api/rooms/${roomId}`);

    if (response.status === 404) {
      // Room doesn't exist yet
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Failed to load room: ${response.status} ${response.statusText}`,
      );
    }

    const storedScene: MongoDBStoredScene = await response.json();
    const elements = getSyncableElements(
      restoreElements(
        await decryptElements(storedScene.data, roomKey),
        null,
        {
          deleteInvisibleElements: true,
        },
      ),
    );

    if (socket) {
      MongoDBSceneVersionCache.set(socket, elements);
    }

    return elements;
  } catch (error) {
    console.error("Error loading from MongoDB:", error);
    return null;
  }
};

export const loadFilesFromMongoDB = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const url = `${MONGODB_BACKEND_URL}/api/files/${prefix}/${id}`;
        const response = await fetch(url);

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(`Error loading file ${id}:`, error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};

// Keep compatibility with Firebase naming for easier migration
export const isSavedToFirebase = isSavedToMongoDB;
export const saveFilesToFirebase = saveFilesToMongoDB;
export const saveToFirebase = (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
  displayName?: string,
) => saveToMongoDB(portal, elements, appState, displayName);
export const loadFromFirebase = loadFromMongoDB;
export const loadFilesFromFirebase = loadFilesFromMongoDB;
