import {
  BOUND_TEXT_PADDING,
  MIN_FONT_SIZE,
  SHIFT_LOCKING_ANGLE,
} from "../constants";
import { rescalePoints } from "../points";

import { rotate, centerPoint, rotatePoint } from "../math";
import type {
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  ExcalidrawElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawImageElement,
  ElementsMap,
} from "./types";
import type { Mutable } from "../utility-types";
import {
  getElementAbsoluteCoords,
  getCommonBounds,
  getResizedElementAbsoluteCoords,
  getCommonBoundingBox,
} from "./bounds";
import {
  isArrowElement,
  isBoundToContainer,
  isFrameLikeElement,
  isFreeDrawElement,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import { mutateElement } from "./mutateElement";
import { getFontString } from "../utils";
import { updateBoundElements } from "./binding";
import type {
  MaybeTransformHandleType,
  TransformHandleDirection,
} from "./transformHandles";
import type { Point, PointerDownState } from "../types";
import Scene from "../scene/Scene";
import {
  getApproxMinLineWidth,
  getBoundTextElement,
  getBoundTextElementId,
  getContainerElement,
  handleBindTextResize,
  getBoundTextMaxWidth,
  getApproxMinLineHeight,
  wrapText,
  measureText,
  getMinCharWidth,
} from "./textElement";
import { LinearElementEditor } from "./linearElementEditor";
import { isInGroup } from "../groups";

export const normalizeAngle = (angle: number): number => {
  if (angle < 0) {
    return angle + 2 * Math.PI;
  }
  if (angle >= 2 * Math.PI) {
    return angle - 2 * Math.PI;
  }
  return angle;
};

// Returns true when transform (resizing/rotation) happened
export const transformElements = (
  originalElements: PointerDownState["originalElements"],
  transformHandleType: MaybeTransformHandleType,
  selectedElements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  shouldRotateWithDiscreteAngle: boolean,
  shouldResizeFromCenter: boolean,
  shouldMaintainAspectRatio: boolean,
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
) => {
  if (selectedElements.length === 1) {
    const [element] = selectedElements;
    if (transformHandleType === "rotation") {
      rotateSingleElement(
        element,
        elementsMap,
        pointerX,
        pointerY,
        shouldRotateWithDiscreteAngle,
      );
      updateBoundElements(element, elementsMap);
    } else if (isTextElement(element) && transformHandleType) {
      resizeSingleTextElement(
        originalElements,
        element,
        elementsMap,
        transformHandleType,
        shouldResizeFromCenter,
        pointerX,
        pointerY,
      );
      updateBoundElements(element, elementsMap);
    } else if (transformHandleType) {
      resizeSingleElement(
        originalElements,
        shouldMaintainAspectRatio,
        element,
        elementsMap,
        transformHandleType,
        shouldResizeFromCenter,
        pointerX,
        pointerY,
      );
    }

    return true;
  } else if (selectedElements.length > 1) {
    if (transformHandleType === "rotation") {
      rotateMultipleElements(
        originalElements,
        selectedElements,
        elementsMap,
        pointerX,
        pointerY,
        shouldRotateWithDiscreteAngle,
        centerX,
        centerY,
      );
      return true;
    } else if (transformHandleType) {
      resizeMultipleElements(
        originalElements,
        selectedElements,
        elementsMap,
        transformHandleType,
        shouldResizeFromCenter,
        shouldMaintainAspectRatio,
        pointerX,
        pointerY,
      );
      return true;
    }
  }
  return false;
};

const rotateSingleElement = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  pointerX: number,
  pointerY: number,
  shouldRotateWithDiscreteAngle: boolean,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  let angle: number;
  if (isFrameLikeElement(element)) {
    angle = 0;
  } else {
    angle = (5 * Math.PI) / 2 + Math.atan2(pointerY - cy, pointerX - cx);
    if (shouldRotateWithDiscreteAngle) {
      angle += SHIFT_LOCKING_ANGLE / 2;
      angle -= angle % SHIFT_LOCKING_ANGLE;
    }
    angle = normalizeAngle(angle);
  }
  const boundTextElementId = getBoundTextElementId(element);

  mutateElement(element, { angle });
  if (boundTextElementId) {
    const textElement =
      Scene.getScene(element)?.getElement<ExcalidrawTextElementWithContainer>(
        boundTextElementId,
      );

    if (textElement && !isArrowElement(element)) {
      mutateElement(textElement, { angle });
    }
  }
};

