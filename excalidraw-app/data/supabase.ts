import { createClient } from "@supabase/supabase-js";
import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

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

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

const _initializeSupabase = () => {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "Supabase URL and anonymous key are required. Please check your environment variables.",
      );
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
};

const _getSupabase = () => {
  return _initializeSupabase();
};

type SupabaseStoredScene = {
  id: string;
  room_id: string;
  scene_version: number;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  created_at: string;
  updated_at: string;
};

type SupabaseSceneInsert = {
  room_id: string;
  scene_version: number;
  ciphertext: Uint8Array;
  iv: Uint8Array;
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
  data: SupabaseStoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = new Uint8Array(data.ciphertext);
  const iv = new Uint8Array(data.iv);

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

class SupabaseSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return SupabaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    SupabaseSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSavedToSupabase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return SupabaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToSupabase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const supabase = _getSupabase();

  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const fileName = `${prefix}/${id}`;
        const { error } = await supabase.storage
          .from("diagram-files")
          .upload(fileName, buffer, {
            cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
          });

        if (error) {
          throw error;
        }

        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
        console.error(`Error uploading file ${id}:`, error);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createSupabaseSceneDocument = async (
  roomId: string,
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
): Promise<SupabaseSceneInsert> => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);

  return {
    room_id: roomId,
    scene_version: sceneVersion,
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
};

export const saveToSupabase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToSupabase(portal, elements)
  ) {
    return null;
  }

  const supabase = _getSupabase();

  try {
    // Check if scene already exists
    const { data: existingScene } = await supabase
      .from("diagrams")
      .select("*")
      .eq("room_id", roomId)
      .single();

    if (existingScene) {
      // Decrypt existing scene for reconciliation
      const prevStoredScene = existingScene as SupabaseStoredScene;
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

      const sceneData = await createSupabaseSceneDocument(
        roomId,
        reconciledElements,
        roomKey,
      );

      // Update existing scene
      const { error } = await (supabase as any)
        .from("diagrams")
        .update(sceneData)
        .eq("room_id", roomId);

      if (error) {
        throw error;
      }

      const storedElements = reconciledElements;
      SupabaseSceneVersionCache.set(socket, storedElements);

      return storedElements;
    }
    // Create new scene
    const sceneData = await createSupabaseSceneDocument(
      roomId,
      elements,
      roomKey,
    );

    const { error } = await (supabase as any)
      .from("diagrams")
      .insert(sceneData);

    if (error) {
      throw error;
    }

    SupabaseSceneVersionCache.set(socket, elements);

    return elements;
  } catch (error: any) {
    console.error("Error saving to Supabase:", error);
    throw error;
  }
};

export const loadFromSupabase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const supabase = _getSupabase();

  try {
    const { data: storedScene, error } = await supabase
      .from("diagrams")
      .select("*")
      .eq("room_id", roomId)
      .single();

    if (error || !storedScene) {
      return null;
    }

    const elements = getSyncableElements(
      restoreElements(
        await decryptElements(storedScene as SupabaseStoredScene, roomKey),
        null,
        {
          deleteInvisibleElements: true,
        },
      ),
    );

    if (socket) {
      SupabaseSceneVersionCache.set(socket, elements);
    }

    return elements;
  } catch (error: any) {
    console.error("Error loading from Supabase:", error);
    return null;
  }
};

export const loadFilesFromSupabase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const supabase = _getSupabase();

  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const fileName = `${prefix}/${id}`;
        const { data, error } = await supabase.storage
          .from("diagram-files")
          .download(fileName);

        if (error || !data) {
          erroredFiles.set(id, true);
          return;
        }

        const arrayBuffer = await data.arrayBuffer();

        const { data: decodedBuffer, metadata } =
          await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

        const dataURL = new TextDecoder().decode(decodedBuffer) as DataURL;

        loadedFiles.push({
          mimeType: metadata?.mimeType || MIME_TYPES.binary,
          id,
          dataURL,
          created: metadata?.created || Date.now(),
          lastRetrieved: metadata?.created || Date.now(),
        });
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(`Error loading file ${id}:`, error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};

// Function to save encrypted scene data to Supabase storage (equivalent to Firebase export)
export const saveSceneToSupabaseStorage = async (
  sceneData: Uint8Array,
  sceneId: string,
  metadata?: { name?: string; version?: number },
) => {
  const supabase = _getSupabase();

  try {
    const fileName = `files/shareLinks/${sceneId}`;
    const { error } = await supabase.storage
      .from("diagram-files")
      .upload(fileName, sceneData, {
        cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
        contentType: MIME_TYPES.binary,
        metadata: metadata
          ? {
              name: metadata.name || "",
              version: metadata.version?.toString() || "2",
              created: Date.now().toString(),
            }
          : undefined,
      });

    if (error) {
      throw error;
    }

    return fileName;
  } catch (error: any) {
    console.error("Error saving scene to Supabase storage:", error);
    throw error;
  }
};

// Function to generate scene URL from Supabase storage
export const getSupabaseSceneUrl = (sceneId: string) => {
  const supabase = _getSupabase();
  const { data } = supabase.storage
    .from("diagram-files")
    .getPublicUrl(`files/shareLinks/${sceneId}`);

  return data.publicUrl;
};

// Function to construct Excalidraw URL from scene ID and encryption key
export const constructExcalidrawUrl = (sceneId: string, encryptionKey: string) => {
  return `http://localhost:3000#json=${sceneId},${encryptionKey}`;
};

// Function to load encrypted scene data from Supabase storage
export const loadSceneFromSupabaseStorage = async (
  sceneId: string,
  decryptionKey: string,
): Promise<ImportedDataState> => {
  const supabase = _getSupabase();

  try {
    const { data, error } = await supabase.storage
      .from("diagram-files")
      .download(`files/shareLinks/${sceneId}`);

    if (error || !data) {
      throw new Error("Failed to load scene from Supabase storage");
    }

    const buffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Extract IV (first 12 bytes for AES-GCM) and encrypted data
    const iv = uint8Array.slice(0, 12);
    const encryptedData = uint8Array.slice(12);

    try {
      const { data: decodedBuffer } = await decompressData(encryptedData, {
        decryptionKey,
      });
      const sceneData: ImportedDataState = JSON.parse(
        new TextDecoder().decode(decodedBuffer),
      );

      return {
        elements: sceneData.elements || null,
        appState: sceneData.appState || null,
      };
    } catch (error: any) {
      console.warn(
        "Error when decoding scene data using the new format:",
        error,
      );
      // Try legacy format (direct decryption without decompression)
      const decrypted = await decryptData(iv, encryptedData, decryptionKey);
      const decodedData = new TextDecoder("utf-8").decode(
        new Uint8Array(decrypted),
      );
      const sceneData: ImportedDataState = JSON.parse(decodedData);

      return {
        elements: sceneData.elements || null,
        appState: sceneData.appState || null,
      };
    }
  } catch (error: any) {
    console.error("Error loading scene from Supabase storage:", error);
    throw error;
  }
};
