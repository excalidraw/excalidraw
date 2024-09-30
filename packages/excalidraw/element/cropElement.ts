import { type Point } from "points-on-curve";
import {
  type Radians,
  point,
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

  const availableTopCropSpace = croppedTop;
  const availableLeftCropSpace = croppedLeft;

  const rotatedPointer = pointRotateRads(
    point(pointerX, pointerY),
    point(element.x + element.width / 2, element.y + element.height / 2),
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

  if (transformHandle.includes("n")) {
    const northBound = element.y - availableTopCropSpace;
    const southBound = element.y + element.height;

    pointerY = clamp(pointerY, northBound, southBound);

    const pointerDeltaY = pointerY - element.y;
    nextHeight = Math.max(element.height - pointerDeltaY, 1);

    crop.y = ((pointerDeltaY + croppedTop) / uncroppedHeight) * naturalHeight;
    crop.height = (nextHeight / uncroppedHeight) * naturalHeight;
  }

  if (transformHandle.includes("s")) {
    const northBound = element.y;
    const southBound = element.y + (uncroppedHeight - croppedTop);

    pointerY = clamp(pointerY, northBound, southBound);

    nextHeight = Math.max(pointerY - element.y, 1);
    crop.height = (nextHeight / uncroppedHeight) * naturalHeight;
  }

  if (transformHandle.includes("w")) {
    const eastBound = element.x + element.width;
    const westBound = element.x - availableLeftCropSpace;

    pointerX = clamp(pointerX, westBound, eastBound);

    const pointerDeltaX = pointerX - element.x;
    nextWidth = Math.max(element.width - pointerDeltaX, 1);

    crop.x = ((pointerDeltaX + croppedLeft) / uncroppedWidth) * naturalWidth;
    crop.width = (nextWidth / uncroppedWidth) * naturalWidth;
  }

  if (transformHandle.includes("e")) {
    const eastBound = element.x + (uncroppedWidth - croppedLeft);
    const westBound = element.x;

    pointerX = clamp(pointerX, westBound, eastBound);

    nextWidth = Math.max(pointerX - element.x, 1);
    crop.width = (nextWidth / uncroppedWidth) * naturalWidth;
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
  const startTopLeft = point(x1, y1);
  const startBottomRight = point(x2, y2);
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
        pointRotateRads(point(x1, y1), point(cx, cy), element.angle),
      );
      const topRightVector = vectorFromPoint(
        pointRotateRads(point(x2, y1), point(cx, cy), element.angle),
      );
      const topEdgeNormalized = vectorNormalize(
        vectorSubtract(topRightVector, topLeftVector),
      );
      const bottomLeftVector = vectorFromPoint(
        pointRotateRads(point(x1, y2), point(cx, cy), element.angle),
      );
      const leftEdgeVector = vectorSubtract(bottomLeftVector, topLeftVector);
      const leftEdgeNormalized = vectorNormalize(leftEdgeVector);

      const rotatedTopLeft = vectorAdd(
        vectorAdd(
          topLeftVector,
          vectorScale(
            topEdgeNormalized,
            (-element.crop.x * width) / image.naturalWidth,
          ),
        ),
        vectorScale(
          leftEdgeNormalized,
          (-element.crop.y * height) / image.naturalHeight,
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
