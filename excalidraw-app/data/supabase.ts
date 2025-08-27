import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

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
import type Portal from "../collab/Portal";
import type { SyncableExcalidrawElement } from ".";
import type { Socket } from "socket.io-client";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

// Import Supabase client from AuthContext to ensure shared session
import { supabase } from "../components/AuthContext";

const _getSupabase = () => {
  return supabase;
};

// Helper function to get current user ID
const _getCurrentUserId = async (): Promise<string | null> => {
  try {
    const supabase = _getSupabase();
    if (!supabase) {
      console.warn("Supabase not configured");
      return null;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Error getting current user:", error);
      return null;
    }
    if (!user) {
      console.warn("No authenticated user found");
      return null;
    }
    return user.id;
  } catch (error) {
    console.error("Unexpected error getting current user:", error);
    return null;
  }
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

  if (!supabase) {
    console.warn("Supabase not configured - cannot save files");
    return { savedFiles: [], erroredFiles: files.map(f => f.id) };
  }

  // Note: This function uses Supabase Storage, not the diagram_files table
  // The diagram_files table is for metadata, but storage uses Supabase Storage buckets
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





// Stub implementations for collaborative features that were removed with versioning
export const isSavedToSupabase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  // Since we removed versioning, collaborative saving is not available
  // Always return true to indicate the scene is "saved" locally
  return true;
};

export const saveToSupabase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  // Collaborative saving is not available without versioning
  // Return null to indicate no collaborative save was performed
  return null;
};

export const loadFromSupabase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  // Collaborative loading is not available without versioning
  return null;
};