const rescalePointsInElement = (
  element: NonDeletedExcalidrawElement,
  width: number,
  height: number,
  normalizePoints: boolean,
) =>
  isLinearElement(element) || isFreeDrawElement(element)
    ? {
        points: rescalePoints(
          0,
          width,
          rescalePoints(1, height, element.points, normalizePoints),
          normalizePoints,
        ),
      }
    : {};

const measureFontSizeFromWidth = (
  element: NonDeleted<ExcalidrawTextElement>,
  elementsMap: ElementsMap,
  nextWidth: number,
): { size: number } | null => {
  // We only use width to scale font on resize
  let width = element.width;

  const hasContainer = isBoundToContainer(element);
  if (hasContainer) {
    const container = getContainerElement(element, elementsMap);
    if (container) {
      width = getBoundTextMaxWidth(container, element);
    }
  }
  const nextFontSize = element.fontSize * (nextWidth / width);
  if (nextFontSize < MIN_FONT_SIZE) {
    return null;
  }

  return {
    size: nextFontSize,
  };
};

const resizeSingleTextElement = (
  originalElements: PointerDownState["originalElements"],
  element: NonDeleted<ExcalidrawTextElement>,
  elementsMap: ElementsMap,
  transformHandleType: TransformHandleDirection,
  shouldResizeFromCenter: boolean,
  pointerX: number,
  pointerY: number,
) => {
  const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap,
  );
  // rotation pointer with reverse angle
  const [rotatedX, rotatedY] = rotate(
    pointerX,
    pointerY,
    cx,
    cy,
    -element.angle,
  );
  let scaleX = 0;
  let scaleY = 0;

  if (transformHandleType !== "e" && transformHandleType !== "w") {
    if (transformHandleType.includes("e")) {
      scaleX = (rotatedX - x1) / (x2 - x1);
    }
    if (transformHandleType.includes("w")) {
      scaleX = (x2 - rotatedX) / (x2 - x1);
    }
    if (transformHandleType.includes("n")) {
      scaleY = (y2 - rotatedY) / (y2 - y1);
    }
    if (transformHandleType.includes("s")) {
      scaleY = (rotatedY - y1) / (y2 - y1);
    }
  }

  const scale = Math.max(scaleX, scaleY);

  if (scale > 0) {
    const nextWidth = element.width * scale;
    const nextHeight = element.height * scale;
    const metrics = measureFontSizeFromWidth(element, elementsMap, nextWidth);
    if (metrics === null) {
      return;
    }

    const startTopLeft = [x1, y1];
    const startBottomRight = [x2, y2];
    const startCenter = [cx, cy];

    let newTopLeft = [x1, y1] as [number, number];
    if (["n", "w", "nw"].includes(transformHandleType)) {
      newTopLeft = [
        startBottomRight[0] - Math.abs(nextWidth),
        startBottomRight[1] - Math.abs(nextHeight),
      ];
    }
    if (transformHandleType === "ne") {
      const bottomLeft = [startTopLeft[0], startBottomRight[1]];
      newTopLeft = [bottomLeft[0], bottomLeft[1] - Math.abs(nextHeight)];
    }
    if (transformHandleType === "sw") {
      const topRight = [startBottomRight[0], startTopLeft[1]];
      newTopLeft = [topRight[0] - Math.abs(nextWidth), topRight[1]];
    }

    if (["s", "n"].includes(transformHandleType)) {
      newTopLeft[0] = startCenter[0] - nextWidth / 2;
    }
    if (["e", "w"].includes(transformHandleType)) {
      newTopLeft[1] = startCenter[1] - nextHeight / 2;
    }

    if (shouldResizeFromCenter) {
      newTopLeft[0] = startCenter[0] - Math.abs(nextWidth) / 2;
      newTopLeft[1] = startCenter[1] - Math.abs(nextHeight) / 2;
    }

    const angle = element.angle;
    const rotatedTopLeft = rotatePoint(newTopLeft, [cx, cy], angle);
    const newCenter: Point = [
      newTopLeft[0] + Math.abs(nextWidth) / 2,
      newTopLeft[1] + Math.abs(nextHeight) / 2,
    ];
    const rotatedNewCenter = rotatePoint(newCenter, [cx, cy], angle);
    newTopLeft = rotatePoint(rotatedTopLeft, rotatedNewCenter, -angle);
    const [nextX, nextY] = newTopLeft;

    mutateElement(element, {
      fontSize: metrics.size,
      width: nextWidth,
      height: nextHeight,
      x: nextX,
      y: nextY,
    });
  }

  if (transformHandleType === "e" || transformHandleType === "w") {
    const stateAtResizeStart = originalElements.get(element.id)!;
    const [x1, y1, x2, y2] = getResizedElementAbsoluteCoords(
      stateAtResizeStart,
      stateAtResizeStart.width,
      stateAtResizeStart.height,
      true,
    );
    const startTopLeft: Point = [x1, y1];
    const startBottomRight: Point = [x2, y2];
    const startCenter: Point = centerPoint(startTopLeft, startBottomRight);

    const rotatedPointer = rotatePoint(
      [pointerX, pointerY],
      startCenter,
      -stateAtResizeStart.angle,
    );

    const [esx1, , esx2] = getResizedElementAbsoluteCoords(
      element,
      element.width,
      element.height,
      true,
    );

    const boundsCurrentWidth = esx2 - esx1;

    const atStartBoundsWidth = startBottomRight[0] - startTopLeft[0];
    const minWidth =
      getMinCharWidth(getFontString(element)) + BOUND_TEXT_PADDING * 2;

    let scaleX = atStartBoundsWidth / boundsCurrentWidth;

    if (transformHandleType.includes("e")) {
      scaleX = (rotatedPointer[0] - startTopLeft[0]) / boundsCurrentWidth;
    }
    if (transformHandleType.includes("w")) {
      scaleX = (startBottomRight[0] - rotatedPointer[0]) / boundsCurrentWidth;
    }

    const newWidth =
      element.width * scaleX < minWidth ? minWidth : element.width * scaleX;

    const text = wrapText(
      element.originalText,
      getFontString(element),
      Math.abs(newWidth),
    );
    const metrics = measureText(
      text,
      getFontString(element),
      element.lineHeight,
    );

    const eleNewHeight = metrics.height;

    const [newBoundsX1, newBoundsY1, newBoundsX2, newBoundsY2] =
      getResizedElementAbsoluteCoords(
        stateAtResizeStart,
        newWidth,
        eleNewHeight,
        true,
      );
    const newBoundsWidth = newBoundsX2 - newBoundsX1;
    const newBoundsHeight = newBoundsY2 - newBoundsY1;

    let newTopLeft = [...startTopLeft] as [number, number];
    if (["n", "w", "nw"].includes(transformHandleType)) {
      newTopLeft = [
        startBottomRight[0] - Math.abs(newBoundsWidth),
        startTopLeft[1],
      ];
    }

    // adjust topLeft to new rotation point
    const angle = stateAtResizeStart.angle;
    const rotatedTopLeft = rotatePoint(newTopLeft, startCenter, angle);
    const newCenter: Point = [
      newTopLeft[0] + Math.abs(newBoundsWidth) / 2,
      newTopLeft[1] + Math.abs(newBoundsHeight) / 2,
    ];
    const rotatedNewCenter = rotatePoint(newCenter, startCenter, angle);
    newTopLeft = rotatePoint(rotatedTopLeft, rotatedNewCenter, -angle);

    const resizedElement: Partial<ExcalidrawTextElement> = {
      width: Math.abs(newWidth),
      height: Math.abs(metrics.height),
      x: newTopLeft[0],
      y: newTopLeft[1],
      text,
      autoResize: false,
    };

    mutateElement(element, resizedElement);
  }
};

