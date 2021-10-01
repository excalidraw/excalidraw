// -----------------------------------------------------------------------------
// ExcalidrawImageElement helpers
// -----------------------------------------------------------------------------

import { invalidateShapeForElement } from "../renderer/renderElement";
import { AppState } from "../types";
import { isInitializedImageElement } from "./typeChecks";
import {
  ExcalidrawElement,
  ImageId,
  InitializedExcalidrawImageElement,
} from "./types";

/** NOTE: updates cache even if already populated with given image. Thus,
 * you should filter out the images upstream if you want to optimize this. */
export const updateImageCache = async ({
  imageElements,
  files,
  imageCache,
}: {
  imageElements: readonly InitializedExcalidrawImageElement[];
  files: AppState["files"];
  imageCache: Map<ImageId, HTMLImageElement>;
}) => {
  let didUpdate = false;

  await Promise.all(
    imageElements.reduce((promises, element) => {
      const imageData = files[element.imageId as string];
      if (imageData) {
        didUpdate = true;
        return promises.concat(
          (async () => {
            const image = await new Promise<HTMLImageElement>((resolve) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.src = imageData.dataURL;
            });

            // TODO limit the size of the imageCache
            imageCache.set(element.imageId, image);
            invalidateShapeForElement(element);
          })(),
        );
      }
      return promises;
    }, [] as Promise<any>[]),
  );

  return { imageCache, didUpdate };
};

export const getInitializedImageElements = (
  elements: readonly ExcalidrawElement[],
) =>
  elements.filter((element) =>
    isInitializedImageElement(element),
  ) as InitializedExcalidrawImageElement[];
