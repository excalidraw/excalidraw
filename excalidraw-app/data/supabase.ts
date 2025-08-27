import { createClient } from "@supabase/supabase-js";
import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { nanoid } from "nanoid";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
  BinaryFiles,
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
    
    // Try to upload, if it fails due to existing file, remove and retry
    let { error } = await supabase.storage
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

    if (error && error.message?.includes("already exists")) {
      // File already exists, remove it first
      const { error: removeError } = await supabase.storage
        .from("diagram-files")
        .remove([fileName]);

      if (removeError) {
        console.warn("Failed to remove existing file:", removeError);
      }

      // Try upload again
      const { error: retryError } = await supabase.storage
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

      if (retryError) {
        throw retryError;
      }
    } else if (error) {
      throw error;
    }

    return fileName;
  } catch (error: any) {
    console.error("Error saving scene to Supabase storage:", error);
    throw error;
  }
};

// Function to save scene metadata to database with branching versioning support
export const saveSceneMetadata = async (
  sceneId: string,
  encryptionKey: string,
  metadata: { name?: string; description?: string; isAutomatic?: boolean; currentVersion?: number },
) => {
  const supabase = _getSupabase();

  try {
    const sceneName = metadata.name || `Scene ${sceneId}`;
    
    if (metadata.isAutomatic) {
      // For automatic saves, update the "Latest" version of the current branch
      const currentVersion = metadata.currentVersion || 0;
      
      // Check if there's already a "Latest" version for this branch
      const { data: existingLatest, error: checkError } = await (supabase as any)
        .from("scene_metadata")
        .select("scene_id")
        .eq("name", sceneName)
        .eq("version", currentVersion)
        .eq("is_latest", true)
        .single();

      if (existingLatest && !checkError) {
        // Update existing "Latest" version for this branch
        const { error: updateError } = await (supabase as any)
          .from("scene_metadata")
          .update({
            scene_id: sceneId,
            encryption_key: encryptionKey,
            description: metadata.description || "",
            created_at: new Date().toISOString(),
          })
          .eq("scene_id", existingLatest.scene_id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new "Latest" version for this branch
        const { error } = await (supabase as any)
          .from("scene_metadata")
          .insert({
            scene_id: sceneId,
            encryption_key: encryptionKey,
            name: sceneName,
            description: metadata.description || "",
            version: currentVersion,
            is_latest: true,
            is_automatic: true,
            created_at: new Date().toISOString(),
          });

        if (error) {
          throw error;
        }
      }
    } else {
      // For manual exports, create a new version branch
      // Check if a scene with this name already exists (excluding automatic versions)
      const { data: existingScenes, error: checkError } = await (supabase as any)
        .from("scene_metadata")
        .select("version")
        .eq("name", sceneName)
        .eq("is_automatic", false)
        .order("version", { ascending: false });

      if (checkError) {
        throw checkError;
      }

      // Determine the next version number (only counting manual exports)
      const nextVersion = existingScenes && existingScenes.length > 0 
        ? Math.max(...existingScenes.map((s: any) => s.version)) + 1 
        : 1;

      // Insert the new manual version branch
      const { error } = await (supabase as any)
        .from("scene_metadata")
        .insert({
          scene_id: sceneId,
          encryption_key: encryptionKey,
          name: sceneName,
          description: metadata.description || "",
          version: nextVersion,
          is_latest: false, // Manual exports create new branches, not latest
          is_automatic: false,
          created_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      // Return the version number for manual exports
      return nextVersion;
    }
  } catch (error: any) {
    console.error("Error saving scene metadata:", error);
    throw error;
  }
};

// Function to save scene automatically (creates or replaces "latest" version for current branch)
export const saveSceneAutomatically = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  name: string,
  currentVersion: number = 0,
) => {
  const sceneId = `${nanoid(12)}`;
  const encryptionKey = (await generateEncryptionKey())!;

  const encryptedData = await encryptData(
    encryptionKey,
    serializeAsJSON(elements, appState, files, "database"),
  );

  // Combine IV and encrypted data into a single Uint8Array
  const sceneData = new Uint8Array(
    encryptedData.iv.length + encryptedData.encryptedBuffer.byteLength,
  );
  sceneData.set(encryptedData.iv);
  sceneData.set(
    new Uint8Array(encryptedData.encryptedBuffer),
    encryptedData.iv.length,
  );

  // Save to Supabase storage (overwrite if exists)
  await saveSceneToSupabaseStorage(sceneData, sceneId, {
    name,
    version: 2,
  });

  // Save metadata to database with automatic flag and current version
  await saveSceneMetadata(sceneId, encryptionKey, {
    name,
    description: `Latest automatic save: ${name}`,
    isAutomatic: true,
    currentVersion,
  });

  return sceneId;
};

// Function to list all exported scenes with metadata, grouped by name with branching versioning
export const listExportedScenes = async () => {
  const supabase = _getSupabase();

  try {
    const { data, error } = await (supabase as any)
      .from("scene_metadata")
      .select("*")
      .order("name", { ascending: true })
      .order("version", { ascending: false });

    if (error) {
      throw error;
    }

    // Group scenes by name and version (branch)
    const groupedScenes = new Map<string, Map<number, any[]>>();
    
    data?.forEach((item: any) => {
      if (!groupedScenes.has(item.name)) {
        groupedScenes.set(item.name, new Map());
      }
      const versionMap = groupedScenes.get(item.name)!;
      
      if (!versionMap.has(item.version)) {
        versionMap.set(item.version, []);
      }
      versionMap.get(item.version)!.push({
        id: item.scene_id,
        name: item.name,
        description: item.description,
        createdAt: item.created_at,
        encryptionKey: item.encryption_key,
        version: item.version,
        isLatest: item.is_latest,
        isAutomatic: item.is_automatic || false,
        url: constructExcalidrawUrl(item.scene_id, item.encryption_key),
      });
    });

    // Convert to array format with branches
    return Array.from(groupedScenes.entries()).map(([name, versionMap]) => {
      const allVersions = Array.from(versionMap.values()).flat();
      const branches = Array.from(versionMap.entries()).map(([version, versions]) => ({
        version,
        versions,
        latestVersion: versions.find((v: any) => v.isLatest) || versions[0],
        isManualBranch: version > 0, // v0 is automatic, v1+ are manual branches
      }));

      return {
        name,
        description: allVersions[0]?.description || "",
        versions: allVersions,
        branches,
        latestVersion: allVersions.find((v: any) => v.isLatest) || allVersions[0],
      };
    });
  } catch (error: any) {
    console.error("Error listing exported scenes:", error);
    return [];
  }
};

// Function to load scene by ID (with metadata lookup)
export const loadSceneById = async (sceneId: string) => {
  const supabase = _getSupabase();

  try {
    const { data: metadata, error } = await (supabase as any)
      .from("scene_metadata")
      .select("*")
      .eq("scene_id", sceneId)
      .single();

    if (error || !metadata) {
      throw new Error("Scene not found");
    }

    const sceneData = await loadSceneFromSupabaseStorage(
      metadata.scene_id,
      metadata.encryption_key,
    );

    return {
      ...sceneData,
      metadata: {
        name: metadata.name,
        description: metadata.description,
        createdAt: metadata.created_at,
        version: metadata.version,
        isLatest: metadata.is_latest,
        isAutomatic: metadata.is_automatic || false,
      },
    };
  } catch (error: any) {
    console.error("Error loading scene by ID:", error);
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

// Function to delete a scene by ID
export const deleteSceneById = async (sceneId: string) => {
  const supabase = _getSupabase();

  try {
    // First, get the metadata to find the encryption key
    const { data: metadata, error: metadataError } = await (supabase as any)
      .from("scene_metadata")
      .select("*")
      .eq("scene_id", sceneId)
      .single();

    if (metadataError || !metadata) {
      throw new Error("Scene not found");
    }

    // Delete from scene_metadata table
    const { error: deleteMetadataError } = await (supabase as any)
      .from("scene_metadata")
      .delete()
      .eq("scene_id", sceneId);

    if (deleteMetadataError) {
      throw deleteMetadataError;
    }


    // Delete the file from storage
    const { error: deleteStorageError } = await supabase.storage
      .from("diagram-files")
      .remove([`files/shareLinks/${sceneId}`]);

    if (deleteStorageError) {
      console.warn("Failed to delete scene file from storage:", deleteStorageError);
      // Don't throw here as the metadata and versions are already deleted
    }

    return true;
  } catch (error: any) {
    console.error("Error deleting scene:", error);
    throw error;
  }
};

// Function to delete all versions of a scene by name
export const deleteSceneByName = async (sceneName: string) => {
  const supabase = _getSupabase();

  try {
    // Get all versions of the scene
    const { data: allVersions, error: fetchError } = await (supabase as any)
      .from("scene_metadata")
      .select("scene_id")
      .eq("name", sceneName);

    if (fetchError) {
      throw fetchError;
    }

    if (!allVersions || allVersions.length === 0) {
      throw new Error("Scene not found");
    }

    const sceneIds = allVersions.map((version: any) => version.scene_id);

    // Delete all versions from scene_metadata table
    const { error: deleteMetadataError } = await (supabase as any)
      .from("scene_metadata")
      .delete()
      .in("scene_id", sceneIds);

    if (deleteMetadataError) {
      throw deleteMetadataError;
    }

    // Delete all files from storage
    const filePaths = sceneIds.map((id: string) => `files/shareLinks/${id}`);
    const { error: deleteStorageError } = await supabase.storage
      .from("diagram-files")
      .remove(filePaths);

    if (deleteStorageError) {
      console.warn("Failed to delete some scene files from storage:", deleteStorageError);
      // Don't throw here as the metadata and versions are already deleted
    }

    return true;
  } catch (error: any) {
    console.error("Error deleting scene:", error);
    throw error;
  }
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

    // Try new format first (compression format)
    try {
      const { data: decodedBuffer } = await decompressData(uint8Array, {
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
        "Error when decoding scene data using the new format, trying legacy format:",
        error,
      );
      
      // Try legacy format (direct decryption without compression)
      // Extract IV (first 12 bytes for AES-GCM) and encrypted data
      const iv = uint8Array.slice(0, 12);
      const encryptedData = uint8Array.slice(12);
      
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