export const resizeSingleElement = (
  originalElements: PointerDownState["originalElements"],
  shouldMaintainAspectRatio: boolean,
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  transformHandleDirection: TransformHandleDirection,
  shouldResizeFromCenter: boolean,
  pointerX: number,
  pointerY: number,
) => {
  const stateAtResizeStart = originalElements.get(element.id)!;
  // Gets bounds corners
  const [x1, y1, x2, y2] = getResizedElementAbsoluteCoords(
    stateAtResizeStart,
    stateAtResizeStart.width,
    stateAtResizeStart.height,
    true,
  );
  const startTopLeft: Point = [x1, y1];
  const startBottomRight: Point = [x2, y2];
  const startCenter: Point = centerPoint(startTopLeft, startBottomRight);

  // Calculate new dimensions based on cursor position
  const rotatedPointer = rotatePoint(
    [pointerX, pointerY],
    startCenter,
    -stateAtResizeStart.angle,
  );

  // Get bounds corners rendered on screen
  const [esx1, esy1, esx2, esy2] = getResizedElementAbsoluteCoords(
    element,
    element.width,
    element.height,
    true,
  );

  const boundsCurrentWidth = esx2 - esx1;
  const boundsCurrentHeight = esy2 - esy1;

  // It's important we set the initial scale value based on the width and height at resize start,
  // otherwise previous dimensions affected by modifiers will be taken into account.
  const atStartBoundsWidth = startBottomRight[0] - startTopLeft[0];
  const atStartBoundsHeight = startBottomRight[1] - startTopLeft[1];
  let scaleX = atStartBoundsWidth / boundsCurrentWidth;
  let scaleY = atStartBoundsHeight / boundsCurrentHeight;

  let boundTextFont: { fontSize?: number } = {};
  const boundTextElement = getBoundTextElement(element, elementsMap);

  if (transformHandleDirection.includes("e")) {
    scaleX = (rotatedPointer[0] - startTopLeft[0]) / boundsCurrentWidth;
  }
  if (transformHandleDirection.includes("s")) {
    scaleY = (rotatedPointer[1] - startTopLeft[1]) / boundsCurrentHeight;
  }
  if (transformHandleDirection.includes("w")) {
    scaleX = (startBottomRight[0] - rotatedPointer[0]) / boundsCurrentWidth;
  }
  if (transformHandleDirection.includes("n")) {
    scaleY = (startBottomRight[1] - rotatedPointer[1]) / boundsCurrentHeight;
  }

  // Linear elements dimensions differ from bounds dimensions
  const eleInitialWidth = stateAtResizeStart.width;
  const eleInitialHeight = stateAtResizeStart.height;
  // We have to use dimensions of element on screen, otherwise the scaling of the
  // dimensions won't match the cursor for linear elements.
  let eleNewWidth = element.width * scaleX;
  let eleNewHeight = element.height * scaleY;

  // adjust dimensions for resizing from center
  if (shouldResizeFromCenter) {
    eleNewWidth = 2 * eleNewWidth - eleInitialWidth;
    eleNewHeight = 2 * eleNewHeight - eleInitialHeight;
  }

  // adjust dimensions to keep sides ratio
  if (shouldMaintainAspectRatio) {
    const widthRatio = Math.abs(eleNewWidth) / eleInitialWidth;
    const heightRatio = Math.abs(eleNewHeight) / eleInitialHeight;
    if (transformHandleDirection.length === 1) {
      eleNewHeight *= widthRatio;
      eleNewWidth *= heightRatio;
    }
    if (transformHandleDirection.length === 2) {
      const ratio = Math.max(widthRatio, heightRatio);
      eleNewWidth = eleInitialWidth * ratio * Math.sign(eleNewWidth);
      eleNewHeight = eleInitialHeight * ratio * Math.sign(eleNewHeight);
    }
  }

  if (boundTextElement) {
    const stateOfBoundTextElementAtResize = originalElements.get(
      boundTextElement.id,
    ) as typeof boundTextElement | undefined;
    if (stateOfBoundTextElementAtResize) {
      boundTextFont = {
        fontSize: stateOfBoundTextElementAtResize.fontSize,
      };
    }
    if (shouldMaintainAspectRatio) {
      const updatedElement = {
        ...element,
        width: eleNewWidth,
        height: eleNewHeight,
      };

      const nextFont = measureFontSizeFromWidth(
        boundTextElement,
        elementsMap,
        getBoundTextMaxWidth(updatedElement, boundTextElement),
      );
      if (nextFont === null) {
        return;
      }
      boundTextFont = {
        fontSize: nextFont.size,
      };
    } else {
      const minWidth = getApproxMinLineWidth(
        getFontString(boundTextElement),
        boundTextElement.lineHeight,
      );
      const minHeight = getApproxMinLineHeight(
        boundTextElement.fontSize,
        boundTextElement.lineHeight,
      );
      eleNewWidth = Math.max(eleNewWidth, minWidth);
      eleNewHeight = Math.max(eleNewHeight, minHeight);
    }
  }

  const [newBoundsX1, newBoundsY1, newBoundsX2, newBoundsY2] =
    getResizedElementAbsoluteCoords(
      stateAtResizeStart,
      eleNewWidth,
      eleNewHeight,
      true,
    );
  const newBoundsWidth = newBoundsX2 - newBoundsX1;
  const newBoundsHeight = newBoundsY2 - newBoundsY1;

  // Calculate new topLeft based on fixed corner during resize
  let newTopLeft = [...startTopLeft] as [number, number];
  if (["n", "w", "nw"].includes(transformHandleDirection)) {
    newTopLeft = [
      startBottomRight[0] - Math.abs(newBoundsWidth),
      startBottomRight[1] - Math.abs(newBoundsHeight),
    ];
  }
  if (transformHandleDirection === "ne") {
    const bottomLeft = [startTopLeft[0], startBottomRight[1]];
    newTopLeft = [bottomLeft[0], bottomLeft[1] - Math.abs(newBoundsHeight)];
  }
  if (transformHandleDirection === "sw") {
    const topRight = [startBottomRight[0], startTopLeft[1]];
    newTopLeft = [topRight[0] - Math.abs(newBoundsWidth), topRight[1]];
  }

  // Keeps opposite handle fixed during resize
  if (shouldMaintainAspectRatio) {
    if (["s", "n"].includes(transformHandleDirection)) {
      newTopLeft[0] = startCenter[0] - newBoundsWidth / 2;
    }
    if (["e", "w"].includes(transformHandleDirection)) {
      newTopLeft[1] = startCenter[1] - newBoundsHeight / 2;
    }
  }

  const flipX = eleNewWidth < 0;
  const flipY = eleNewHeight < 0;

  // Flip horizontally
  if (flipX) {
    if (transformHandleDirection.includes("e")) {
      newTopLeft[0] -= Math.abs(newBoundsWidth);
    }
    if (transformHandleDirection.includes("w")) {
      newTopLeft[0] += Math.abs(newBoundsWidth);
    }
  }

  // Flip vertically
  if (flipY) {
    if (transformHandleDirection.includes("s")) {
      newTopLeft[1] -= Math.abs(newBoundsHeight);
    }
    if (transformHandleDirection.includes("n")) {
      newTopLeft[1] += Math.abs(newBoundsHeight);
    }
  }

  if (shouldResizeFromCenter) {
    newTopLeft[0] = startCenter[0] - Math.abs(newBoundsWidth) / 2;
    newTopLeft[1] = startCenter[1] - Math.abs(newBoundsHeight) / 2;
  }

  // adjust topLeft to new rotation point
  const angle = stateAtResizeStart.angle;
  const rotatedTopLeft = rotatePoint(newTopLeft, startCenter, angle);
  const newCenter: Point = [
    newTopLeft[0] + Math.abs(newBoundsWidth) / 2,
    newTopLeft[1] + Math.abs(newBoundsHeight) / 2,
  ];
  const rotatedNewCenter = rotatePoint(newCenter, startCenter, angle);
  newTopLeft = rotatePoint(rotatedTopLeft, rotatedNewCenter, -angle);

  // For linear elements (x,y) are the coordinates of the first drawn point not the top-left corner
  // So we need to readjust (x,y) to be where the first point should be
  const newOrigin = [...newTopLeft];
  const linearElementXOffset = stateAtResizeStart.x - newBoundsX1;
  const linearElementYOffset = stateAtResizeStart.y - newBoundsY1;
  newOrigin[0] += linearElementXOffset;
  newOrigin[1] += linearElementYOffset;

  const nextX = newOrigin[0];
  const nextY = newOrigin[1];

  // Readjust points for linear elements
  let rescaledElementPointsY;
  let rescaledPoints;
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    rescaledElementPointsY = rescalePoints(
      1,
      eleNewHeight,
      (stateAtResizeStart as ExcalidrawLinearElement).points,
      true,
    );

    rescaledPoints = rescalePoints(
      0,
      eleNewWidth,
      rescaledElementPointsY,
      true,
    );
  }

  const resizedElement = {
    width: Math.abs(eleNewWidth),
    height: Math.abs(eleNewHeight),
    x: nextX,
    y: nextY,
    points: rescaledPoints,
  };

  if ("scale" in element && "scale" in stateAtResizeStart) {
    mutateElement(element, {
      scale: [
        // defaulting because scaleX/Y can be 0/-0
        (Math.sign(newBoundsX2 - stateAtResizeStart.x) ||
          stateAtResizeStart.scale[0]) * stateAtResizeStart.scale[0],
        (Math.sign(newBoundsY2 - stateAtResizeStart.y) ||
          stateAtResizeStart.scale[1]) * stateAtResizeStart.scale[1],
      ],
    });
  }

  if (
    isArrowElement(element) &&
    boundTextElement &&
    shouldMaintainAspectRatio
  ) {
    const fontSize =
      (resizedElement.width / element.width) * boundTextElement.fontSize;
    if (fontSize < MIN_FONT_SIZE) {
      return;
    }
    boundTextFont.fontSize = fontSize;
  }

  if (
    resizedElement.width !== 0 &&
    resizedElement.height !== 0 &&
    Number.isFinite(resizedElement.x) &&
    Number.isFinite(resizedElement.y)
  ) {
    mutateElement(element, resizedElement);

    updateBoundElements(element, elementsMap, {
      newSize: { width: resizedElement.width, height: resizedElement.height },
    });

    if (boundTextElement && boundTextFont != null) {
      mutateElement(boundTextElement, {
        fontSize: boundTextFont.fontSize,
      });
    }
    handleBindTextResize(
      element,
      elementsMap,
      transformHandleDirection,
      shouldMaintainAspectRatio,
    );
  }
};

