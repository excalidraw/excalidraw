import {
  type Radians,
  pointFrom,
  pointRotateRads,
  vectorFromPoint,
  vectorNormalize,
  vectorSubtract,
  vectorAdd,
  vectorScale,
  pointFromVector,
  clamp,
  isCloseTo,
} from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";

import { elementCenterPoint, getElementAbsoluteCoords } from "./bounds";
import { getNextSingleWidthAndHeightFromPointer } from "./resizeElements";

import type { TransformHandleDirection } from "./transformHandles";
import type { ElementsMap, ExcalidrawImageElement, ImageCrop } from "./types";

export const MINIMAL_CROP_SIZE = 10;

/**
 * Crops the image (as it was at the drag's start) as resizing it would
 * resize it, as far as the image reaches.
 */
export const cropElement = (
  element: ExcalidrawImageElement,
  elementsMap: ElementsMap,
  transformHandle: TransformHandleDirection,
  naturalWidth: number,
  naturalHeight: number,
  pointerX: number,
  pointerY: number,
  {
    shouldMaintainAspectRatio = false,
    shouldResizeFromCenter = false,
  }: {
    shouldMaintainAspectRatio?: boolean;
    shouldResizeFromCenter?: boolean;
  } = {},
) => {
  const { width, height } = element;
  const { width: uncroppedWidth, height: uncroppedHeight } =
    getUncroppedWidthAndHeight(element);
  const { x: left, y: top } = getFlipAdjustedCropPosition(element) ?? {
    x: 0,
    y: 0,
  };

  let { nextWidth, nextHeight } = getNextSingleWidthAndHeightFromPointer(
    element,
    element,
    transformHandle,
    pointerX,
    pointerY,
    { shouldResizeFromCenter },
  );

  // what stays put, as a fraction of the size: the opposite side (0 or 1),
  // or the center (also of a side handle's other axis, which keeping the
  // aspect ratio changes)
  const anchorX =
    shouldResizeFromCenter || !/[ew]/.test(transformHandle)
      ? 0.5
      : transformHandle.includes("w")
      ? 1
      : 0;
  const anchorY =
    shouldResizeFromCenter || !/[ns]/.test(transformHandle)
      ? 0.5
      : transformHandle.includes("n")
      ? 1
      : 0;
  // as far as the image reaches from what stays put
  const getMaxSize = (
    anchor: number,
    offset: number,
    size: number,
    uncroppedSize: number,
  ) => {
    const before = offset + anchor * size;
    const after = uncroppedSize - before;
    return anchor === 0
      ? after
      : anchor === 1
      ? before
      : Math.min(before, after) * 2;
  };
  const maxWidth = getMaxSize(anchorX, left, width, uncroppedWidth);
  const maxHeight = getMaxSize(anchorY, top, height, uncroppedHeight);
  // (an image already smaller than the minimal size crops no smaller)
  const minWidth = Math.min(MINIMAL_CROP_SIZE, width);
  const minHeight = Math.min(MINIMAL_CROP_SIZE, height);

  if (shouldMaintainAspectRatio) {
    const ratio = width / height;
    // as resizing, by a side handle's axis, or the one a corner grows most —
    // but an axis dragged past what stays put has no size (rather than flips)
    nextWidth = clamp(
      transformHandle === "n" || transformHandle === "s"
        ? nextHeight * ratio
        : transformHandle === "e" || transformHandle === "w"
        ? nextWidth
        : Math.max(nextWidth, nextHeight * ratio),
      Math.max(minWidth, minHeight * ratio),
      Math.min(maxWidth, maxHeight * ratio),
    );
    nextHeight = nextWidth / ratio;
  } else {
    nextWidth = clamp(nextWidth, minWidth, maxWidth);
    nextHeight = clamp(nextHeight, minHeight, maxHeight);
  }

  const x1 = anchorX * (width - nextWidth);
  const y1 = anchorY * (height - nextHeight);

  return cropElementToBounds(
    element,
    elementsMap,
    naturalWidth,
    naturalHeight,
    [x1, y1, x1 + nextWidth, y1 + nextHeight],
  );
};

/**
 * Crops the image to `bounds`, relative to the element as shown (flipped).
 */
const cropElementToBounds = (
  element: ExcalidrawImageElement,
  elementsMap: ElementsMap,
  naturalWidth: number,
  naturalHeight: number,
  [x1, y1, x2, y2]: Bounds,
) => {
  // the image's natural pixels per element unit
  const scaleX = (element.crop?.width ?? naturalWidth) / element.width;
  const scaleY = (element.crop?.height ?? naturalHeight) / element.height;
  const width = x2 - x1;
  const height = y2 - y1;
  const [centerX, centerY] = pointRotateRads(
    pointFrom(element.x + (x1 + x2) / 2, element.y + (y1 + y2) / 2),
    elementCenterPoint(element, elementsMap),
    element.angle,
  );
  const crop = {
    x:
      (element.crop?.x ?? 0) +
      (element.scale[0] === -1 ? element.width - x2 : x1) * scaleX,
    y:
      (element.crop?.y ?? 0) +
      (element.scale[1] === -1 ? element.height - y2 : y1) * scaleY,
    width: width * scaleX,
    height: height * scaleY,
    naturalWidth,
    naturalHeight,
  };

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    // reset crop to null if we're back to orig size
    crop:
      isCloseTo(crop.width, naturalWidth) &&
      isCloseTo(crop.height, naturalHeight)
        ? null
        : crop,
  };
};

