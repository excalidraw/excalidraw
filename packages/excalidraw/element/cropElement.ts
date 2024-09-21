import { Point } from "points-on-curve";
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
import { TransformHandleType } from "./transformHandles";
import {
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

// i split out these 'internal' functions so that this functionality can be easily unit tested
const cropElementInternal = (
  element: ExcalidrawImageElement,
  transformHandle: TransformHandleType,
  pointerX: number,
  pointerY: number,
) => {
  const uncroppedWidth = element.widthAtCreation * element.resizedFactorX;
  const uncroppedHeight = element.heightAtCreation * element.resizedFactorY;

  const naturalWidthToUncropped = element.naturalWidth / uncroppedWidth;
  const naturalHeightToUncropped = element.naturalHeight / uncroppedHeight;

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
    width: element.naturalWidth,
    height: element.naturalHeight,
  };

  if (transformHandle.includes("n")) {
    const northBound = element.y - availableTopCropSpace;
    const southBound = element.y + element.height;

    pointerY = clamp(pointerY, northBound, southBound);

    const pointerDeltaY = pointerY - element.y;
    nextHeight = element.height - pointerDeltaY;

    crop.y =
      ((pointerDeltaY + croppedTop) / uncroppedHeight) * element.naturalHeight;
    crop.height = (nextHeight / uncroppedHeight) * element.naturalHeight;
  }

  if (transformHandle.includes("s")) {
    const northBound = element.y;
    const southBound = element.y + (uncroppedHeight - croppedTop);

    pointerY = clamp(pointerY, northBound, southBound);

    nextHeight = pointerY - element.y;
    crop.height = (nextHeight / uncroppedHeight) * element.naturalHeight;
  }

  if (transformHandle.includes("w")) {
    const eastBound = element.x + element.width;
    const westBound = element.x - availableLeftCropSpace;

    pointerX = clamp(pointerX, westBound, eastBound);

    const pointerDeltaX = pointerX - element.x;
    nextWidth = element.width - pointerDeltaX;

    crop.x =
      ((pointerDeltaX + croppedLeft) / uncroppedWidth) * element.naturalWidth;
    crop.width = (nextWidth / uncroppedWidth) * element.naturalWidth;
  }

  if (transformHandle.includes("e")) {
    const eastBound = element.x + (uncroppedWidth - croppedLeft);
    const westBound = element.x;

    pointerX = clamp(pointerX, westBound, eastBound);

    nextWidth = pointerX - element.x;
    crop.width = (nextWidth / uncroppedWidth) * element.naturalWidth;
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
  transformHandle: TransformHandleType,
  pointerX: number,
  pointerY: number,
) => {
  const mutation = cropElementInternal(
    element,
    transformHandle,
    pointerX,
    pointerY,
  );

  mutateElement(element, mutation);

  updateBoundElements(element, elementsMap, {
    oldSize: { width: element.width, height: element.height },
  });
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
  image: ExcalidrawImageElement,
  elementsMap: ElementsMap,
) => {
  if (image.crop) {
    const width = image.widthAtCreation * image.resizedFactorX;
    const height = image.heightAtCreation * image.resizedFactorY;

    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
      image,
      elementsMap,
    );

    const topLeftVector = vectorFromPoint(
      pointRotateRads(point(x1, y1), point(cx, cy), image.angle),
    );
    const topRightVector = vectorFromPoint(
      pointRotateRads(point(x2, y1), point(cx, cy), image.angle),
    );
    const topEdgeNormalized = vectorNormalize(
      vectorSubtract(topRightVector, topLeftVector),
    );
    const bottomLeftVector = vectorFromPoint(
      pointRotateRads(point(x1, y2), point(cx, cy), image.angle),
    );
    const leftEdgeVector = vectorSubtract(bottomLeftVector, topLeftVector);
    const leftEdgeNormalized = vectorNormalize(leftEdgeVector);

    const rotatedTopLeft = vectorAdd(
      vectorAdd(
        topLeftVector,
        vectorScale(
          topEdgeNormalized,
          (-image.crop.x * width) / image.naturalWidth,
        ),
      ),
      vectorScale(
        leftEdgeNormalized,
        (-image.crop.y * height) / image.naturalHeight,
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
      -image.angle as Radians,
    );

    const uncroppedElement: ExcalidrawImageElement = {
      ...image,
      x: unrotatedTopLeft[0],
      y: unrotatedTopLeft[1],
      width,
      height,
      crop: null,
    };

    return uncroppedElement;
  }

  return image;
};