export class SupabaseSceneVersionCache {
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

export const loadFilesFromSupabase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const supabase = _getSupabase();

  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  if (!supabase) {
    console.warn("Supabase not configured - cannot load files");
    return { loadedFiles: [], erroredFiles: new Map(filesIds.map(id => [id, true as const])) };
  }

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

// Map to track ongoing save operations by sceneId to prevent race conditions
const saveOperations = new Map<string, Promise<any>>();

// Map to track ongoing metadata save operations by a composite key to prevent race conditions
const metadataSaveOperations = new Map<string, Promise<any>>();

// Cleanup function to remove completed operations and prevent memory leaks
const cleanupSaveOperation = (sceneId: string, operation: Promise<any>) => {
  operation.finally(() => {
    // Only remove if this is still the current operation for this sceneId
    if (saveOperations.get(sceneId) === operation) {
      saveOperations.delete(sceneId);
    }
  });
};

// Cleanup function for metadata operations
const cleanupMetadataOperation = (operationKey: string, operation: Promise<any>) => {
  operation.finally(() => {
    // Only remove if this is still the current operation for this key
    if (metadataSaveOperations.get(operationKey) === operation) {
      metadataSaveOperations.delete(operationKey);
    }
  });
};

// Function to save encrypted scene data to Supabase storage (equivalent to Firebase export)
export const saveSceneToSupabaseStorage = async (
  sceneData: Uint8Array,
  sceneId: string,
  metadata?: { name?: string },
) => {
  const supabase = _getSupabase();

  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  // Check if a save operation is already in progress for this sceneId
  const existingOperation = saveOperations.get(sceneId);
  if (existingOperation) {
    console.log(`Save operation already in progress for ${sceneId}, waiting...`);
    return await existingOperation;
  }

  // Create a new save operation
  const saveOperation = (async () => {
    try {
      const fileName = `files/shareLinks/${sceneId}`;

      console.log('Attempting to save scene to Supabase storage:', {
        fileName,
        bucket: 'diagram-files',
        dataSize: sceneData.length
      });

      // Try to upload with upsert behavior - use a unique filename to avoid conflicts
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const uniqueFileName = `files/shareLinks/${sceneId}_${timestamp}_${randomSuffix}`;

      console.log('Attempting to save scene to Supabase storage:', {
        originalFileName: fileName,
        uniqueFileName,
        bucket: 'diagram-files',
        dataSize: sceneData.length
      });

      // Remove any existing files with the same sceneId to replace the current scene
      try {
        const { data: existingFiles } = await supabase.storage
          .from("diagram-files")
          .list('files/shareLinks', {
            search: sceneId
          });

        if (existingFiles && existingFiles.length > 0) {
          const filesToRemove = existingFiles
            .filter(file => file.name.startsWith(sceneId))
            .map(file => `files/shareLinks/${file.name}`);

          if (filesToRemove.length > 0) {
            console.log(`Replacing ${filesToRemove.length} existing files for ${sceneId}`);
            await supabase.storage
              .from("diagram-files")
              .remove(filesToRemove);
          }
        }
      } catch (cleanupError) {
        console.warn("Failed to cleanup old files:", cleanupError);
        // Don't throw here, continue with upload
      }

      // Now upload with the unique filename
      const { error } = await supabase.storage
        .from("diagram-files")
        .upload(uniqueFileName, sceneData, {
          cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
          contentType: MIME_TYPES.binary,
          metadata: metadata
            ? {
                name: metadata.name || "",
                created: Date.now().toString(),
                sceneId: sceneId, // Store original sceneId for reference
              }
            : undefined,
        });

      if (error) {
        console.error('Supabase storage upload error:', error);

        // Check if it's a permission error
        if (error.message?.includes('violates row-level security')) {
          throw new Error('Storage permission denied. Please check Supabase Storage bucket policies.');
        } else if (error.message?.includes('You do not have permission')) {
          throw new Error('Storage permission denied. Please check your Supabase Storage bucket policies and ensure the user has proper access.');
        } else {
          throw error;
        }
      }

      console.log('Scene saved successfully to Supabase storage:', uniqueFileName);
      return uniqueFileName;
    } catch (error: any) {
      console.error("Error saving scene to Supabase storage:", error);
      throw error;
    }
  })();

  // Store the operation in the map and set up cleanup
  saveOperations.set(sceneId, saveOperation);
  cleanupSaveOperation(sceneId, saveOperation);

  // Return the result
  return await saveOperation;
};

// Function to save scene metadata to database (replaces existing scene with same name)
export const saveSceneMetadata = async (
  sceneId: string,
  encryptionKey: string,
  metadata: { name?: string; description?: string },
  userId?: string,
) => {
  const supabase = _getSupabase();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const currentUserId = userId || await _getCurrentUserId();

  if (!currentUserId) {
    throw new Error("User must be authenticated to save scene metadata");
  }

  const sceneName = metadata.name || `Scene ${sceneId}`;

  // Create a composite key for this metadata operation to prevent race conditions
  const operationKey = `${currentUserId}:${sceneName}`;

  // Check if a metadata save operation is already in progress for this key
  const existingOperation = metadataSaveOperations.get(operationKey);
  if (existingOperation) {
    console.log(`Metadata save operation already in progress for ${operationKey}, waiting...`);
    return await existingOperation;
  }

  // Create a new metadata save operation
  const metadataOperation = (async () => {
    try {
      // Check if a scene with this name already exists
      const { data: existingScene, error: checkError } = await supabase
        .from("scene_metadata")
        .select("scene_id")
        .eq("name", sceneName)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (checkError) {
        if (checkError.message?.includes('Results contain 2 rows')) {
          console.warn('PGRST116 error detected - duplicate records found. Please run fix-pgrst116-duplicates.sql to clean up the database.');
          throw new Error('Database contains duplicate records. Please run the database cleanup script (fix-pgrst116-duplicates.sql) to resolve this issue.');
        } else if (checkError.message?.includes('violates row-level security')) {
          throw new Error('Access denied. Please check your Supabase RLS policies.');
        } else if (checkError.message?.includes('relation') && error.message?.includes('does not exist')) {
          throw new Error('Database table missing. Please run the database migrations from supabase-diagnostics.sql');
        } else if (checkError.message?.includes('column') && error.message?.includes('does not exist')) {
          throw new Error('Database column missing. Please run the database migrations from supabase-diagnostics.sql');
        } else {
          throw checkError;
        }
      }

      if (existingScene) {
        // Update existing scene
        console.log('Updating existing scene:', sceneName);
        const { error: updateError } = await supabase!
          .from("scene_metadata")
          .update({
            scene_id: sceneId,
            encryption_key: encryptionKey,
            description: metadata.description || "",
            created_at: new Date().toISOString(),
          } as any)
          .eq("name", sceneName)
          .eq("user_id", currentUserId);

        if (updateError) {
          console.error('Error updating existing scene metadata:', updateError);
          throw updateError as Error;
        }
      } else {
        // Create new scene
        console.log('Creating new scene:', sceneName);
        const { error } = await supabase!
          .from("scene_metadata")
          .insert({
            scene_id: sceneId,
            encryption_key: encryptionKey,
            name: sceneName,
            description: metadata.description || "",
            user_id: currentUserId,
            created_at: new Date().toISOString(),
          } as any);

        if (error) {
          console.error('Error creating new scene metadata:', error);
          if (error.message?.includes('violates row-level security')) {
            throw new Error('Access denied. Please check your Supabase RLS policies.');
          } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database table missing. Please run the database migrations from supabase-diagnostics.sql');
          } else if (error.message?.includes('column') && error.message?.includes('does not exist')) {
            throw new Error('Database column missing. Please run the database migrations from supabase-diagnostics.sql');
          } else if (error.message?.includes('duplicate key value violates unique constraint')) {
            throw new Error('A scene with this name already exists. Please try a different name.');
          }
          throw error;
        }
      }
    } catch (error: any) {
      console.error("Error saving scene metadata:", error);
      throw error;
    }
  })();

