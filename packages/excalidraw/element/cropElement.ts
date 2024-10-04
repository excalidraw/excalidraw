import { type Point } from "points-on-curve";
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
} from "../../math";
import { updateBoundElements } from "./binding";
import { mutateElement } from "./mutateElement";
import type { TransformHandleType } from "./transformHandles";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ImageCrop,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "./types";
import {
  getElementAbsoluteCoords,
  getResizedElementAbsoluteCoords,
} from "./bounds";
import type { AppClassProperties } from "../types";
import { isInitializedImageElement } from "./typeChecks";

const _cropElement = (
  element: ExcalidrawImageElement,
  image: HTMLImageElement,
  transformHandle: TransformHandleType,
  naturalWidth: number,
  naturalHeight: number,
  pointerX: number,
  pointerY: number,
) => {
  const uncroppedWidth =
    element.width /
    (element.crop ? element.crop.width / image.naturalWidth : 1);
  const uncroppedHeight =
    element.height /
    (element.crop ? element.crop.height / image.naturalHeight : 1);

  const naturalWidthToUncropped = naturalWidth / uncroppedWidth;
  const naturalHeightToUncropped = naturalHeight / uncroppedHeight;

  const croppedLeft = (element.crop?.x ?? 0) / naturalWidthToUncropped;
  const croppedTop = (element.crop?.y ?? 0) / naturalHeightToUncropped;

  /**
   * uncropped width
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
    pointFrom(element.x + element.width / 2, element.y + element.height / 2),
    -element.angle as Radians,
  );

  pointerX = rotatedPointer[0];
  pointerY = rotatedPointer[1];

  let nextWidth = element.width;
  let nextHeight = element.height;
  const crop = element.crop ?? {
    x: 0,
    y: 0,
    width: naturalWidth,
    height: naturalHeight,
  };

  const previousCropHeight = crop.height;
  const previousCropWidth = crop.width;

  const isFlippedByX = element.scale[0] === -1;
  const isFlippedByY = element.scale[1] === -1;

  if (transformHandle.includes("n")) {
    const pointerDeltaY = pointerY - element.y;
    nextHeight = clamp(
      element.height - pointerDeltaY,
      1,
      isFlippedByY ? uncroppedHeight - croppedTop : element.height + croppedTop,
    );
    crop.height = (nextHeight / uncroppedHeight) * naturalHeight;

    if (!isFlippedByY) {
      crop.y = crop.y + (previousCropHeight - crop.height);
    }
  } else if (transformHandle.includes("s")) {
    nextHeight = clamp(
      pointerY - element.y,
      1,
      isFlippedByY ? element.height + croppedTop : uncroppedHeight - croppedTop,
    );
    crop.height = (nextHeight / uncroppedHeight) * naturalHeight;

    if (isFlippedByY) {
      const changeInCropHeight = previousCropHeight - crop.height;
      crop.y += changeInCropHeight;
    }
  }

  if (transformHandle.includes("w")) {
    const pointerDeltaX = pointerX - element.x;

    nextWidth = clamp(
      element.width - pointerDeltaX,
      1,
      isFlippedByX ? uncroppedWidth - croppedLeft : element.width + croppedLeft,
    );

    crop.width = (nextWidth / uncroppedWidth) * naturalWidth;

    if (!isFlippedByX) {
      crop.x += previousCropWidth - crop.width;
    }
  } else if (transformHandle.includes("e")) {
    nextWidth = clamp(
      pointerX - element.x,
      1,
      isFlippedByX ? element.width + croppedLeft : uncroppedWidth - croppedLeft,
    );
    crop.width = nextWidth * naturalWidthToUncropped;
    if (isFlippedByX) {
      const changeInCropWidth = previousCropWidth - crop.width;
      crop.x += changeInCropWidth;
    }
  }

  const newOrigin = recomputeOrigin(
    element,
    transformHandle,
    nextWidth,
    nextHeight,
  );

  return {
    x: newOrigin[0],
    y: newOrigin[1],
    width: nextWidth,
    height: nextHeight,
    crop,
  };
};

export const cropElement = (
  element: ExcalidrawImageElement,
  elementsMap: NonDeletedSceneElementsMap,
  imageCache: AppClassProperties["imageCache"],
  transformHandle: TransformHandleType,
  pointerX: number,
  pointerY: number,
) => {
  const image =
    isInitializedImageElement(element) && imageCache.get(element.fileId)?.image;

  if (image && !(image instanceof Promise)) {
    const mutation = _cropElement(
      element,
      image,
      transformHandle,
      image.naturalWidth,
      image.naturalHeight,
      pointerX,
      pointerY,
    );

    mutateElement(element, mutation);

    updateBoundElements(element, elementsMap, {
      oldSize: { width: element.width, height: element.height },
    });
  }
};

// TODO: replace with the refactored resizeSingleElement
const recomputeOrigin = (
  stateAtCropStart: NonDeleted<ExcalidrawElement>,
  transformHandle: TransformHandleType,
  width: number,
  height: number,
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

export const getUncroppedImageElement = (
  element: ExcalidrawImageElement,
  elementsMap: ElementsMap,
  imageCache: AppClassProperties["imageCache"],
) => {
  const image =
    isInitializedImageElement(element) && imageCache.get(element.fileId)?.image;

  if (image && !(image instanceof Promise)) {
    if (element.crop) {
      const width = element.width / (element.crop.width / image.naturalWidth);
      const height =
        element.height / (element.crop.height / image.naturalHeight);

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

      const { cropX, cropY } = adjustCropPosition(
        element.crop,
        element.scale,
        image,
      );

      const rotatedTopLeft = vectorAdd(
        vectorAdd(
          topLeftVector,
          vectorScale(topEdgeNormalized, (-cropX * width) / image.naturalWidth),
        ),
        vectorScale(
          leftEdgeNormalized,
          (-cropY * height) / image.naturalHeight,
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
  }

  return element;
};

const adjustCropPosition = (
  crop: ImageCrop,
  scale: ExcalidrawImageElement["scale"],
  image: HTMLImageElement,
) => {
  let cropX = crop.x;
  let cropY = crop.y;

  const flipX = scale[0] === -1;
  const flipY = scale[1] === -1;

  if (flipX) {
    cropX = image.naturalWidth - Math.abs(cropX) - crop.width;
  }

  if (flipY) {
    cropY = image.naturalHeight - Math.abs(cropY) - crop.height;
  }

  return {
    cropX,
    cropY,
  };
};
