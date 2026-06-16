import { MIME_TYPES } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

import { FileManager } from "../FileManager";
import { FileStatusStore } from "../fileStatusStore";

import type { SupabaseClient } from "@supabase/supabase-js";

const SCENE_FILES_BUCKET = "scene-files";

/**
 * Storage object path for a given file. The leading `${userId}/` segment is
 * exactly what the Storage RLS policy matches
 * (`(storage.foldername(name))[1] = auth.uid()::text`).
 */
const filePath = (userId: string, fileId: FileId) => `${userId}/${fileId}`;

/**
 * Decode a `data:` URL into a Blob. Implemented via `atob` + `Uint8Array`
 * (rather than `fetch(dataURL)`) so it works under jsdom, which does not
 * support fetching `data:` URLs. No existing shared util fits (the closest is
 * `encodeFilesForUpload`, which compresses + encrypts the dataURL string).
 */
export const dataURLToBlob = (dataURL: string): Blob => {
  const commaIndex = dataURL.indexOf(",");
  const header = commaIndex === -1 ? "" : dataURL.slice(0, commaIndex);
  const body = commaIndex === -1 ? dataURL : dataURL.slice(commaIndex + 1);

  const mimeMatch = header.match(/^data:([^;,]*)/);
  const mimeType = mimeMatch?.[1] || "";

  if (/;base64/i.test(header)) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  // non-base64 (rare) — the body is URL-encoded text
  return new Blob([decodeURIComponent(body)], { type: mimeType });
};

/** Read a Blob back into a `data:` URL via `FileReader`. */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export interface SupabaseFileCallbacks {
  getFiles: (fileIds: FileId[]) => Promise<{
    loadedFiles: BinaryFileData[];
    erroredFiles: Map<FileId, true>;
  }>;
  saveFiles: (data: { addedFiles: Map<FileId, BinaryFileData> }) => Promise<{
    savedFiles: Map<FileId, BinaryFileData>;
    erroredFiles: Map<FileId, BinaryFileData>;
  }>;
}

/**
 * The two injected Storage-I/O callbacks consumed by `new FileManager(...)`,
 * produced by a factory that closes over `userId`. Mirrors Collab's
 * composition (no subclassing) and matches the FileManager injected contract
 * exactly — note the two `erroredFiles` value types differ (`true` on read,
 * `BinaryFileData` on write).
 */
export const createSupabaseFileCallbacks = (
  client: SupabaseClient,
  userId: string,
): SupabaseFileCallbacks => {
  const saveFiles: SupabaseFileCallbacks["saveFiles"] = async ({
    addedFiles,
  }) => {
    const savedFiles = new Map<FileId, BinaryFileData>();
    const erroredFiles = new Map<FileId, BinaryFileData>();

    await Promise.all(
      [...addedFiles].map(async ([fileId, fileData]) => {
        try {
          const blob = dataURLToBlob(fileData.dataURL);
          const { error } = await client.storage
            .from(SCENE_FILES_BUCKET)
            .upload(filePath(userId, fileId), blob, {
              upsert: true,
              contentType: fileData.mimeType,
            });
          if (error) {
            throw error;
          }
          savedFiles.set(fileId, fileData);
        } catch {
          // per-file failure → erroredFiles (value is the file data, NOT true)
          erroredFiles.set(fileId, fileData);
        }
      }),
    );

    return { savedFiles, erroredFiles };
  };

  const getFiles: SupabaseFileCallbacks["getFiles"] = async (fileIds) => {
    const loadedFiles: BinaryFileData[] = [];
    const erroredFiles = new Map<FileId, true>();

    await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const { data: blob, error } = await client.storage
            .from(SCENE_FILES_BUCKET)
            .download(filePath(userId, fileId));
          if (error || !blob) {
            throw error ?? new Error("missing file");
          }
          const dataURL = (await blobToDataURL(blob)) as DataURL;
          loadedFiles.push({
            id: fileId,
            dataURL,
            mimeType: (blob.type ||
              MIME_TYPES.binary) as BinaryFileData["mimeType"],
            created: Date.now(),
            lastRetrieved: Date.now(),
          });
        } catch {
          // value type is `true` on read (NOT BinaryFileData)
          erroredFiles.set(fileId, true);
        }
      }),
    );

    return { loadedFiles, erroredFiles };
  };

  return { getFiles, saveFiles };
};

/**
 * Convenience: a composed `FileManager` wired with the Supabase callbacks +
 * `FileStatusStore.updateStatuses` so image-loading status renders correctly
 * (mirrors `Collab.tsx`'s construction).
 */
export const createSupabaseFileManager = (
  client: SupabaseClient,
  userId: string,
): FileManager =>
  new FileManager({
    onFileStatusChange: FileStatusStore.updateStatuses.bind(FileStatusStore),
    ...createSupabaseFileCallbacks(client, userId),
  });
