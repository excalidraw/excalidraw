// -----------------------------------------------------------------------------
// ExcalidrawImageElement helpers
// -----------------------------------------------------------------------------

import { AppClassProperties, AppState } from "../types";
import { isInitializedImageElement } from "./typeChecks";
import {
  ExcalidrawElement,
  FileId,
  InitializedExcalidrawImageElement,
} from "./types";

/** NOTE: updates cache even if already populated with given image. Thus,
 * you should filter out the images upstream if you want to optimize this. */
export const updateImageCache = async ({
  fileIds,
  files,
  imageCache,
}: {
  fileIds: FileId[];
  files: AppState["files"];
  imageCache: AppClassProperties["imageCache"];
}) => {
  const updatedFiles = new Map<FileId, true>();

  await Promise.all(
    fileIds.reduce((promises, fileId) => {
      const fileData = files[fileId as string];
      if (fileData && !updatedFiles.has(fileId)) {
        updatedFiles.set(fileId, true);
        return promises.concat(
          (async () => {
            const imagePromise = new Promise<HTMLImageElement>((resolve) => {
              const image = new Image();
              image.onload = () => {
                imageCache.set(fileId, image);
                resolve(image);
              };
              image.src = fileData.dataURL;
            });

            // TODO limit the size of the imageCache
            imageCache.set(fileId, imagePromise);
            await imagePromise;
          })(),
        );
      }
      return promises;
    }, [] as Promise<any>[]),
  );

  return { imageCache, updatedFiles };
};

export const getInitializedImageElements = (
  elements: readonly ExcalidrawElement[],
) =>
  elements.filter((element) =>
    isInitializedImageElement(element),
  ) as InitializedExcalidrawImageElement[];