export const resizeMultipleElements = (
  originalElements: PointerDownState["originalElements"],
  selectedElements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  transformHandleType: TransformHandleDirection,
  shouldResizeFromCenter: boolean,
  shouldMaintainAspectRatio: boolean,
  pointerX: number,
  pointerY: number,
) => {
  // map selected elements to the original elements. While it never should
  // happen that pointerDownState.originalElements won't contain the selected
  // elements during resize, this coupling isn't guaranteed, so to ensure
  // type safety we need to transform only those elements we filter.
  const targetElements = selectedElements.reduce(
    (
      acc: {
        /** element at resize start */
        orig: NonDeletedExcalidrawElement;
        /** latest element */
        latest: NonDeletedExcalidrawElement;
      }[],
      element,
    ) => {
      const origElement = originalElements.get(element.id);
      if (origElement) {
        acc.push({ orig: origElement, latest: element });
      }
      return acc;
    },
    [],
  );

  // getCommonBoundingBox() uses getBoundTextElement() which returns null for
  // original elements from pointerDownState, so we have to find and add these
  // bound text elements manually. Additionally, the coordinates of bound text
  // elements aren't always up to date.
  const boundTextElements = targetElements.reduce((acc, { orig }) => {
    if (!isLinearElement(orig)) {
      return acc;
    }
    const textId = getBoundTextElementId(orig);
    if (!textId) {
      return acc;
    }
    const text = originalElements.get(textId) ?? null;
    if (!isBoundToContainer(text)) {
      return acc;
    }
    const xy = LinearElementEditor.getBoundTextElementPosition(
      orig,
      text,
      elementsMap,
    );
    return [...acc, { ...text, ...xy }];
  }, [] as ExcalidrawTextElementWithContainer[]);

  const { minX, minY, maxX, maxY, midX, midY } = getCommonBoundingBox(
    targetElements.map(({ orig }) => orig).concat(boundTextElements),
  );
  const width = maxX - minX;
  const height = maxY - minY;

  const direction = transformHandleType;

  const anchorsMap: Record<TransformHandleDirection, Point> = {
    ne: [minX, maxY],
    se: [minX, minY],
    sw: [maxX, minY],
    nw: [maxX, maxY],
    e: [minX, minY + height / 2],
    w: [maxX, minY + height / 2],
    n: [minX + width / 2, maxY],
    s: [minX + width / 2, minY],
  };

  // anchor point must be on the opposite side of the dragged selection handle
  // or be the center of the selection if shouldResizeFromCenter
  const [anchorX, anchorY]: Point = shouldResizeFromCenter
    ? [midX, midY]
    : anchorsMap[direction];

  const resizeFromCenterScale = shouldResizeFromCenter ? 2 : 1;

  const scale =
    Math.max(
      Math.abs(pointerX - anchorX) / width || 0,
      Math.abs(pointerY - anchorY) / height || 0,
    ) * resizeFromCenterScale;

  if (scale === 0) {
    return;
  }

  let scaleX =
    direction.includes("e") || direction.includes("w")
      ? (Math.abs(pointerX - anchorX) / width) * resizeFromCenterScale
      : 1;
  let scaleY =
    direction.includes("n") || direction.includes("s")
      ? (Math.abs(pointerY - anchorY) / height) * resizeFromCenterScale
      : 1;

  const keepAspectRatio =
    shouldMaintainAspectRatio ||
    targetElements.some(
      (item) =>
        item.latest.angle !== 0 ||
        isTextElement(item.latest) ||
        isInGroup(item.latest),
    );

  if (keepAspectRatio) {
    scaleX = scale;
    scaleY = scale;
  }

  const flipConditionsMap: Record<
    TransformHandleDirection,
    // Condition for which we should flip or not flip the selected elements
    // - when evaluated to `true`, we flip
    // - therefore, setting it to always `false` means we do not flip (in that direction) at all
    [x: boolean, y: boolean]
  > = {
    ne: [pointerX < anchorX, pointerY > anchorY],
    se: [pointerX < anchorX, pointerY < anchorY],
    sw: [pointerX > anchorX, pointerY < anchorY],
    nw: [pointerX > anchorX, pointerY > anchorY],
    // e.g. when resizing from the "e" side, we do not need to consider changes in the `y` direction
    //      and therefore, we do not need to flip in the `y` direction at all
    e: [pointerX < anchorX, false],
    w: [pointerX > anchorX, false],
    n: [false, pointerY > anchorY],
    s: [false, pointerY < anchorY],
  };

  /**
   * to flip an element:
   * 1. determine over which axis is the element being flipped
   *    (could be x, y, or both) indicated by `flipFactorX` & `flipFactorY`
   * 2. shift element's position by the amount of width or height (or both) or
   *    mirror points in the case of linear & freedraw elemenets
   * 3. adjust element angle
   */
  const [flipFactorX, flipFactorY] = flipConditionsMap[direction].map(
    (condition) => (condition ? -1 : 1),
  );
  const isFlippedByX = flipFactorX < 0;
  const isFlippedByY = flipFactorY < 0;

  const elementsAndUpdates: {
    element: NonDeletedExcalidrawElement;
    update: Mutable<
      Pick<ExcalidrawElement, "x" | "y" | "width" | "height" | "angle">
    > & {
      points?: ExcalidrawLinearElement["points"];
      fontSize?: ExcalidrawTextElement["fontSize"];
      scale?: ExcalidrawImageElement["scale"];
      boundTextFontSize?: ExcalidrawTextElement["fontSize"];
    };
  }[] = [];

  for (const { orig, latest } of targetElements) {
    // bounded text elements are updated along with their container elements
    if (isTextElement(orig) && isBoundToContainer(orig)) {
      continue;
    }

    const width = orig.width * scaleX;
    const height = orig.height * scaleY;
    const angle = normalizeAngle(orig.angle * flipFactorX * flipFactorY);

    const isLinearOrFreeDraw = isLinearElement(orig) || isFreeDrawElement(orig);
    const offsetX = orig.x - anchorX;
    const offsetY = orig.y - anchorY;
    const shiftX = isFlippedByX && !isLinearOrFreeDraw ? width : 0;
    const shiftY = isFlippedByY && !isLinearOrFreeDraw ? height : 0;
    const x = anchorX + flipFactorX * (offsetX * scaleX + shiftX);
    const y = anchorY + flipFactorY * (offsetY * scaleY + shiftY);

    const rescaledPoints = rescalePointsInElement(
      orig,
      width * flipFactorX,
      height * flipFactorY,
      false,
    );

    const update: typeof elementsAndUpdates[0]["update"] = {
      x,
      y,
      width,
      height,
      angle,
      ...rescaledPoints,
    };

    if (isImageElement(orig)) {
      update.scale = [orig.scale[0] * flipFactorX, orig.scale[1] * flipFactorY];
    }

    if (isTextElement(orig)) {
      const metrics = measureFontSizeFromWidth(orig, elementsMap, width);
      if (!metrics) {
        return;
      }
      update.fontSize = metrics.size;
    }

    const boundTextElement = originalElements.get(
      getBoundTextElementId(orig) ?? "",
    ) as ExcalidrawTextElementWithContainer | undefined;

    if (boundTextElement) {
      if (keepAspectRatio) {
        const newFontSize = boundTextElement.fontSize * scale;
        if (newFontSize < MIN_FONT_SIZE) {
          return;
        }
        update.boundTextFontSize = newFontSize;
      } else {
        update.boundTextFontSize = boundTextElement.fontSize;
      }
    }

    elementsAndUpdates.push({
      element: latest,
      update,
    });
  }

  const elementsToUpdate = elementsAndUpdates.map(({ element }) => element);

  for (const {
    element,
    update: { boundTextFontSize, ...update },
  } of elementsAndUpdates) {
    const { width, height, angle } = update;

    mutateElement(element, update, false);

    updateBoundElements(element, elementsMap, {
      simultaneouslyUpdated: elementsToUpdate,
      newSize: { width, height },
    });

    const boundTextElement = getBoundTextElement(element, elementsMap);
    if (boundTextElement && boundTextFontSize) {
      mutateElement(
        boundTextElement,
        {
          fontSize: boundTextFontSize,
          angle: isLinearElement(element) ? undefined : angle,
        },
        false,
      );
      handleBindTextResize(element, elementsMap, transformHandleType, true);
    }
  }

  Scene.getScene(elementsAndUpdates[0].element)?.triggerUpdate();
};