/**
 * Uncrops the image on the handle's side (a corner's two); mirrored, on the
 * opposite side(s) too.
 */
export const uncropElementSides = (
  element: ExcalidrawImageElement,
  elementsMap: ElementsMap,
  handle: TransformHandleDirection,
  mirrored = false,
) => {
  if (!element.crop) {
    return null;
  }
  const { width, height } = getUncroppedWidthAndHeight(element);
  const { x: left, y: top } = getFlipAdjustedCropPosition(element)!;
  const uncrops = (side: string, opposite: string) =>
    handle.includes(side) || (mirrored && handle.includes(opposite));

  return cropElementToBounds(
    element,
    elementsMap,
    element.crop.naturalWidth,
    element.crop.naturalHeight,
    [
      uncrops("w", "e") ? -left : 0,
      uncrops("n", "s") ? -top : 0,
      uncrops("e", "w") ? width - left : element.width,
      uncrops("s", "n") ? height - top : element.height,
    ],
  );
};

// refer to https://link.excalidraw.com/l/6rfy1007QOo/6stx5PmRn0k
export const getUncroppedImageElement = (
  element: ExcalidrawImageElement,
  elementsMap: ElementsMap,
) => {
  if (element.crop) {
    const { width, height } = getUncroppedWidthAndHeight(element);

    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
      element,
      elementsMap,
    );

    const topLeftVector = vectorFromPoint(
      pointRotateRads(pointFrom(x1, y1), pointFrom(cx, cy), element.angle),
    );
    const topRightVector = vectorFromPoint(
      pointRotateRads(pointFrom(x2, y1), pointFrom(cx, cy), element.angle),
    );
    const topEdgeNormalized = vectorNormalize(
      vectorSubtract(topRightVector, topLeftVector),
    );
    const bottomLeftVector = vectorFromPoint(
      pointRotateRads(pointFrom(x1, y2), pointFrom(cx, cy), element.angle),
    );
    const leftEdgeVector = vectorSubtract(bottomLeftVector, topLeftVector);
    const leftEdgeNormalized = vectorNormalize(leftEdgeVector);

    const { cropX, cropY } = adjustCropPosition(element.crop, element.scale);

    const rotatedTopLeft = vectorAdd(
      vectorAdd(
        topLeftVector,
        vectorScale(
          topEdgeNormalized,
          (-cropX * width) / element.crop.naturalWidth,
        ),
      ),
      vectorScale(
        leftEdgeNormalized,
        (-cropY * height) / element.crop.naturalHeight,
      ),
    );

    const center = pointFromVector(
      vectorAdd(
        vectorAdd(rotatedTopLeft, vectorScale(topEdgeNormalized, width / 2)),
        vectorScale(leftEdgeNormalized, height / 2),
      ),
    );

    const unrotatedTopLeft = pointRotateRads(
      pointFromVector(rotatedTopLeft),
      center,
      -element.angle as Radians,
    );

    const uncroppedElement: ExcalidrawImageElement = {
      ...element,
      x: unrotatedTopLeft[0],
      y: unrotatedTopLeft[1],
      width,
      height,
      crop: null,
    };

    return uncroppedElement;
  }

  return element;
};

export const getUncroppedWidthAndHeight = (element: ExcalidrawImageElement) => {
  if (element.crop) {
    const width =
      element.width / (element.crop.width / element.crop.naturalWidth);
    const height =
      element.height / (element.crop.height / element.crop.naturalHeight);

    return {
      width,
      height,
    };
  }

  return {
    width: element.width,
    height: element.height,
  };
};

const adjustCropPosition = (
  crop: ImageCrop,
  scale: ExcalidrawImageElement["scale"],
) => {
  let cropX = crop.x;
  let cropY = crop.y;

  const flipX = scale[0] === -1;
  const flipY = scale[1] === -1;

  if (flipX) {
    cropX = crop.naturalWidth - Math.abs(cropX) - crop.width;
  }

  if (flipY) {
    cropY = crop.naturalHeight - Math.abs(cropY) - crop.height;
  }

  return {
    cropX,
    cropY,
  };
};

export const getFlipAdjustedCropPosition = (
  element: ExcalidrawImageElement,
  natural = false,
) => {
  const crop = element.crop;
  if (!crop) {
    return null;
  }

  const isFlippedByX = element.scale[0] === -1;
  const isFlippedByY = element.scale[1] === -1;

  let cropX = crop.x;
  let cropY = crop.y;

  if (isFlippedByX) {
    cropX = crop.naturalWidth - crop.width - crop.x;
  }

  if (isFlippedByY) {
    cropY = crop.naturalHeight - crop.height - crop.y;
  }

  if (natural) {
    return {
      x: cropX,
      y: cropY,
    };
  }

  const { width, height } = getUncroppedWidthAndHeight(element);

  return {
    x: cropX / (crop.naturalWidth / width),
    y: cropY / (crop.naturalHeight / height),
  };
};
