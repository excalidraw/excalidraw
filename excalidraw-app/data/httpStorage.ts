// Inspired and partly copied from https://gitlab.com/kiliandeca/excalidraw-fork
// MIT, Kilian Decaderincourt

import { MIME_TYPES } from "@excalidraw/common";

import { getSceneVersion } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { decompressData } from "../../packages/excalidraw/data/encode";

import {
  encryptData,
  decryptData,
  IV_LENGTH_BYTES,
} from "../../packages/excalidraw/data/encryption";

import { restoreElements } from "../../packages/excalidraw/data/restore";

import { reconcileElements } from "../../packages/excalidraw/data/reconcile";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";

import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "../../packages/excalidraw/types";
import type Portal from "../collab/Portal";
import type { RemoteExcalidrawElement } from "../../packages/excalidraw/data/reconcile";

import type { StoredScene } from "./StorageBackend";
import type { Socket } from "socket.io-client";

const HTTP_STORAGE_BACKEND_URL = import.meta.env
  .VITE_APP_HTTP_STORAGE_BACKEND_URL;
const SCENE_VERSION_LENGTH_BYTES = 4;

const httpStorageSceneVersionCache = new WeakMap<Socket, number>();

export const isSavedToHttpStorage = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    return httpStorageSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  return true;
};

/**
 * Saves elements to HTTP storage backend with reconciliation logic.
 *
 * Behavior:
 * - If room doesn't exist (404): Creates new room with current elements
 * - If server version >= local: Reconciles with server and saves with version + 1
 * - If server version < local: Reconciles with server and saves with current version
 *
 * ⚠️ KNOWN LIMITATION: Race conditions possible with concurrent saves
 * Multiple clients may overwrite each other's changes (last write wins).
 * This is a known trade-off for simplicity.
 *
 * @param portal - Portal with room connection details
 * @param elements - Elements to save
 * @param appState - Current app state for reconciliation
 * @returns The reconciled elements that were saved, or false if save failed
 */
export const saveToHttpStorage = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToHttpStorage(portal, elements)
  ) {
    return false;
  }

  const sceneVersion = getSceneVersion(elements);
  const getResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
  );

  if (!getResponse.ok && getResponse.status !== 404) {
    return false;
  }

  if (getResponse.status === 404) {
    const result = await saveElementsToBackend(
      roomKey,
      roomId,
      [...elements],
      sceneVersion,
    );
    if (result) {
      httpStorageSceneVersionCache.set(socket, sceneVersion);

      refreshRoomFilesTimestamps(roomId, roomKey).catch((err) =>
        console.error("[refresh] Failed", err),
      );

      // Return what was saved for consistency with other paths
      return [...elements];
    }
    return false;
  }

  const buffer = await getResponse.arrayBuffer();
  const sceneVersionFromRequest = parseSceneVersionFromRequest(buffer);

  if (sceneVersionFromRequest >= sceneVersion) {
    // Fallback PUT: reconciling old room with server
    const existingElements = await getElementsFromBuffer(buffer, roomKey);
    const reconciledElements = getSyncableElements(
      reconcileElements(
        [...elements] as unknown as RemoteExcalidrawElement[],
        [...existingElements] as unknown as RemoteExcalidrawElement[],
        appState,
      ),
    );

    const newSceneVersion = sceneVersionFromRequest + 1;
    const result = await saveElementsToBackend(
      roomKey,
      roomId,
      reconciledElements,
      newSceneVersion,
    );

    if (result) {
      httpStorageSceneVersionCache.set(socket, newSceneVersion);
      return reconciledElements;
    }
    console.warn("[httpStorage] Fallback PUT failed", {
      roomId,
      newSceneVersion,
    });
    return false;
  }

  const existingElements = await getElementsFromBuffer(buffer, roomKey);
  const reconciledElements = getSyncableElements(
    reconcileElements(
      [...elements] as unknown as RemoteExcalidrawElement[],
      [...existingElements] as unknown as RemoteExcalidrawElement[],
      appState,
    ),
  );

  const result = await saveElementsToBackend(
    roomKey,
    roomId,
    reconciledElements,
    sceneVersion,
  );
  if (result) {
    httpStorageSceneVersionCache.set(socket, sceneVersion);
    refreshRoomFilesTimestamps(roomId, roomKey).catch((err) =>
      console.error("[refresh] Failed", err),
    );
    // FIX: Return reconciled elements (what was actually saved)
    // instead of original elements for consistency
    return reconciledElements;
  }
  console.warn("[httpStorage] PUT failed", { roomId, sceneVersion });
  return false;
};

