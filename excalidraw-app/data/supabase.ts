import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";
import { createClient } from "@supabase/supabase-js";

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

import { FILE_CACHE_MAX_AGE_SEC, STORAGE_KEYS } from "../app_constants";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase client singleton (supports runtime reconfiguration via localStorage)
// ---------------------------------------------------------------------------

const getSupabaseConfig = (): { url: string; anonKey: string } => {
  const url =
    localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_URL) ||
    import.meta.env.VITE_APP_SUPABASE_URL;
  const anonKey =
    localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_ANON_KEY) ||
    import.meta.env.VITE_APP_SUPABASE_ANON_KEY;
  return { url, anonKey };
};

let supabaseClient: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseClient) {
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) {
      console.warn("Supabase configuration missing");
    }
    supabaseClient = createClient(url, anonKey);
  }
  return supabaseClient;
};

export const reinitializeSupabase = (url: string, anonKey: string): void => {
  supabaseClient = createClient(url, anonKey);
};

export const testSupabaseConnection = async (
  url: string,
  anonKey: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const client = createClient(url, anonKey);
    const { error } = await client.from("sessions").select("id").limit(1);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

// ---------------------------------------------------------------------------
// Encryption helpers (preserved from firebase.ts)
// ---------------------------------------------------------------------------

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
  data: { iv: number[] | Uint8Array; ciphertext: number[] | Uint8Array },
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const iv = new Uint8Array(data.iv);
  const ciphertext = new Uint8Array(data.ciphertext);

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

// ---------------------------------------------------------------------------
// Scene version cache (same pattern as FirebaseSceneVersionCache)
// ---------------------------------------------------------------------------

class SceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return SceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    SceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

// ---------------------------------------------------------------------------
// Exported functions (same signatures as firebase.ts)
// ---------------------------------------------------------------------------

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return SceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const supabase = getSupabase();

  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const path = `${prefix.replace(/^\//, "")}/${id}`;
        const { error } = await supabase.storage
          .from("files")
          .upload(path, buffer, {
            contentType: "application/octet-stream",
            cacheControl: `${FILE_CACHE_MAX_AGE_SEC}`,
            upsert: true,
          });
        if (error) {
          throw error;
        }
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const saveToFirebase = async (
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
    isSavedToFirebase(portal, elements)
  ) {
    return null;
  }

  const supabase = getSupabase();

  // Read current scene from Supabase
  const { data: existingRow } = await supabase
    .from("scenes")
    .select("*")
    .eq("room_id", roomId)
    .single();

  let reconciledElements: readonly SyncableExcalidrawElement[];

  if (!existingRow) {
    // No existing scene — just use current elements
    reconciledElements = elements;
  } else {
    // Decrypt existing, reconcile
    const prevStoredElements = getSyncableElements(
      restoreElements(await decryptElements(existingRow, roomKey), null),
    );
    reconciledElements = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );
  }

  // Encrypt reconciled elements
  const sceneVersion = getSceneVersion(reconciledElements);
  const { ciphertext, iv } = await encryptElements(roomKey, reconciledElements);

  // Upsert into Supabase
  const { error } = await supabase.from("scenes").upsert(
    {
      room_id: roomId,
      scene_version: sceneVersion,
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id" },
  );

  if (error) {
    throw error;
  }

  // Re-decrypt to get the stored state (matches firebase.ts behavior)
  const storedElements = getSyncableElements(
    restoreElements(
      await decryptElements(
        {
          iv: Array.from(iv),
          ciphertext: Array.from(new Uint8Array(ciphertext)),
        },
        roomKey,
      ),
      null,
    ),
  );

  SceneVersionCache.set(socket, storedElements);

  return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("room_id", roomId)
    .single();

  if (error || !data) {
    return null;
  }

  const elements = getSyncableElements(
    restoreElements(await decryptElements(data, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );

  if (socket) {
    SceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const loadFilesFromFirebase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const supabase = getSupabase();
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const path = `${prefix.replace(/^\//, "")}/${id}`;
        const { data, error } = await supabase.storage
          .from("files")
          .download(path);

        if (error || !data) {
          erroredFiles.set(id, true);
          return;
        }

        const arrayBuffer = await data.arrayBuffer();

        const { data: decompressed, metadata } =
          await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

        const dataURL = new TextDecoder().decode(decompressed) as DataURL;

        loadedFiles.push({
          mimeType: metadata.mimeType || MIME_TYPES.binary,
          id,
          dataURL,
          created: metadata?.created || Date.now(),
          lastRetrieved: metadata?.created || Date.now(),
        });
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};

export const loadFirebaseStorage = async () => {
  return getSupabase().storage;
};
