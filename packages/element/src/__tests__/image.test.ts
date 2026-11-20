import { MIME_TYPES } from "@excalidraw/common";

import type { BinaryFiles, DataURL } from "@excalidraw/excalidraw/types";

import { updateImageCache } from "../image";

import type { FileId } from "../types";

describe("updateImageCache", () => {
  const fileId = "test-image" as FileId;

  const createFiles = (
    mimeType: typeof MIME_TYPES.png | typeof MIME_TYPES.binary = MIME_TYPES.png,
  ): BinaryFiles => ({
    [fileId]: {
      id: fileId,
      mimeType,
      dataURL: "data:image/png;base64,test" as DataURL,
      created: 1,
    },
  });

  const createMockImage = () => {
    const image = {
      onload: null as ((event: Event) => void) | null,
      onerror: null as ((event: string | Event) => void) | null,
      src: "",
    } as HTMLImageElement;

    return image;
  };

  it("should cache an image after it loads successfully", async () => {
    const image = createMockImage();
    const imageCache = new Map();

    const resultPromise = updateImageCache({
      fileIds: [fileId],
      files: createFiles(),
      imageCache,
      createImage: () => image,
    });

    image.onload?.(new Event("load"));

    const result = await resultPromise;

    expect(result.updatedFiles.has(fileId)).toBe(true);
    expect(result.erroredFiles.has(fileId)).toBe(false);
    expect(imageCache.get(fileId)).toEqual({
      image,
      mimeType: MIME_TYPES.png,
    });
  });

  it("should record an image loading failure without rejecting", async () => {
    const image = createMockImage();
    const imageCache = new Map();

    const resultPromise = updateImageCache({
      fileIds: [fileId],
      files: createFiles(),
      imageCache,
      createImage: () => image,
    });

    image.onerror?.(new Event("error"));

    const result = await resultPromise;

    expect(result.updatedFiles.has(fileId)).toBe(true);
    expect(result.erroredFiles.has(fileId)).toBe(true);
    expect(imageCache.has(fileId)).toBe(true);
  });

  it("should record binary files as errors", async () => {
    const imageCache = new Map();

    const result = await updateImageCache({
      fileIds: [fileId],
      files: createFiles(MIME_TYPES.binary),
      imageCache,
      createImage: () => createMockImage(),
    });

    expect(result.updatedFiles.has(fileId)).toBe(true);
    expect(result.erroredFiles.has(fileId)).toBe(true);
    expect(imageCache.has(fileId)).toBe(false);
  });
});