export const loadFromHttpStorage = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const getResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
  );
  const buffer = await getResponse.arrayBuffer();
  const elements = getSyncableElements(
    restoreElements(await getElementsFromBuffer(buffer, roomKey), null),
  );
  return elements;
};

const getElementsFromBuffer = async (
  buffer: ArrayBuffer,
  key: string,
): Promise<readonly ExcalidrawElement[]> => {
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
  return await decryptElements(
    { sceneVersion, ciphertext: encrypted, iv },
    key,
  );
};

export const saveFilesToHttpStorage = async ({
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
        const payloadBlob = new Blob([buffer as Uint8Array<ArrayBuffer>]);
        const payload = await new Response(payloadBlob).arrayBuffer();
        await fetch(`${HTTP_STORAGE_BACKEND_URL}/files/${id}`, {
          method: "PUT",
          body: payload,
        });
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
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

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const response = await fetch(`${HTTP_STORAGE_BACKEND_URL}/files/${id}`);
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();
          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            { decryptionKey },
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

  return { loadedFiles, erroredFiles };
};

const saveElementsToBackend = async (
  roomKey: string,
  roomId: string,
  elements: SyncableExcalidrawElement[],
  sceneVersion: number,
) => {
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  const numberBuffer = new ArrayBuffer(4);
  const numberView = new DataView(numberBuffer);
  numberView.setUint32(0, sceneVersion, false);
  // Create typed arrays that TypeScript can infer correctly
  const ivArray = Uint8Array.from(iv);
  const cipherArray = new Uint8Array(ciphertext);
  const payloadBlob = await new Response(
    new Blob([numberBuffer, ivArray, cipherArray]),
  ).arrayBuffer();
  const putResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
    { method: "PUT", body: payloadBlob },
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
  const decrypted = await decryptData(
    data.iv as Uint8Array<ArrayBuffer>,
    data.ciphertext,
    roomKey,
  );
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const encoded = new TextEncoder().encode(JSON.stringify(elements));
  const { encryptedBuffer, iv } = await encryptData(key, encoded);
  return { ciphertext: encryptedBuffer, iv };
};

// Typ predicate for image elements with fileId
const isImageElementWithFileId = (
  el: SyncableExcalidrawElement,
): el is SyncableExcalidrawElement & { fileId: string } =>
  el.type === "image" && !!(el as any).fileId;

// Update timestamps for all images in a room
export const refreshRoomFilesTimestamps = async (
  roomId: string,
  roomKey: string,
) => {
  const elements = await loadFromHttpStorage(roomId, roomKey, null);
  if (!elements) {
    console.warn(`[refresh] No elements found for room ${roomId}`);
    return { refreshed: [], errored: [] };
  }

  const fileIds = [
    ...new Set(
      elements.filter(isImageElementWithFileId).map((el) => el.fileId),
    ),
  ];
  const refreshed: string[] = [];
  const errored: string[] = [];

  for (const id of fileIds) {
    try {
      const patchRes = await fetch(
        `${HTTP_STORAGE_BACKEND_URL}/files/${id}/timestamp`,
        {
          method: "PATCH",
        },
      );

      try {
        await patchRes.json();
      } catch {
        console.warn(`[refresh] PATCH-response for ${id} no JSON-body`);
      }

      if (!patchRes.ok) {
        console.warn(`[refresh] PATCH failed for ${id}`);
        errored.push(id);
        continue;
      }

      refreshed.push(id);
    } catch (err) {
      console.error(`[refresh] Unable to PATCH:a file ${id}`, err);
      errored.push(id);
    }
  }

  return { refreshed, errored };
};
