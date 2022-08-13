// Inspired and partly copied from https://gitlab.com/kiliandeca/excalidraw-fork
// MIT, Kilian Decaderincourt

import { getSyncableElements, SyncableExcalidrawElement } from ".";
import { MIME_TYPES } from "../../constants";
import { decompressData } from "../../data/encode";
import { encryptData, IV_LENGTH_BYTES } from "../../data/encryption";
import { restoreElements } from "../../data/restore";
import { getSceneVersion } from "../../element";
import { ExcalidrawElement, FileId } from "../../element/types";
import {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "../../types";
import Portal from "../collab/Portal";
import { reconcileElements } from "../collab/reconciliation";
import { decryptData } from "../../data/encryption";
import { StoredScene } from "./StorageBackend";

const HTTP_STORAGE_BACKEND_URL = process.env.REACT_APP_HTTP_STORAGE_BACKEND_URL;
const SCENE_VERSION_LENGTH_BYTES = 4;

// There is a lot of intentional duplication with the firebase file
// to prevent modifying upstream files and ease futur maintenance of this fork

const httpStorageSceneVersionCache = new WeakMap<
  SocketIOClient.Socket,
  number
>();

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
    const result: boolean = await saveElementsToBackend(
      roomKey,
      roomId,
      [...elements],
      sceneVersion,
    );
    if (result) {
      return {
        reconciledElements: null,
      };
    }
    return false;
  }
  // If room already exist, we compare scene versions to check
  // if we're up to date before saving our scene
  const buffer = await getResponse.arrayBuffer();
  const sceneVersionFromRequest = parseSceneVersionFromRequest(buffer);
  if (sceneVersionFromRequest >= sceneVersion) {
    return false;
  }

  const existingElements = await getElementsFromBuffer(buffer, roomKey);
  const reconciledElements = getSyncableElements(
    reconcileElements(elements, existingElements, appState),
  );

  const result: boolean = await saveElementsToBackend(
    roomKey,
    roomId,
    reconciledElements,
    sceneVersion,
  );

  if (result) {
    httpStorageSceneVersionCache.set(socket, sceneVersion);
    return {
      reconciledElements: elements,
    };
  }
  return false;
};

export const loadFromHttpStorage = async (
  roomId: string,
  roomKey: string,
  socket: SocketIOClient.Socket | null,
): Promise<readonly ExcalidrawElement[] | null> => {
  const HTTP_STORAGE_BACKEND_URL =
    process.env.REACT_APP_HTTP_STORAGE_BACKEND_URL;
  const getResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
  );

  const buffer = await getResponse.arrayBuffer();
  const elements = await getElementsFromBuffer(buffer, roomKey);

  if (socket) {
    httpStorageSceneVersionCache.set(socket, getSceneVersion(elements));
  }

  return restoreElements(elements, null);
};

const getElementsFromBuffer = async (
  buffer: ArrayBuffer,
  key: string,
): Promise<readonly ExcalidrawElement[]> => {
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
  const erroredFiles = new Map<FileId, true>();
  const savedFiles = new Map<FileId, true>();

  const HTTP_STORAGE_BACKEND_URL =
    process.env.REACT_APP_HTTP_STORAGE_BACKEND_URL;

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
        const HTTP_STORAGE_BACKEND_URL =
          process.env.REACT_APP_HTTP_STORAGE_BACKEND_URL;
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