const rotateMultipleElements = (
  originalElements: PointerDownState["originalElements"],
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  pointerX: number,
  pointerY: number,
  shouldRotateWithDiscreteAngle: boolean,
  centerX: number,
  centerY: number,
) => {
  let centerAngle =
    (5 * Math.PI) / 2 + Math.atan2(pointerY - centerY, pointerX - centerX);
  if (shouldRotateWithDiscreteAngle) {
    centerAngle += SHIFT_LOCKING_ANGLE / 2;
    centerAngle -= centerAngle % SHIFT_LOCKING_ANGLE;
  }

  elements
    .filter((element) => !isFrameLikeElement(element))
    .forEach((element) => {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const origAngle =
        originalElements.get(element.id)?.angle ?? element.angle;
      const [rotatedCX, rotatedCY] = rotate(
        cx,
        cy,
        centerX,
        centerY,
        centerAngle + origAngle - element.angle,
      );
      mutateElement(
        element,
        {
          x: element.x + (rotatedCX - cx),
          y: element.y + (rotatedCY - cy),
          angle: normalizeAngle(centerAngle + origAngle),
        },
        false,
      );
      updateBoundElements(element, elementsMap, {
        simultaneouslyUpdated: elements,
      });

      const boundText = getBoundTextElement(element, elementsMap);
      if (boundText && !isArrowElement(element)) {
        mutateElement(
          boundText,
          {
            x: boundText.x + (rotatedCX - cx),
            y: boundText.y + (rotatedCY - cy),
            angle: normalizeAngle(centerAngle + origAngle),
          },
          false,
        );
      }
    });

  Scene.getScene(elements[0])?.triggerUpdate();
};

