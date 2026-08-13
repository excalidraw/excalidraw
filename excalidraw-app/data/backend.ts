import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { reconcileElements } from "@excalidraw/excalidraw";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  decryptData,
  encryptData,
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

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

const BACKEND_URL = (import.meta.env.VITE_APP_BACKEND_URL || "").replace(
  /\/$/,
  "",
);

type StoredSceneResponse = {
  ciphertext: string;
  iv: string;
  revision: number;
};

const base64ToBytes = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array | ArrayBuffer): string => {
  // WebCrypto can return an ArrayBuffer from another realm (for example in
  // jsdom), where `instanceof ArrayBuffer` is false. Uint8Array is the safe
  // branch to test; constructing a view works across realms.
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < array.length; index++) {
    binary += String.fromCharCode(array[index]);
  }
  return btoa(binary);
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
) => {
  const encoded = new TextEncoder().encode(JSON.stringify(elements));
  const { encryptedBuffer, iv } = await encryptData(key, encoded);
  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: StoredSceneResponse,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const decrypted = await decryptData(
    base64ToBytes(data.iv),
    base64ToBytes(data.ciphertext),
    roomKey,
  );
  return JSON.parse(new TextDecoder("utf-8").decode(decrypted));
};

class SceneVersionCache {
  private static cache = new WeakMap<Socket, number>();

  static get(socket: Socket) {
    return SceneVersionCache.cache.get(socket);
  }

  static set(socket: Socket, elements: readonly SyncableExcalidrawElement[]) {
    SceneVersionCache.cache.set(socket, getSceneVersion(elements));
  }
}

export const isSceneSaved = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    return SceneVersionCache.get(portal.socket) === getSceneVersion(elements);
  }
  return true;
};

const fetchStoredScene = async (
  roomId: string,
): Promise<StoredSceneResponse | null> => {
  const response = await fetch(
    `${BACKEND_URL}/api/scenes/${encodeURIComponent(roomId)}`,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`failed to load scene: ${response.status}`);
  }
  return response.json();
};

export const saveScene = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (!roomId || !roomKey || !socket || isSceneSaved(portal, elements)) {
    return null;
  }

  const localElements = elements;
  let stored = await fetchStoredScene(roomId);

  for (let attempt = 0; attempt < 5; attempt++) {
    const reconciled = stored
      ? getSyncableElements(
          reconcileElements(
            localElements,
            getSyncableElements(
              restoreElements(await decryptElements(stored, roomKey), null),
            ) as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
            appState,
          ),
        )
      : getSyncableElements(localElements);

    const encrypted = await encryptElements(roomKey, reconciled);
    const response = await fetch(
      `${BACKEND_URL}/api/scenes/${encodeURIComponent(roomId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciphertext: bytesToBase64(encrypted.ciphertext),
          iv: bytesToBase64(encrypted.iv),
          expectedRevision: stored?.revision ?? 0,
        }),
      },
    );

    if (response.status === 409) {
      const body = (await response.json()) as {
        current: StoredSceneResponse;
      };
      stored = body.current;
      continue;
    }
    if (!response.ok) {
      throw new Error(`failed to save scene: ${response.status}`);
    }

    // Round-trip through the encrypted payload so the return value is the
    // exact snapshot accepted by the server, even if element objects mutate.
    const storedElements = getSyncableElements(
      restoreElements(
        await decryptElements(
          {
            ciphertext: bytesToBase64(encrypted.ciphertext),
            iv: bytesToBase64(encrypted.iv),
            revision: 0,
          },
          roomKey,
        ),
        null,
      ),
    );
    SceneVersionCache.set(socket, storedElements);
    return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
  }

  throw new Error("failed to save scene after too many concurrent edits");
};

export const loadScene = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const stored = await fetchStoredScene(roomId);
  if (!stored) {
    return null;
  }

  const elements = getSyncableElements(
    restoreElements(await decryptElements(stored, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );
  if (socket) {
    SceneVersionCache.set(socket, elements);
  }
  return elements;
};

export const saveFiles = async ({
  roomId,
  files,
}: {
  roomId: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/files/${encodeURIComponent(roomId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ id, buffer }) => ({
            fileId: id,
            data: bytesToBase64(buffer),
          })),
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`failed to save files: ${response.status}`);
    }
    const result = (await response.json()) as {
      savedFiles: FileId[];
      erroredFiles: FileId[];
    };
    return result;
  } catch (error) {
    console.error(error);
    return {
      savedFiles: [] as FileId[],
      erroredFiles: files.map(({ id }) => id),
    };
  }
};

export const loadFiles = async (
  roomId: string,
  decryptionKey: string,
  fileIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();
  const uniqueIds = [...new Set(fileIds)];
  if (uniqueIds.length === 0) {
    return { loadedFiles, erroredFiles };
  }

  try {
    const ids = uniqueIds.map(encodeURIComponent).join(",");
    const response = await fetch(
      `${BACKEND_URL}/api/files/${encodeURIComponent(roomId)}?ids=${ids}`,
    );
    if (!response.ok) {
      throw new Error(`failed to load files: ${response.status}`);
    }

    const result = (await response.json()) as {
      loadedFiles: { fileId: string; data: string }[];
      erroredFiles: string[];
    };
    result.erroredFiles.forEach((id) => erroredFiles.set(id as FileId, true));

    await Promise.all(
      result.loadedFiles.map(async ({ fileId, data }) => {
        try {
          const { data: decoded, metadata } =
            await decompressData<BinaryFileMetadata>(base64ToBytes(data), {
              decryptionKey,
            });
          const now = Date.now();
          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id: fileId as FileId,
            dataURL: new TextDecoder().decode(decoded) as DataURL,
            created: metadata.created || now,
            lastRetrieved: metadata.created || now,
          });
        } catch (error) {
          console.error(error);
          erroredFiles.set(fileId as FileId, true);
        }
      }),
    );
  } catch (error) {
    console.error(error);
    uniqueIds.forEach((id) => erroredFiles.set(id, true));
  }

  return { loadedFiles, erroredFiles };
};
