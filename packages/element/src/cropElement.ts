import {
  type Radians,
  pointFrom,
  pointCenter,
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
import { type Point } from "points-on-curve";

import {
  elementCenterPoint,
  getElementAbsoluteCoords,
  getResizedElementAbsoluteCoords,
} from "./bounds";

import type { TransformHandleType } from "./transformHandles";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ImageCrop,
  NonDeleted,
} from "./types";

export const MINIMAL_CROP_SIZE = 10;

export const cropElement = (
  element: ExcalidrawImageElement,
  elementsMap: ElementsMap,
  transformHandle: TransformHandleType,
  naturalWidth: number,
  naturalHeight: number,
  pointerX: number,
  pointerY: number,
  widthAspectRatio?: number,
) => {
  const { width: uncroppedWidth, height: uncroppedHeight } =
    getUncroppedWidthAndHeight(element);

  const naturalWidthToUncropped = naturalWidth / uncroppedWidth;
  const naturalHeightToUncropped = naturalHeight / uncroppedHeight;

  const croppedLeft = (element.crop?.x ?? 0) / naturalWidthToUncropped;
  const croppedTop = (element.crop?.y ?? 0) / naturalHeightToUncropped;

  /**
   *      uncropped width
   * *––––––––––––––––––––––––*
   * |     (x,y) (natural)    |
   * |       *–––––––*        |
   * |       |///////| height | uncropped height
   * |       *–––––––*        |
   * |    width (natural)     |
   * *––––––––––––––––––––––––*
   */

  const rotatedPointer = pointRotateRads(
    pointFrom(pointerX, pointerY),
    elementCenterPoint(element, elementsMap),
    -element.angle as Radians,
  );

  pointerX = rotatedPointer[0];
  pointerY = rotatedPointer[1];

  let nextWidth = element.width;
  let nextHeight = element.height;

  let crop: ImageCrop | null = element.crop ?? {
    x: 0,
    y: 0,
    width: naturalWidth,
    height: naturalHeight,
    naturalWidth,
    naturalHeight,
  };

  const previousCropHeight = crop.height;
  const previousCropWidth = crop.width;

  const isFlippedByX = element.scale[0] === -1;
  const isFlippedByY = element.scale[1] === -1;

  let changeInHeight = pointerY - element.y;
  let changeInWidth = pointerX - element.x;

  if (transformHandle.includes("n")) {
    nextHeight = clamp(
      element.height - changeInHeight,
      MINIMAL_CROP_SIZE,
      isFlippedByY ? uncroppedHeight - croppedTop : element.height + croppedTop,
    );
  }

  if (transformHandle.includes("s")) {
    changeInHeight = pointerY - element.y - element.height;
    nextHeight = clamp(
      element.height + changeInHeight,
      MINIMAL_CROP_SIZE,
      isFlippedByY ? element.height + croppedTop : uncroppedHeight - croppedTop,
    );
  }

  if (transformHandle.includes("e")) {
    changeInWidth = pointerX - element.x - element.width;

    nextWidth = clamp(
      element.width + changeInWidth,
      MINIMAL_CROP_SIZE,
      isFlippedByX ? element.width + croppedLeft : uncroppedWidth - croppedLeft,
    );
  }

  if (transformHandle.includes("w")) {
    nextWidth = clamp(
      element.width - changeInWidth,
      MINIMAL_CROP_SIZE,
      isFlippedByX ? uncroppedWidth - croppedLeft : element.width + croppedLeft,
    );
  }

  const updateCropWidthAndHeight = (crop: ImageCrop) => {
    crop.height = nextHeight * naturalHeightToUncropped;
    crop.width = nextWidth * naturalWidthToUncropped;
  };

  updateCropWidthAndHeight(crop);

  const adjustFlipForHandle = (
    handle: TransformHandleType,
    crop: ImageCrop,
  ) => {
    updateCropWidthAndHeight(crop);
    if (handle.includes("n")) {
      if (!isFlippedByY) {
        crop.y += previousCropHeight - crop.height;
      }
    }
    if (handle.includes("s")) {
      if (isFlippedByY) {
        crop.y += previousCropHeight - crop.height;
      }
    }
    if (handle.includes("e")) {
      if (isFlippedByX) {
        crop.x += previousCropWidth - crop.width;
      }
    }
    if (handle.includes("w")) {
      if (!isFlippedByX) {
        crop.x += previousCropWidth - crop.width;
      }
    }
  };

  switch (transformHandle) {
    case "n": {
      if (widthAspectRatio) {
        const distanceToLeft = croppedLeft + element.width / 2;
        const distanceToRight =
          uncroppedWidth - croppedLeft - element.width / 2;

        const MAX_WIDTH = Math.min(distanceToLeft, distanceToRight) * 2;

        nextWidth = clamp(
          nextHeight * widthAspectRatio,
          MINIMAL_CROP_SIZE,
          MAX_WIDTH,
        );
        nextHeight = nextWidth / widthAspectRatio;
      }

      adjustFlipForHandle(transformHandle, crop);

      if (widthAspectRatio) {
        crop.x += (previousCropWidth - crop.width) / 2;
      }

      break;
    }
    case "s": {
      if (widthAspectRatio) {
        const distanceToLeft = croppedLeft + element.width / 2;
        const distanceToRight =
          uncroppedWidth - croppedLeft - element.width / 2;

        const MAX_WIDTH = Math.min(distanceToLeft, distanceToRight) * 2;

        nextWidth = clamp(
          nextHeight * widthAspectRatio,
          MINIMAL_CROP_SIZE,
          MAX_WIDTH,
        );
        nextHeight = nextWidth / widthAspectRatio;
      }

      adjustFlipForHandle(transformHandle, crop);

      if (widthAspectRatio) {
        crop.x += (previousCropWidth - crop.width) / 2;
      }

      break;
    }
    case "w": {
      if (widthAspectRatio) {
        const distanceToTop = croppedTop + element.height / 2;
        const distanceToBottom =
          uncroppedHeight - croppedTop - element.height / 2;

        const MAX_HEIGHT = Math.min(distanceToTop, distanceToBottom) * 2;

        nextHeight = clamp(
          nextWidth / widthAspectRatio,
          MINIMAL_CROP_SIZE,
          MAX_HEIGHT,
        );
        nextWidth = nextHeight * widthAspectRatio;
      }

      adjustFlipForHandle(transformHandle, crop);

      if (widthAspectRatio) {
        crop.y += (previousCropHeight - crop.height) / 2;
      }

      break;
    }
    case "e": {
      if (widthAspectRatio) {
        const distanceToTop = croppedTop + element.height / 2;
        const distanceToBottom =
          uncroppedHeight - croppedTop - element.height / 2;

        const MAX_HEIGHT = Math.min(distanceToTop, distanceToBottom) * 2;

        nextHeight = clamp(
          nextWidth / widthAspectRatio,
          MINIMAL_CROP_SIZE,
          MAX_HEIGHT,
        );
        nextWidth = nextHeight * widthAspectRatio;
      }

      adjustFlipForHandle(transformHandle, crop);

      if (widthAspectRatio) {
        crop.y += (previousCropHeight - crop.height) / 2;
      }

      break;
    }
    case "ne": {
      if (widthAspectRatio) {
        if (changeInWidth > -changeInHeight) {
          const MAX_HEIGHT = isFlippedByY
            ? uncroppedHeight - croppedTop
            : croppedTop + element.height;

          nextHeight = clamp(
            nextWidth / widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_HEIGHT,
          );
          nextWidth = nextHeight * widthAspectRatio;
        } else {
          const MAX_WIDTH = isFlippedByX
            ? croppedLeft + element.width
            : uncroppedWidth - croppedLeft;

          nextWidth = clamp(
            nextHeight * widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_WIDTH,
          );
          nextHeight = nextWidth / widthAspectRatio;
        }
      }

      adjustFlipForHandle(transformHandle, crop);
      break;
    }
    case "nw": {
      if (widthAspectRatio) {
        if (changeInWidth < changeInHeight) {
          const MAX_HEIGHT = isFlippedByY
            ? uncroppedHeight - croppedTop
            : croppedTop + element.height;
          nextHeight = clamp(
            nextWidth / widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_HEIGHT,
          );
          nextWidth = nextHeight * widthAspectRatio;
        } else {
          const MAX_WIDTH = isFlippedByX
            ? uncroppedWidth - croppedLeft
            : croppedLeft + element.width;

          nextWidth = clamp(
            nextHeight * widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_WIDTH,
          );
          nextHeight = nextWidth / widthAspectRatio;
        }
      }

      adjustFlipForHandle(transformHandle, crop);
      break;
    }
    case "se": {
      if (widthAspectRatio) {
        if (changeInWidth > changeInHeight) {
          const MAX_HEIGHT = isFlippedByY
            ? croppedTop + element.height
            : uncroppedHeight - croppedTop;

          nextHeight = clamp(
            nextWidth / widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_HEIGHT,
          );
          nextWidth = nextHeight * widthAspectRatio;
        } else {
          const MAX_WIDTH = isFlippedByX
            ? croppedLeft + element.width
            : uncroppedWidth - croppedLeft;

          nextWidth = clamp(
            nextHeight * widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_WIDTH,
          );
          nextHeight = nextWidth / widthAspectRatio;
        }
      }

      adjustFlipForHandle(transformHandle, crop);
      break;
    }
    case "sw": {
      if (widthAspectRatio) {
        if (-changeInWidth > changeInHeight) {
          const MAX_HEIGHT = isFlippedByY
            ? croppedTop + element.height
            : uncroppedHeight - croppedTop;

          nextHeight = clamp(
            nextWidth / widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_HEIGHT,
          );
          nextWidth = nextHeight * widthAspectRatio;
        } else {
          const MAX_WIDTH = isFlippedByX
            ? uncroppedWidth - croppedLeft
            : croppedLeft + element.width;

          nextWidth = clamp(
            nextHeight * widthAspectRatio,
            MINIMAL_CROP_SIZE,
            MAX_WIDTH,
          );
          nextHeight = nextWidth / widthAspectRatio;
        }
      }

      adjustFlipForHandle(transformHandle, crop);
      break;
    }
    default:
      break;
  }

  const newOrigin = recomputeOrigin(
    element,
    transformHandle,
    nextWidth,
    nextHeight,
    !!widthAspectRatio,
  );

  // reset crop to null if we're back to orig size
  if (
    isCloseTo(crop.width, crop.naturalWidth) &&
    isCloseTo(crop.height, crop.naturalHeight)
  ) {
    crop = null;
  }

  return {
    x: newOrigin[0],
    y: newOrigin[1],
    width: nextWidth,
    height: nextHeight,
    crop,
  };
};

