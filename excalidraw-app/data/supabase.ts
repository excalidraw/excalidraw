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
  const userId = await _getCurrentUserId();

  if (!userId) {
    console.warn("User must be authenticated to save collaborative scenes");
    return null;
  }

  try {
    // Note: diagrams table may not exist in current schema
    // This function is for collaborative editing which requires additional tables
    console.warn("Collaborative editing with Supabase is not available - diagrams table missing");

    // For now, return null to indicate collaborative save is not available
    // The scene will still be saved locally via localStorage
    // But we should still update the cache to prevent repeated save attempts
    if (socket) {
      SupabaseSceneVersionCache.set(socket, elements);
    }
    return null;
  } catch (error: any) {
    console.error("Error saving to Supabase:", error);
    // Don't throw error - let the local save continue
    return null;
  }
};

export const loadFromSupabase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const supabase = _getSupabase();
  const userId = await _getCurrentUserId();

  if (!userId) {
    console.warn("User must be authenticated to load collaborative scenes");
    return null;
  }

  try {
    // Note: diagrams table may not exist in current schema
    console.warn("Collaborative loading from Supabase is not available - diagrams table missing");

    // Return null to indicate collaborative load is not available
    return null;
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
  metadata?: { name?: string; version?: number },
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

      // First, try to remove any existing files with the same sceneId prefix to clean up old versions
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
            console.log(`Cleaning up ${filesToRemove.length} old versions for ${sceneId}`);
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
                version: metadata.version?.toString() || "2",
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

// Function to save scene metadata to database with branching versioning support
export const saveSceneMetadata = async (
  sceneId: string,
  encryptionKey: string,
  metadata: { name?: string; description?: string; isAutomatic?: boolean; currentVersion?: number },
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
  const currentVersion = metadata.currentVersion || 0;

  // Create a composite key for this metadata operation to prevent race conditions
  const operationKey = `${currentUserId}:${sceneName}:${currentVersion}:${metadata.isAutomatic ? 'auto' : 'manual'}`;

  // Check if a metadata save operation is already in progress for this key
  const existingOperation = metadataSaveOperations.get(operationKey);
  if (existingOperation) {
    console.log(`Metadata save operation already in progress for ${operationKey}, waiting...`);
    return await existingOperation;
  }

  // Create a new metadata save operation
  const metadataOperation = (async () => {
    try {
      if (metadata.isAutomatic) {
        // For automatic saves, update the "Latest" version of the current branch

      // Check if there's already a "Latest" version for this branch
      let existingLatest: any = null;
      let hasExistingRecord = false;
      
      try {
        const { data, error } = await supabase!
          .from("scene_metadata")
          .select("scene_id")
          .eq("name", sceneName)
          .eq("version", currentVersion)
          .eq("is_latest", true)
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (error) {
          // Handle PGRST116 error (multiple rows found) - this indicates duplicate data
          if (error.message?.includes('Results contain 2 rows')) {
            console.warn('PGRST116 error detected - duplicate records found. Please run fix-pgrst116-duplicates.sql to clean up the database.');
            throw new Error('Database contains duplicate records. Please run the database cleanup script (fix-pgrst116-duplicates.sql) to resolve this issue.');
          } else if (error.message?.includes('violates row-level security')) {
            throw new Error('Access denied. Please check your Supabase RLS policies.');
          } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database table missing. Please run the database migrations from supabase-diagnostics.sql');
          } else if (error.message?.includes('column') && error.message?.includes('does not exist')) {
            throw new Error('Database column missing. Please run the database migrations from supabase-diagnostics.sql');
          } else {
            throw error;
          }
        } else if (data) {
          existingLatest = data;
          hasExistingRecord = true;
        } else {
          console.log('No existing latest version found, will create new one');
        }
      } catch (error: any) {
        // Re-throw unexpected errors
        throw error;
      }

      // Log whether we found an existing record or not
      if (hasExistingRecord) {
        console.log('Found existing latest version, will update it');
      }

      if (hasExistingRecord) {
        // Update existing "Latest" version for this branch
        console.log('Updating existing latest version');
        const { error: updateError } = await supabase!
          .from("scene_metadata")
          .update({
            scene_id: sceneId,
            encryption_key: encryptionKey,
            description: metadata.description || "",
            created_at: new Date().toISOString(),
          })
          .eq("scene_id", (existingLatest as any).scene_id)
          .eq("user_id", currentUserId);

        if (updateError) {
          console.error('Error updating existing scene metadata:', updateError);
          throw updateError as Error;
        }
      } else {
        // Create new "Latest" version for this branch
        console.log('Creating new latest version');
        const { error } = await supabase!
          .from("scene_metadata")
          .insert({
            scene_id: sceneId,
            encryption_key: encryptionKey,
            name: sceneName,
            description: metadata.description || "",
            version: currentVersion,
            is_latest: true,
            is_automatic: true,
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
            throw new Error('A scene with this name already exists. Please try a different name or version.');
          }
          throw error;
        }
      }
    } else {
      // For manual exports, create a new version branch
      // Check if a scene with this name already exists (excluding automatic versions)
      const { data: existingScenes, error: checkError } = await supabase
        .from("scene_metadata")
        .select("version")
        .eq("name", sceneName)
        .eq("is_automatic", false)
        .eq("user_id", currentUserId)
        .order("version", { ascending: false });

      if (checkError) {
        throw checkError;
      }

      // Determine the next version number (only counting manual exports)
      const nextVersion = existingScenes && existingScenes.length > 0
        ? Math.max(...existingScenes.map((s: any) => s.version)) + 1
        : 1;

      // Insert the new manual version branch
      const { error } = await supabase!
        .from("scene_metadata")
        .insert({
          scene_id: sceneId,
          encryption_key: encryptionKey,
          name: sceneName,
          description: metadata.description || "",
          version: nextVersion,
          is_latest: false, // Manual exports create new branches, not latest
          is_automatic: false,
          user_id: currentUserId,
          created_at: new Date().toISOString(),
        } as any);

      if (error) {
        if (error.message?.includes('duplicate key value violates unique constraint')) {
          throw new Error('A scene with this name already exists. Please try a different name or version.');
        }
        throw error;
      }

      // Return the version number for manual exports
      return nextVersion;
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

// Function to save scene automatically (creates or replaces "latest" version for current branch)
export const saveSceneAutomatically = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  name: string,
  currentVersion: number = 0,
  userId?: string,
) => {
  if (!userId) {
    throw new Error("User must be authenticated to save scenes");
  }

  // Use a consistent scene ID based on the scene name and user ID to avoid creating multiple files
  // This ensures auto-saves update the same file instead of creating new ones
  const sceneId = `${userId}_${name.replace(/[^a-zA-Z0-9]/g, '_')}_auto`;
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
  }, userId);

  return sceneId;
};

// Function to list all exported scenes with metadata, grouped by name with branching versioning
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
        id: item.scene_id as string,
        name: item.name as string,
        description: item.description as string,
        createdAt: item.created_at as string,
        encryptionKey: item.encryption_key as string,
        version: item.version as number,
        isLatest: item.is_latest as boolean,
        isAutomatic: (item.is_automatic as boolean) || false,
        url: constructExcalidrawUrl(item.scene_id as string, item.encryption_key as string),
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
        version: (metadata as any).version,
        isLatest: (metadata as any).is_latest,
        isAutomatic: ((metadata as any).is_automatic as boolean) || false,
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
    // List files that start with the sceneId to find the latest version
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

// Function to delete all versions of a scene by name
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
    // Get all versions of the scene
    const { data: allVersions, error: fetchError } = await supabase!
      .from("scene_metadata")
      .select("scene_id")
      .eq("name", sceneName)
      .eq("user_id", userId);

    if (fetchError) {
      throw fetchError;
    }

    if (!allVersions || allVersions.length === 0) {
      throw new Error("Scene not found");
    }

    const sceneIds = allVersions.map((version: any) => version.scene_id);

    // Delete all versions from scene_metadata table
    const { error: deleteMetadataError } = await supabase!
      .from("scene_metadata")
      .delete()
      .in("scene_id", sceneIds)
      .eq("user_id", userId);

    if (deleteMetadataError) {
      throw deleteMetadataError;
    }

    // Delete all files from storage that start with any of the sceneIds
    try {
      const allFilesToRemove: string[] = [];

      for (const sceneId of sceneIds) {
        const { data: existingFiles } = await supabase.storage
          .from("diagram-files")
          .list('files/shareLinks', {
            search: sceneId
          });

        if (existingFiles && existingFiles.length > 0) {
          const filesForScene = existingFiles
            .filter(file => file.name.startsWith(sceneId))
            .map(file => `files/shareLinks/${file.name}`);
          allFilesToRemove.push(...filesForScene);
        }
      }

      if (allFilesToRemove.length > 0) {
        console.log(`Deleting ${allFilesToRemove.length} files for scene ${sceneName}`);
        const { error: deleteStorageError } = await supabase.storage
          .from("diagram-files")
          .remove(allFilesToRemove);

        if (deleteStorageError) {
          console.warn("Failed to delete some scene files from storage:", deleteStorageError);
          // Don't throw here as the metadata and versions are already deleted
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
    // List files that start with the sceneId to find the latest version
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