  // Store the operation in the map and set up cleanup
  metadataSaveOperations.set(operationKey, metadataOperation);
  cleanupMetadataOperation(operationKey, metadataOperation);

  // Return the result
  return await metadataOperation;
};



// Function to list all exported scenes with metadata
export const listExportedScenes = async () => {
  const supabase = _getSupabase();
  if (!supabase) {
    console.warn("Supabase not configured - cannot list scenes");
    return [];
  }

  const userId = await _getCurrentUserId();

  if (!userId) {
    console.error("User must be authenticated to list scenes");
    return [];
  }

  try {
    const { data, error } = await supabase!
      .from("scene_metadata")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Return a simple flat list of scenes
    return data?.map((item: any) => ({
      id: item.scene_id as string,
      name: item.name as string,
      description: item.description as string,
      createdAt: item.created_at as string,
      encryptionKey: item.encryption_key as string,
      url: constructExcalidrawUrl(item.scene_id as string, item.encryption_key as string),
    })) || [];
  } catch (error: any) {
    console.error("Error listing exported scenes:", error);
    return [];
  }
};

// Function to load scene by ID (with metadata lookup)
export const loadSceneById = async (sceneId: string) => {
  const supabase = _getSupabase();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const userId = await _getCurrentUserId();

  if (!userId) {
    throw new Error("User must be authenticated to load scenes");
  }

  try {
    const { data: metadata, error } = await supabase!
      .from("scene_metadata")
      .select("*")
      .eq("scene_id", sceneId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error loading scene: ${error.message}`);
    }

    if (!metadata) {
      throw new Error("Scene not found");
    }

    const sceneData = await loadSceneFromSupabaseStorage(
      (metadata as any).scene_id,
      (metadata as any).encryption_key,
    );

    return {
      ...sceneData,
      metadata: {
        name: (metadata as any).name,
        description: (metadata as any).description,
        createdAt: (metadata as any).created_at,
      },
    };
  } catch (error: any) {
    console.error("Error loading scene by ID:", error);
    throw error;
  }
};

// Function to generate scene URL from Supabase storage
export const getSupabaseSceneUrl = async (sceneId: string): Promise<string> => {
  const supabase = _getSupabase();
  if (!supabase) {
    console.warn("Supabase not configured - cannot generate scene URL");
    return "";
  }

  try {
    // List files that start with the sceneId
    const { data: files, error: listError } = await supabase.storage
      .from("diagram-files")
      .list('files/shareLinks', {
        search: sceneId
      });

    if (listError || !files || files.length === 0) {
      console.warn(`No files found for scene ${sceneId}`);
      return "";
    }

    // Find the most recent file (by name, since we include timestamp)
    const latestFile = files
      .filter(file => file.name.startsWith(sceneId))
      .sort((a, b) => b.name.localeCompare(a.name))[0];

    if (!latestFile) {
      console.warn(`No valid files found for scene ${sceneId}`);
      return "";
    }

    const { data } = supabase.storage
      .from("diagram-files")
      .getPublicUrl(`files/shareLinks/${latestFile.name}`);

    return data.publicUrl;
  } catch (error) {
    console.warn(`Error generating scene URL for ${sceneId}:`, error);
    return "";
  }
};

// Function to construct Excalidraw URL from scene ID and encryption key
export const constructExcalidrawUrl = (sceneId: string, encryptionKey: string) => {
  return `http://localhost:3000#json=${sceneId},${encryptionKey}`;
};

// Function to delete a scene by ID
export const deleteSceneById = async (sceneId: string) => {
  const supabase = _getSupabase();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const userId = await _getCurrentUserId();

  if (!userId) {
    throw new Error("User must be authenticated to delete scenes");
  }

  try {
    // First, get the metadata to find the encryption key
    const { data: metadata, error: metadataError } = await supabase!
      .from("scene_metadata")
      .select("*")
      .eq("scene_id", sceneId)
      .eq("user_id", userId)
      .maybeSingle();

    if (metadataError) {
      throw new Error(`Error loading scene metadata: ${metadataError.message}`);
    }
    
    if (!metadata) {
      throw new Error("Scene not found");
    }

    // Delete from scene_metadata table
    const { error: deleteMetadataError } = await supabase!
      .from("scene_metadata")
      .delete()
      .eq("scene_id", sceneId)
      .eq("user_id", userId);

    if (deleteMetadataError) {
      throw deleteMetadataError;
    }

    // Delete all files from storage that start with the sceneId
    try {
      const { data: existingFiles } = await supabase.storage
        .from("diagram-files")
        .list('files/shareLinks', {
          search: sceneId
        });

      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles
          .filter(file => file.name.startsWith(sceneId))
          .map(file => `files/shareLinks/${file.name}`);

        if (filesToRemove.length > 0) {
          console.log(`Deleting ${filesToRemove.length} files for scene ${sceneId}`);
          const { error: deleteStorageError } = await supabase.storage
            .from("diagram-files")
            .remove(filesToRemove);

          if (deleteStorageError) {
            console.warn("Failed to delete scene files from storage:", deleteStorageError);
            // Don't throw here as the metadata and versions are already deleted
          }
        }
      }
    } catch (storageError) {
      console.warn("Error accessing storage during cleanup:", storageError);
      // Don't throw here as the metadata and versions are already deleted
    }

    return true;
  } catch (error: any) {
    console.error("Error deleting scene:", error);
    throw error;
  }
};

// Function to delete a scene by name
export const deleteSceneByName = async (sceneName: string) => {
  const supabase = _getSupabase();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const userId = await _getCurrentUserId();

  if (!userId) {
    throw new Error("User must be authenticated to delete scenes");
  }

  try {
    // Get the scene
    const { data: scene, error: fetchError } = await supabase!
      .from("scene_metadata")
      .select("scene_id")
      .eq("name", sceneName)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!scene) {
      throw new Error("Scene not found");
    }

    const sceneId = (scene as any).scene_id;

    // Delete from scene_metadata table
    const { error: deleteMetadataError } = await supabase!
      .from("scene_metadata")
      .delete()
      .eq("scene_id", sceneId)
      .eq("user_id", userId);

    if (deleteMetadataError) {
      throw deleteMetadataError;
    }

    // Delete all files from storage that start with the sceneId
    try {
      const { data: existingFiles } = await supabase.storage
        .from("diagram-files")
        .list('files/shareLinks', {
          search: sceneId
        });

      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles
          .filter(file => file.name.startsWith(sceneId))
          .map(file => `files/shareLinks/${file.name}`);

        if (filesToRemove.length > 0) {
          console.log(`Deleting ${filesToRemove.length} files for scene ${sceneName}`);
          const { error: deleteStorageError } = await supabase.storage
            .from("diagram-files")
            .remove(filesToRemove);

          if (deleteStorageError) {
            console.warn("Failed to delete scene files from storage:", deleteStorageError);
            // Don't throw here as the metadata is already deleted
          }
        }
      }
    } catch (storageError) {
      console.warn("Error accessing storage during cleanup:", storageError);
      // Don't throw here as the metadata is already deleted
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

  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  try {
    // List files that start with the sceneId
    const { data: files, error: listError } = await supabase.storage
      .from("diagram-files")
      .list('files/shareLinks', {
        search: sceneId
      });

    if (listError) {
      throw new Error(`Failed to list files for scene ${sceneId}: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      throw new Error(`No files found for scene ${sceneId}`);
    }

    // Find the most recent file (by name, since we include timestamp)
    const latestFile = files
      .filter(file => file.name.startsWith(sceneId))
      .sort((a, b) => b.name.localeCompare(a.name))[0];

    if (!latestFile) {
      throw new Error(`No valid files found for scene ${sceneId}`);
    }

    console.log(`Loading scene ${sceneId} from file: ${latestFile.name}`);

    const { data, error } = await supabase.storage
      .from("diagram-files")
      .download(`files/shareLinks/${latestFile.name}`);

    if (error || !data) {
      throw new Error(`Failed to load scene from Supabase storage: ${latestFile.name}`);
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