export const getResizeOffsetXY = (
  transformHandleType: MaybeTransformHandleType,
  selectedElements: NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  x: number,
  y: number,
): [number, number] => {
  const [x1, y1, x2, y2] =
    selectedElements.length === 1
      ? getElementAbsoluteCoords(selectedElements[0], elementsMap)
      : getCommonBounds(selectedElements);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const angle = selectedElements.length === 1 ? selectedElements[0].angle : 0;
  [x, y] = rotate(x, y, cx, cy, -angle);
  switch (transformHandleType) {
    case "n":
      return rotate(x - (x1 + x2) / 2, y - y1, 0, 0, angle);
    case "s":
      return rotate(x - (x1 + x2) / 2, y - y2, 0, 0, angle);
    case "w":
      return rotate(x - x1, y - (y1 + y2) / 2, 0, 0, angle);
    case "e":
      return rotate(x - x2, y - (y1 + y2) / 2, 0, 0, angle);
    case "nw":
      return rotate(x - x1, y - y1, 0, 0, angle);
    case "ne":
      return rotate(x - x2, y - y1, 0, 0, angle);
    case "sw":
      return rotate(x - x1, y - y2, 0, 0, angle);
    case "se":
      return rotate(x - x2, y - y2, 0, 0, angle);
    default:
      return [0, 0];
  }
};

export const getResizeArrowDirection = (
  transformHandleType: MaybeTransformHandleType,
  element: NonDeleted<ExcalidrawLinearElement>,
): "origin" | "end" => {
  const [, [px, py]] = element.points;
  const isResizeEnd =
    (transformHandleType === "nw" && (px < 0 || py < 0)) ||
    (transformHandleType === "ne" && px >= 0) ||
    (transformHandleType === "sw" && px <= 0) ||
    (transformHandleType === "se" && (px > 0 || py > 0));
  return isResizeEnd ? "end" : "origin";
};
