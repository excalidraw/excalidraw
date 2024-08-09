// Inspired and partly copied from https://gitlab.com/kiliandeca/excalidraw-fork
// MIT, Kilian Decaderincourt

import type { SyncableExcalidrawElement } from ".";
import { getSyncableElements } from ".";
import { MIME_TYPES } from "../../packages/excalidraw/constants";
import { decompressData } from "../../packages/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
  IV_LENGTH_BYTES,
} from "../../packages/excalidraw/data/encryption";
import { restoreElements } from "../../packages/excalidraw/data/restore";
import { getSceneVersion } from "../../packages/excalidraw/element";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "../../packages/excalidraw/types";
import type Portal from "../collab/Portal";
import { reconcileElements } from "../../packages/excalidraw";
import type { StoredScene } from "./StorageBackend";
import type { Socket } from "socket.io-client";
import type { RemoteExcalidrawElement } from "../../packages/excalidraw/data/reconcile";

const HTTP_STORAGE_BACKEND_URL = import.meta.env
  .VITE_APP_HTTP_STORAGE_BACKEND_URL;
const SCENE_VERSION_LENGTH_BYTES = 4;

// There is a lot of intentional duplication with the firebase file
// to prevent modifying upstream files and ease futur maintenance of this fork

const httpStorageSceneVersionCache = new WeakMap<Socket, number>();

export const isSavedToHttpStorage = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return httpStorageSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveToHttpStorage = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // if no room exists, consider the room saved because there's nothing we can
    // do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToHttpStorage(portal, elements)
  ) {
    return null;
  }

  const sceneVersion = getSceneVersion(elements);
  const getResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
  );

  if (!getResponse.ok && getResponse.status !== 404) {
    return null;
  }

  if (getResponse.status === 404) {
    const result: boolean = await saveElementsToBackend(
      roomKey,
      roomId,
      [...elements],
      sceneVersion,
    );
    if (result) {
      return null;
    }
    return null;
  }

  // If room already exist, we compare scene versions to check
  // if we're up to date before saving our scene
  const buffer = await getResponse.arrayBuffer();
  const sceneVersionFromRequest = parseSceneVersionFromRequest(buffer);
  if (sceneVersionFromRequest >= sceneVersion) {
    return null;
  }

  const existingElements = await getElementsFromBuffer(buffer, roomKey);
  const reconciledElements = getSyncableElements(
    reconcileElements(
      elements,
      existingElements as unknown as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
      appState,
    ),
  );

  const result: boolean = await saveElementsToBackend(
    roomKey,
    roomId,
    reconciledElements,
    sceneVersion,
  );

  if (result) {
    httpStorageSceneVersionCache.set(socket, sceneVersion);
    return reconciledElements;
  }
  return null;
};

export const loadFromHttpStorage = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const HTTP_STORAGE_BACKEND_URL = import.meta.env
    .VITE_APP_HTTP_STORAGE_BACKEND_URL;
  const getResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
  );

  const buffer = await getResponse.arrayBuffer();
  const elements = await getElementsFromBuffer(buffer, roomKey);

  if (socket) {
    httpStorageSceneVersionCache.set(socket, getSceneVersion(elements));
  }

  return elements;
};

const getElementsFromBuffer = async (
  buffer: ArrayBuffer,
  key: string,
): Promise<readonly SyncableExcalidrawElement[]> => {
  // Buffer should contain both the IV (fixed length) and encrypted data
  const sceneVersion = parseSceneVersionFromRequest(buffer);
  const iv = new Uint8Array(
    buffer.slice(
      SCENE_VERSION_LENGTH_BYTES,
      IV_LENGTH_BYTES + SCENE_VERSION_LENGTH_BYTES,
    ),
  );
  const encrypted = buffer.slice(
    IV_LENGTH_BYTES + SCENE_VERSION_LENGTH_BYTES,
    buffer.byteLength,
  );

  return getSyncableElements(
    restoreElements(
      await decryptElements({ sceneVersion, ciphertext: encrypted, iv }, key),
      null,
    ),
  );
};

export const saveFilesToHttpStorage = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const erroredFiles = new Map<FileId, true>();
  const savedFiles = new Map<FileId, true>();

  const HTTP_STORAGE_BACKEND_URL = import.meta.env
    .VITE_APP_HTTP_STORAGE_BACKEND_URL;

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const payloadBlob = new Blob([buffer]);
        const payload = await new Response(payloadBlob).arrayBuffer();
        await fetch(`${HTTP_STORAGE_BACKEND_URL}/files/${id}`, {
          method: "PUT",
          body: payload,
        });
        savedFiles.set(id, true);
      } catch (error: any) {
        erroredFiles.set(id, true);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const loadFilesFromHttpStorage = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  //////////////
  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const HTTP_STORAGE_BACKEND_URL = import.meta.env
          .VITE_APP_HTTP_STORAGE_BACKEND_URL;
        const response = await fetch(`${HTTP_STORAGE_BACKEND_URL}/files/${id}`);
        if (response.status < 400) {
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
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );
  //////

  return { loadedFiles, erroredFiles };
};

const saveElementsToBackend = async (
  roomKey: string,
  roomId: string,
  elements: SyncableExcalidrawElement[],
  sceneVersion: number,
) => {
  const { ciphertext, iv } = await encryptElements(roomKey, elements);

  // Concatenate Scene Version, IV with encrypted data (IV does not have to be secret).
  const numberBuffer = new ArrayBuffer(4);
  const numberView = new DataView(numberBuffer);
  numberView.setUint32(0, sceneVersion, false);
  const sceneVersionBuffer = numberView.buffer;
  const payloadBlob = await new Response(
    new Blob([sceneVersionBuffer, iv.buffer, ciphertext]),
  ).arrayBuffer();
  const putResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
    {
      method: "PUT",
      body: payloadBlob,
    },
  );

  return putResponse.ok;
};

const parseSceneVersionFromRequest = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer);
  return view.getUint32(0, false);
};

const decryptElements = async (
  data: StoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext;
  const iv = data.iv;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
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
