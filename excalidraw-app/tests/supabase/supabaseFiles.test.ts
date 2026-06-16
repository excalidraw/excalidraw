import { describe, expect, it, vi } from "vitest";

import type { FileId } from "@excalidraw/element/types";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

import { createSupabaseFileCallbacks } from "../../data/supabase/supabaseFiles";

import type { SupabaseClient } from "@supabase/supabase-js";

const USER_ID = "user-123";
// tiny valid PNG dataURL
const DATA_URL = "data:image/png;base64,iVBORw0KGgo=" as DataURL;

const makeFile = (id: string): BinaryFileData => ({
  id: id as FileId,
  dataURL: DATA_URL,
  mimeType: "image/png",
  created: 1_700_000_000_000,
});

/**
 * Build a mock supabase client whose `storage.from(...)` returns a bucket with
 * `upload`/`download` vi.fns. Mirrors the §F mock skeleton.
 */
const createClientMock = (overrides?: {
  uploadResult?: { data: any; error: any };
  downloadResult?: { data: any; error: any };
}) => {
  const storageBucket = {
    upload: vi.fn(() =>
      Promise.resolve(
        overrides?.uploadResult ?? { data: { path: "x" }, error: null },
      ),
    ),
    download: vi.fn(() =>
      Promise.resolve(
        overrides?.downloadResult ?? {
          data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
          error: null,
        },
      ),
    ),
  };
  const storageFrom = vi.fn(() => storageBucket);
  const client = {
    storage: { from: storageFrom },
  } as unknown as SupabaseClient;
  return { client, storageFrom, storageBucket };
};

describe("supabaseFiles", () => {
  describe("saveFiles", () => {
    it("uploads each added file to the userId/fileId path and returns it in savedFiles", async () => {
      const { client, storageFrom, storageBucket } = createClientMock();
      const { saveFiles } = createSupabaseFileCallbacks(client, USER_ID);

      const file = makeFile("file-a");
      const addedFiles = new Map<FileId, BinaryFileData>([[file.id, file]]);

      const { savedFiles, erroredFiles } = await saveFiles({ addedFiles });

      expect(storageFrom).toHaveBeenCalledWith("scene-files");
      expect(storageBucket.upload).toHaveBeenCalledWith(
        `${USER_ID}/${file.id}`,
        expect.any(Blob),
        expect.objectContaining({ upsert: true, contentType: "image/png" }),
      );
      expect(savedFiles.get(file.id)).toBe(file);
      expect(erroredFiles.size).toBe(0);
    });

    it("puts the file into erroredFiles (as BinaryFileData) on upload error", async () => {
      const { client } = createClientMock({
        uploadResult: { data: null, error: new Error("boom") },
      });
      const { saveFiles } = createSupabaseFileCallbacks(client, USER_ID);

      const file = makeFile("file-err");
      const addedFiles = new Map<FileId, BinaryFileData>([[file.id, file]]);

      const { savedFiles, erroredFiles } = await saveFiles({ addedFiles });

      expect(savedFiles.size).toBe(0);
      // value type is BinaryFileData, NOT `true`
      expect(erroredFiles.get(file.id)).toBe(file);
      expect(erroredFiles.get(file.id)).not.toBe(true);
    });
  });

  describe("getFiles", () => {
    it("downloads from the userId/id path and reconstructs a BinaryFileData with required fields", async () => {
      const { client, storageFrom, storageBucket } = createClientMock();
      const { getFiles } = createSupabaseFileCallbacks(client, USER_ID);

      const id = "file-dl" as FileId;
      const { loadedFiles, erroredFiles } = await getFiles([id]);

      expect(storageFrom).toHaveBeenCalledWith("scene-files");
      expect(storageBucket.download).toHaveBeenCalledWith(`${USER_ID}/${id}`);

      expect(erroredFiles.size).toBe(0);
      expect(loadedFiles).toHaveLength(1);
      const reconstructed = loadedFiles[0];
      expect(reconstructed.id).toBe(id);
      expect(reconstructed.dataURL).toMatch(/^data:/);
      expect(reconstructed.mimeType).toBe("image/png");
      expect(typeof reconstructed.created).toBe("number");
      expect(typeof reconstructed.lastRetrieved).toBe("number");
    });

    it("puts the id into erroredFiles as `true` on download error", async () => {
      const { client } = createClientMock({
        downloadResult: { data: null, error: new Error("not found") },
      });
      const { getFiles } = createSupabaseFileCallbacks(client, USER_ID);

      const id = "file-missing" as FileId;
      const { loadedFiles, erroredFiles } = await getFiles([id]);

      expect(loadedFiles).toHaveLength(0);
      expect(erroredFiles.get(id)).toBe(true);
    });
  });
});
