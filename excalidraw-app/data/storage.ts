/**
 * @fileoverview Storage module for Excalidraw data persistence with external Jitsi backend.
 * 
 * Handles encrypted scene storage, file management, and real-time collaboration
 * through JWT-authenticated API calls to the external backend service.
 */
import { reconcileElements } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import { getSceneVersion } from "@excalidraw/excalidraw/element";
import type Portal from "../collab/Portal";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
  IMeetingDetails,
} from "@excalidraw/excalidraw/types";
import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { MIME_TYPES } from "@excalidraw/excalidraw/constants";
import type { SyncableExcalidrawElement } from ".";
import { getSyncableElements } from ".";
import type { Socket } from "socket.io-client";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";

const BACKEND_CONFIG = {
  baseUrl: import.meta.env.VITE_APP_STORAGE_BACKEND_URL || "http://localhost:3000",
  apiPrefix: import.meta.env.VITE_APP_STORAGE_API_PREFIX || "/v1/documents",
};

let backendApi: { baseUrl: string; apiPrefix: string } | null = null;
let meetingDetailsCache: IMeetingDetails | null = null; // Cache for meeting details


// Initialize backend configuration with storageBackendUrl & meetingDetails (Token comes from meetingDetails)
export const initializeBackend = (storageBackendUrl?: string, meetingDetails?: IMeetingDetails) => {
  backendApi = {
    baseUrl: storageBackendUrl || BACKEND_CONFIG.baseUrl,
    apiPrefix: BACKEND_CONFIG.apiPrefix,
  };
  meetingDetailsCache = meetingDetails || null;
};

const _getBackendApi = () => {
  if (!backendApi) {
    backendApi = {
      baseUrl: BACKEND_CONFIG.baseUrl,
      apiPrefix: BACKEND_CONFIG.apiPrefix,
    };
  }
  return backendApi;
};

const _getToken = async (): Promise<string | undefined> => {
  // A provider, when supplied, returns a fresh (possibly short-lived) token on
  // every call and takes precedence over the static token.
  if (meetingDetailsCache?.getStorageToken) {
    try {
      return await meetingDetailsCache.getStorageToken();
    } catch (error) {
      console.error("Failed to fetch storage token:", error);
      return meetingDetailsCache?.token;
    }
  }
  return meetingDetailsCache?.token;
};

const _getMeetingDetails = (): IMeetingDetails | null => {
  return meetingDetailsCache;
};

export const loadStorage = async () => {
  return _getBackendApi();
};

// Backend API helper functions
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const api = _getBackendApi();
  const url = `${api.baseUrl}${api.apiPrefix}${endpoint}`;
  
  // Adding token to headers if available
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };
  
  const token = await _getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
    
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response;
};

// Helper function to upload files using Multer
const uploadFilesWithMulter = async (prefix: string, files: { id: FileId; buffer: Uint8Array }[]): Promise<{ savedFiles: FileId[]; erroredFiles: FileId[] }> => {
  if (!files || files.length === 0) {
    return { savedFiles: [], erroredFiles: [] };
  }

  const api = _getBackendApi();
  const meetingDetails = _getMeetingDetails();
  const baseUrl = `${api.baseUrl}${api.apiPrefix}`;
  
  if (!meetingDetails?.sessionId || !meetingDetails?.roomJid) {
    throw new Error('Missing required meeting details (sessionId or roomJid)');
  }

  const savedFiles: FileId[] = [];
  const erroredFiles: FileId[] = [];

  // Uploading sequentially
  for (const { id, buffer } of files) {
    try {
      const url = `${baseUrl}/sessions/${meetingDetails.sessionId}/files`;

      const fileMetaData = {
        conferenceFullName: meetingDetails.roomJid,
        fileId: id,
        fileSize: buffer.byteLength,
        timestamp: Date.now(),
        prefix
      };

      const formData = new FormData();
      formData.append('metadata', JSON.stringify(fileMetaData));
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' });
      formData.append('file', blob, id);

      const headers: Record<string, string> = {};
      const token = await _getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error(`Upload failed for file ${id}: ${response.status} ${response.statusText} ${text}`);
        erroredFiles.push(id);
        continue;
      }

      const result = await response.json().catch(() => null);
      if (!result) {
        console.error(`Invalid response for file ${id}`);
        erroredFiles.push(id);
        continue;
      }

      savedFiles.push(id);
    } catch (error) {
      console.error(`Error uploading file ${id}:`, error);
      erroredFiles.push(id);
    }
  }

  return { savedFiles, erroredFiles };
};



  // Helper function to download files