const recomputeOrigin = (
  stateAtCropStart: NonDeleted<ExcalidrawElement>,
  transformHandle: TransformHandleType,
  width: number,
  height: number,
  shouldMaintainAspectRatio?: boolean,
) => {
  const [x1, y1, x2, y2] = getResizedElementAbsoluteCoords(
    stateAtCropStart,
    stateAtCropStart.width,
    stateAtCropStart.height,
    true,
  );
  const startTopLeft = pointFrom(x1, y1);
  const startBottomRight = pointFrom(x2, y2);
  const startCenter: any = pointCenter(startTopLeft, startBottomRight);

  const [newBoundsX1, newBoundsY1, newBoundsX2, newBoundsY2] =
    getResizedElementAbsoluteCoords(stateAtCropStart, width, height, true);
  const newBoundsWidth = newBoundsX2 - newBoundsX1;
  const newBoundsHeight = newBoundsY2 - newBoundsY1;

  // Calculate new topLeft based on fixed corner during resize
  let newTopLeft = [...startTopLeft] as [number, number];

  if (["n", "w", "nw"].includes(transformHandle)) {
    newTopLeft = [
      startBottomRight[0] - Math.abs(newBoundsWidth),
      startBottomRight[1] - Math.abs(newBoundsHeight),
    ];
  }
  if (transformHandle === "ne") {
    const bottomLeft = [startTopLeft[0], startBottomRight[1]];
    newTopLeft = [bottomLeft[0], bottomLeft[1] - Math.abs(newBoundsHeight)];
  }
  if (transformHandle === "sw") {
    const topRight = [startBottomRight[0], startTopLeft[1]];
    newTopLeft = [topRight[0] - Math.abs(newBoundsWidth), topRight[1]];
  }

  if (shouldMaintainAspectRatio) {
    if (["s", "n"].includes(transformHandle)) {
      newTopLeft[0] = startCenter[0] - newBoundsWidth / 2;
    }
    if (["e", "w"].includes(transformHandle)) {
      newTopLeft[1] = startCenter[1] - newBoundsHeight / 2;
    }
  }

  // adjust topLeft to new rotation point
  const angle = stateAtCropStart.angle;
  const rotatedTopLeft = pointRotateRads(newTopLeft, startCenter, angle);
  const newCenter: Point = [
    newTopLeft[0] + Math.abs(newBoundsWidth) / 2,
    newTopLeft[1] + Math.abs(newBoundsHeight) / 2,
  ];
  const rotatedNewCenter = pointRotateRads(newCenter, startCenter, angle);
  newTopLeft = pointRotateRads(
    rotatedTopLeft,
    rotatedNewCenter,
    -angle as Radians,
  );

  const newOrigin = [...newTopLeft];
  newOrigin[0] += stateAtCropStart.x - newBoundsX1;
  newOrigin[1] += stateAtCropStart.y - newBoundsY1;

  return newOrigin;
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