const downloadFilesFromBackend = async (prefix: string, fileIds: readonly FileId[]) => {
  
  // Early return if no files to download
  if (!fileIds || fileIds.length === 0) {
    return { loadedFiles: [], erroredFiles: [] };
  }

  const api = _getBackendApi();
  const baseUrl = `${api.baseUrl}${api.apiPrefix}`;
  const meetingDetails = _getMeetingDetails();
  
  if (!meetingDetails?.sessionId || !meetingDetails?.roomJid) {
    throw new Error('Missing required meeting details (sessionId or roomJid)');
  }
  const loadedFiles: Array<{ id: FileId; buffer: Uint8Array }> = [];
  const erroredFiles: FileId[] = [];

  const headers: Record<string, string> = {};
  const token = await _getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  await Promise.all(
    [...new Set(fileIds)].map(async (id) => {
      try {
        const encodedFileId = encodeURIComponent(`${prefix}/${id}`);
        const url = `${baseUrl}/sessions/${meetingDetails.sessionId}/files/${encodedFileId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers,
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          loadedFiles.push({
            id,
            buffer: new Uint8Array(arrayBuffer),
          });
        } else {
          erroredFiles.push(id);
          console.log(`Failed to download file: ${id}, Status: ${response.status}`);
        }
      } catch (error: any) {
        erroredFiles.push(id);
        console.error(`Error downloading file ${id}:`, error);
      }
    })
  );

  return { loadedFiles, erroredFiles };
};

class BackendBytes {
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  static fromUint8Array(data: Uint8Array): BackendBytes {
    return new BackendBytes(data);
  }

  toUint8Array(): Uint8Array {
    return this.data;
  }

  toBase64(): string {
    return btoa(String.fromCharCode(...this.data));
  }

  static fromBase64(base64: string): BackendBytes {
    const binaryString = atob(base64);
    const data = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      data[i] = binaryString.charCodeAt(i);
    }
    return new BackendBytes(data);
  }
}

type StoredScene = {
  sceneVersion: number;
  iv: BackendBytes;
  ciphertext: BackendBytes;
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
  data: StoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext.toUint8Array();
  const iv = data.iv.toUint8Array();

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

class StorageSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return StorageSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    StorageSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSavedToStorage = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return StorageSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToStorage = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  
  if (!files || files.length === 0) {
    return { savedFiles: [], erroredFiles: [] };
  }

  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  try {
    const result = await uploadFilesWithMulter(prefix, files);
    
    savedFiles.push(...(result.savedFiles || []));
    erroredFiles.push(...(result.erroredFiles || []));

  } catch (error: any) {
    console.error("Error uploading files to backend:", error);
    // Mark all files as errored if the API call fails
    files.forEach(({ id }) => erroredFiles.push(id));
  }

  return { savedFiles, erroredFiles };
};

const createStorageSceneDocument = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  return {
    sceneVersion,
    ciphertext: BackendBytes.fromUint8Array(new Uint8Array(ciphertext)),
    iv: BackendBytes.fromUint8Array(iv),
  } as StoredScene;
};

const getBackendDocument = async (roomId: string): Promise<StoredScene | null> => {
  return null;
  try {
    const response = await apiCall(`/scenes/${roomId}`, {
      method: "GET",
    });
    
    if (response.ok) {
      const data = await response.json();
      // converting base64 back to BackendBytes
      return {
        sceneVersion: data.sceneVersion,
        ciphertext: BackendBytes.fromBase64(data.ciphertext),
        iv: BackendBytes.fromBase64(data.iv),
      };
    }
    return null;
  } catch (error) {
    console.error("Error loading scene document:", roomId, error);
    return null;
  }
};

const setBackendDocument = async (roomId: string, document: StoredScene): Promise<void> => {
  
  return ;
  const serializedDoc = {
    roomId,
    sceneVersion: document.sceneVersion,
    ciphertext: document.ciphertext.toBase64(), // converting to base64 for API transfer
    iv: document.iv.toBase64(),
  };

  const response = await apiCall("/scenes", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializedDoc),
  });

  if (!response.ok) {
    throw new Error(`Failed to save scene: ${response.status} ${response.statusText}`);
  }  
};

// Backend transaction simulation - using simple read-modify-write
const runBackendTransaction = async <T>(
  roomId: string,
  updateFunction: (document: StoredScene | null) => Promise<T>,
): Promise<T> => {
  const existingDocument = await getBackendDocument(roomId);
  const result = await updateFunction(existingDocument);
  return result;
};

export const saveToStorage = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {  
  const { roomId, roomKey, socket } = portal;
  if ( !roomId || !roomKey || !socket || isSavedToStorage(portal, elements)) {
    console.log("Missing required fields", { roomId: !!roomId, roomKey: !!roomKey, socket: !!socket });
    return null;
  }

  const storedScene = await runBackendTransaction(roomId, async (snapshot) => {
    if (!snapshot) {
      const storedScene = await createStorageSceneDocument(elements, roomKey);
      await setBackendDocument(roomId, storedScene);
      return storedScene;
    }

    const prevStoredScene = snapshot;
    const prevStoredElements = getSyncableElements(
      restoreElements(await decryptElements(prevStoredScene, roomKey), null),
    );
    const reconciledElements = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );

    const storedScene = await createStorageSceneDocument(
      reconciledElements,
      roomKey,
    );

    await setBackendDocument(roomId, storedScene);

    // Return the stored elements as the in memory `reconciledElements` could have mutated in the meantime
    return storedScene;
  });

  const storedElements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null),
  );

  StorageSceneVersionCache.set(socket, storedElements);

  return storedElements;
};

export const loadFromStorage = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const storedScene = await getBackendDocument(roomId);
  
  if (!storedScene) {
    return null;
  }
  
  const elements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null),
  );

  if (socket) {
    StorageSceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const loadFilesFromStorage = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  if (!filesIds || filesIds.length === 0) {
    return { loadedFiles: [], erroredFiles: new Map<FileId, true>() };
  }

  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  try {
    const { loadedFiles: downloadedFiles, erroredFiles: downloadErrors } = await downloadFilesFromBackend(prefix, filesIds);
    
    await Promise.all(
      downloadedFiles.map(async ({ id, buffer }) => {
        try {
          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            buffer,
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id: id as FileId,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } catch (error: any) {
          erroredFiles.set(id as FileId, true);
          console.error("Error processing file:", id, error);
        }
      })
    );

    // Marking errored files from backend
    downloadErrors.forEach((id) => {
      erroredFiles.set(id as FileId, true);
    });
                                                          
  } catch (error: any) {                                    
    // Marking all files as errored if the API call fails
    console.error("Error loading files from backend:", error);
    filesIds.forEach((id) => erroredFiles.set(id, true));
  }

  return { loadedFiles, erroredFiles };
};
