import {
  pointCenter,
  normalizeRadians,
  pointFrom,
  pointRotateRads,
  type Radians,
  type LocalPoint,
} from "@excalidraw/math";

import {
  MIN_FONT_SIZE,
  SHIFT_LOCKING_ANGLE,
  rescalePoints,
  getFontString,
} from "@excalidraw/common";

import type { GlobalPoint } from "@excalidraw/math";

import type { PointerDownState } from "@excalidraw/excalidraw/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import { getArrowLocalFixedPoints, updateBoundElements } from "./binding";
import {
  getElementAbsoluteCoords,
  getCommonBounds,
  getResizedElementAbsoluteCoords,
  getCommonBoundingBox,
  getElementBounds,
} from "./bounds";
import { LinearElementEditor } from "./linearElementEditor";
import {
  getBoundTextElement,
  getBoundTextElementId,
  getContainerElement,
  handleBindTextResize,
  getBoundTextMaxWidth,
  computeBoundTextPosition,
} from "./textElement";
import {
  getMinTextElementWidth,
  measureText,
  getApproxMinLineWidth,
  getApproxMinLineHeight,
} from "./textMeasurements";
import { wrapText } from "./textWrapping";
import {
  isArrowElement,
  isBoundToContainer,
  isElbowArrow,
  isFrameLikeElement,
  isFreeDrawElement,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";

import { isInGroup } from "./groups";

import type { Scene } from "./Scene";

import type { BoundingBox } from "./bounds";
import type {
  MaybeTransformHandleType,
  TransformHandleDirection,
} from "./transformHandles";
import type {
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  ExcalidrawElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawImageElement,
  ElementsMap,
  ExcalidrawElbowArrowElement,
} from "./types";

// Returns true when transform (resizing/rotation) happened
export const transformElements = (
  originalElements: PointerDownState["originalElements"],
  transformHandleType: MaybeTransformHandleType,
  selectedElements: readonly NonDeletedExcalidrawElement[],
  scene: Scene,
  shouldRotateWithDiscreteAngle: boolean,
  shouldResizeFromCenter: boolean,
  shouldMaintainAspectRatio: boolean,
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
): boolean => {
  const elementsMap = scene.getNonDeletedElementsMap();
  if (selectedElements.length === 1) {
    const [element] = selectedElements;
    if (transformHandleType === "rotation") {
      if (!isElbowArrow(element)) {
        rotateSingleElement(
          element,
          scene,
          pointerX,
          pointerY,
          shouldRotateWithDiscreteAngle,
        );
        updateBoundElements(element, scene);
      }
    } else if (transformHandleType) {
      const elementId = selectedElements[0].id;
      const latestElement = elementsMap.get(elementId);
      const origElement = originalElements.get(elementId);

      if (latestElement && origElement) {
        const { nextWidth, nextHeight } =
          getNextSingleWidthAndHeightFromPointer(
            latestElement,
            origElement,
            transformHandleType,
            pointerX,
            pointerY,
            {
              shouldMaintainAspectRatio,
              shouldResizeFromCenter,
            },
          );

        resizeSingleElement(
          nextWidth,
          nextHeight,
          latestElement,
          origElement,
          originalElements,
          scene,
          transformHandleType,
          {
            shouldMaintainAspectRatio,
            shouldResizeFromCenter,
          },
        );
      }
    }
    if (isTextElement(element)) {
      updateBoundElements(element, scene);
    }
    return true;
  } else if (selectedElements.length > 1) {
    if (transformHandleType === "rotation") {
      rotateMultipleElements(
        originalElements,
        selectedElements,
        scene,
        pointerX,
        pointerY,
        shouldRotateWithDiscreteAngle,
        centerX,
        centerY,
      );
      return true;
    } else if (transformHandleType) {
      const { nextWidth, nextHeight, flipByX, flipByY, originalBoundingBox } =
        getNextMultipleWidthAndHeightFromPointer(
          selectedElements,
          originalElements,
          elementsMap,
          transformHandleType,
          pointerX,
          pointerY,
          {
            shouldMaintainAspectRatio,
            shouldResizeFromCenter,
          },
        );

      resizeMultipleElements(
        selectedElements,
        elementsMap,
        transformHandleType,
        scene,
        originalElements,
        {
          shouldResizeFromCenter,
          shouldMaintainAspectRatio,
          flipByX,
          flipByY,
          nextWidth,
          nextHeight,
          originalBoundingBox,
        },
      );

      return true;
    }
  }
  return false;
};

const rotateSingleElement = (
  element: NonDeletedExcalidrawElement,
  scene: Scene,
  pointerX: number,
  pointerY: number,
  shouldRotateWithDiscreteAngle: boolean,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(
    element,
    scene.getNonDeletedElementsMap(),
  );
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  let angle: Radians;
  if (isFrameLikeElement(element)) {
    angle = 0 as Radians;
  } else {
    angle = ((5 * Math.PI) / 2 +
      Math.atan2(pointerY - cy, pointerX - cx)) as Radians;
    if (shouldRotateWithDiscreteAngle) {
      angle = (angle + SHIFT_LOCKING_ANGLE / 2) as Radians;
      angle = (angle - (angle % SHIFT_LOCKING_ANGLE)) as Radians;
    }
    angle = normalizeRadians(angle as Radians);
  }
  const boundTextElementId = getBoundTextElementId(element);

  scene.mutateElement(element, { angle });
  if (boundTextElementId) {
    const textElement =
      scene.getElement<ExcalidrawTextElementWithContainer>(boundTextElementId);

    if (textElement && !isArrowElement(element)) {
      const { x, y } = computeBoundTextPosition(
        element,
        textElement,
        scene.getNonDeletedElementsMap(),
      );
      scene.mutateElement(textElement, {
        angle,
        x,
        y,
      });
    }
  }
};

export const rescalePointsInElement = (
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

export const measureFontSizeFromWidth = (
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

export const resizeSingleTextElement = (
  origElement: NonDeleted<ExcalidrawTextElement>,
  element: NonDeleted<ExcalidrawTextElement>,
  scene: Scene,
  transformHandleType: TransformHandleDirection,
  shouldResizeFromCenter: boolean,
  nextWidth: number,
  nextHeight: number,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();

  const metricsWidth = element.width * (nextHeight / element.height);

  const metrics = measureFontSizeFromWidth(element, elementsMap, metricsWidth);
  if (metrics === null) {
    return;
  }

  if (transformHandleType.includes("n") || transformHandleType.includes("s")) {
    const previousOrigin = pointFrom<GlobalPoint>(origElement.x, origElement.y);

    const newOrigin = getResizedOrigin(
      previousOrigin,
      origElement.width,
      origElement.height,
      metricsWidth,
      nextHeight,
      origElement.angle,
      transformHandleType,
      false,
      shouldResizeFromCenter,
    );

    scene.mutateElement(element, {
      fontSize: metrics.size,
      width: metricsWidth,
      height: nextHeight,
      x: newOrigin.x,
      y: newOrigin.y,
    });
    return;
  }

  if (transformHandleType === "e" || transformHandleType === "w") {
    const minWidth = getMinTextElementWidth(
      getFontString({
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
      }),
      element.lineHeight,
    );

    const newWidth = Math.max(minWidth, nextWidth);

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

    const newHeight = metrics.height;

    const previousOrigin = pointFrom<GlobalPoint>(origElement.x, origElement.y);

    const newOrigin = getResizedOrigin(
      previousOrigin,
      origElement.width,
      origElement.height,
      newWidth,
      newHeight,
      element.angle,
      transformHandleType,
      false,
      shouldResizeFromCenter,
    );

    const resizedElement: Partial<ExcalidrawTextElement> = {
      width: Math.abs(newWidth),
      height: Math.abs(metrics.height),
      x: newOrigin.x,
      y: newOrigin.y,
      text,
      autoResize: false,
    };

    scene.mutateElement(element, resizedElement);
  }
};

const rotateMultipleElements = (
  originalElements: PointerDownState["originalElements"],
  elements: readonly NonDeletedExcalidrawElement[],
  scene: Scene,
  pointerX: number,
  pointerY: number,
  shouldRotateWithDiscreteAngle: boolean,
  centerX: number,
  centerY: number,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  let centerAngle =
    (5 * Math.PI) / 2 + Math.atan2(pointerY - centerY, pointerX - centerX);
  if (shouldRotateWithDiscreteAngle) {
    centerAngle += SHIFT_LOCKING_ANGLE / 2;
    centerAngle -= centerAngle % SHIFT_LOCKING_ANGLE;
  }

  for (const element of elements) {
    if (!isFrameLikeElement(element)) {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const origAngle =
        originalElements.get(element.id)?.angle ?? element.angle;
      const [rotatedCX, rotatedCY] = pointRotateRads(
        pointFrom(cx, cy),
        pointFrom(centerX, centerY),
        (centerAngle + origAngle - element.angle) as Radians,
      );

      const updates = isElbowArrow(element)
        ? {
            // Needed to re-route the arrow
            points: getArrowLocalFixedPoints(element, elementsMap),
          }
        : {
            x: element.x + (rotatedCX - cx),
            y: element.y + (rotatedCY - cy),
            angle: normalizeRadians((centerAngle + origAngle) as Radians),
          };

      scene.mutateElement(element, updates);

      updateBoundElements(element, scene, {
        simultaneouslyUpdated: elements,
      });

      const boundText = getBoundTextElement(element, elementsMap);
      if (boundText && !isArrowElement(element)) {
        const { x, y } = computeBoundTextPosition(
          element,
          boundText,
          elementsMap,
        );

        scene.mutateElement(boundText, {
          x,
          y,
          angle: normalizeRadians((centerAngle + origAngle) as Radians),
        });
      }
    }
  }

  scene.triggerUpdate();
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
  const angle = (
    selectedElements.length === 1 ? selectedElements[0].angle : 0
  ) as Radians;
  [x, y] = pointRotateRads(
    pointFrom(x, y),
    pointFrom(cx, cy),
    -angle as Radians,
  );
  switch (transformHandleType) {
    case "n":
      return pointRotateRads(
        pointFrom(x - (x1 + x2) / 2, y - y1),
        pointFrom(0, 0),
        angle,
      );
    case "s":
      return pointRotateRads(
        pointFrom(x - (x1 + x2) / 2, y - y2),
        pointFrom(0, 0),
        angle,
      );
    case "w":
      return pointRotateRads(
        pointFrom(x - x1, y - (y1 + y2) / 2),
        pointFrom(0, 0),
        angle,
      );
    case "e":
      return pointRotateRads(
        pointFrom(x - x2, y - (y1 + y2) / 2),
        pointFrom(0, 0),
        angle,
      );
    case "nw":
      return pointRotateRads(pointFrom(x - x1, y - y1), pointFrom(0, 0), angle);
    case "ne":
      return pointRotateRads(pointFrom(x - x2, y - y1), pointFrom(0, 0), angle);
    case "sw":
      return pointRotateRads(pointFrom(x - x1, y - y2), pointFrom(0, 0), angle);
    case "se":
      return pointRotateRads(pointFrom(x - x2, y - y2), pointFrom(0, 0), angle);
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

type ResizeAnchor =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "west-side"
  | "north-side"
  | "east-side"
  | "south-side"
  | "center";

const getResizeAnchor = (
  handleDirection: TransformHandleDirection,
  shouldMaintainAspectRatio: boolean,
  shouldResizeFromCenter: boolean,
): ResizeAnchor => {
  if (shouldResizeFromCenter) {
    return "center";
  }

  if (shouldMaintainAspectRatio) {
    switch (handleDirection) {
      case "n":
        return "south-side";
      case "e": {
        return "west-side";
      }
      case "s":
        return "north-side";
      case "w":
        return "east-side";
      case "ne":
        return "bottom-left";
      case "nw":
        return "bottom-right";
      case "se":
        return "top-left";
      case "sw":
        return "top-right";
    }
  }

  if (["e", "se", "s"].includes(handleDirection)) {
    return "top-left";
  } else if (["n", "nw", "w"].includes(handleDirection)) {
    return "bottom-right";
  } else if (handleDirection === "ne") {
    return "bottom-left";
  }
  return "top-right";
};

const getResizedOrigin = (
  prevOrigin: GlobalPoint,
  prevWidth: number,
  prevHeight: number,
  newWidth: number,
  newHeight: number,
  angle: number,
  handleDirection: TransformHandleDirection,
  shouldMaintainAspectRatio: boolean,
  shouldResizeFromCenter: boolean,
): { x: number; y: number } => {
  const anchor = getResizeAnchor(
    handleDirection,
    shouldMaintainAspectRatio,
    shouldResizeFromCenter,
  );

  const [x, y] = prevOrigin;

  switch (anchor) {
    case "top-left":
      return {
        x:
          x +
          (prevWidth - newWidth) / 2 +
          ((newWidth - prevWidth) / 2) * Math.cos(angle) +
          ((prevHeight - newHeight) / 2) * Math.sin(angle),
        y:
          y +
          (prevHeight - newHeight) / 2 +
          ((newWidth - prevWidth) / 2) * Math.sin(angle) +
          ((newHeight - prevHeight) / 2) * Math.cos(angle),
      };
    case "top-right":
      return {
        x:
          x +
          ((prevWidth - newWidth) / 2) * (Math.cos(angle) + 1) +
          ((prevHeight - newHeight) / 2) * Math.sin(angle),
        y:
          y +
          (prevHeight - newHeight) / 2 +
          ((prevWidth - newWidth) / 2) * Math.sin(angle) +
          ((newHeight - prevHeight) / 2) * Math.cos(angle),
      };

    case "bottom-left":
      return {
        x:
          x +
          ((prevWidth - newWidth) / 2) * (1 - Math.cos(angle)) +
          ((newHeight - prevHeight) / 2) * Math.sin(angle),
        y:
          y +
          ((prevHeight - newHeight) / 2) * (Math.cos(angle) + 1) +
          ((newWidth - prevWidth) / 2) * Math.sin(angle),
      };
    case "bottom-right":
      return {
        x:
          x +
          ((prevWidth - newWidth) / 2) * (Math.cos(angle) + 1) +
          ((newHeight - prevHeight) / 2) * Math.sin(angle),
        y:
          y +
          ((prevHeight - newHeight) / 2) * (Math.cos(angle) + 1) +
          ((prevWidth - newWidth) / 2) * Math.sin(angle),
      };
    case "center":
      return {
        x: x - (newWidth - prevWidth) / 2,
        y: y - (newHeight - prevHeight) / 2,
      };
    case "east-side":
      return {
        x: x + ((prevWidth - newWidth) / 2) * (Math.cos(angle) + 1),
        y:
          y +
          ((prevWidth - newWidth) / 2) * Math.sin(angle) +
          (prevHeight - newHeight) / 2,
      };
    case "west-side":
      return {
        x: x + ((prevWidth - newWidth) / 2) * (1 - Math.cos(angle)),
        y:
          y +
          ((newWidth - prevWidth) / 2) * Math.sin(angle) +
          (prevHeight - newHeight) / 2,
      };
    case "north-side":
      return {
        x:
          x +
          (prevWidth - newWidth) / 2 +
          ((prevHeight - newHeight) / 2) * Math.sin(angle),
        y: y + ((newHeight - prevHeight) / 2) * (Math.cos(angle) - 1),
      };
    case "south-side":
      return {
        x:
          x +
          (prevWidth - newWidth) / 2 +
          ((newHeight - prevHeight) / 2) * Math.sin(angle),
        y: y + ((prevHeight - newHeight) / 2) * (Math.cos(angle) + 1),
      };
  }
};

export const resizeSingleElement = (
  nextWidth: number,
  nextHeight: number,
  latestElement: ExcalidrawElement,
  origElement: ExcalidrawElement,
  originalElementsMap: ElementsMap,
  scene: Scene,
  handleDirection: TransformHandleDirection,
  {
    shouldInformMutation = true,
    shouldMaintainAspectRatio = false,
    shouldResizeFromCenter = false,
  }: {
    shouldMaintainAspectRatio?: boolean;
    shouldResizeFromCenter?: boolean;
    shouldInformMutation?: boolean;
  } = {},
) => {
  if (isTextElement(latestElement) && isTextElement(origElement)) {
    return resizeSingleTextElement(
      origElement,
      latestElement,
      scene,
      handleDirection,
      shouldResizeFromCenter,
      nextWidth,
      nextHeight,
    );
  }

  let boundTextFont: { fontSize?: number } = {};
  const elementsMap = scene.getNonDeletedElementsMap();
  const boundTextElement = getBoundTextElement(latestElement, elementsMap);

  if (boundTextElement) {
    const stateOfBoundTextElementAtResize = originalElementsMap.get(
      boundTextElement.id,
    ) as typeof boundTextElement | undefined;
    if (stateOfBoundTextElementAtResize) {
      boundTextFont = {
        fontSize: stateOfBoundTextElementAtResize.fontSize,
      };
    }
    if (shouldMaintainAspectRatio) {
      const updatedElement = {
        ...latestElement,
        width: nextWidth,
        height: nextHeight,
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
      nextWidth = Math.max(nextWidth, minWidth);
      nextHeight = Math.max(nextHeight, minHeight);
    }
  }

  const rescaledPoints = rescalePointsInElement(
    origElement,
    nextWidth,
    nextHeight,
    true,
  );

  let previousOrigin = pointFrom<GlobalPoint>(origElement.x, origElement.y);

  if (isLinearElement(origElement)) {
    const [x1, y1] = getElementBounds(origElement, originalElementsMap);
    previousOrigin = pointFrom<GlobalPoint>(x1, y1);
  }

  const newOrigin: {
    x: number;
    y: number;
  } = getResizedOrigin(
    previousOrigin,
    origElement.width,
    origElement.height,
    nextWidth,
    nextHeight,
    origElement.angle,
    handleDirection,
    shouldMaintainAspectRatio!!,
    shouldResizeFromCenter!!,
  );

  if (isLinearElement(origElement) && rescaledPoints.points) {
    const offsetX = origElement.x - previousOrigin[0];
    const offsetY = origElement.y - previousOrigin[1];

    newOrigin.x += offsetX;
    newOrigin.y += offsetY;

    const scaledX = rescaledPoints.points[0][0];
    const scaledY = rescaledPoints.points[0][1];

    newOrigin.x += scaledX;
    newOrigin.y += scaledY;

    rescaledPoints.points = rescaledPoints.points.map((p) =>
      pointFrom<LocalPoint>(p[0] - scaledX, p[1] - scaledY),
    );
  }

  // flipping
  if (nextWidth < 0) {
    newOrigin.x = newOrigin.x + nextWidth;
  }
  if (nextHeight < 0) {
    newOrigin.y = newOrigin.y + nextHeight;
  }

  if ("scale" in latestElement && "scale" in origElement) {
    scene.mutateElement(latestElement, {
      scale: [
        // defaulting because scaleX/Y can be 0/-0
        (Math.sign(nextWidth) || origElement.scale[0]) * origElement.scale[0],
        (Math.sign(nextHeight) || origElement.scale[1]) * origElement.scale[1],
      ],
    });
  }

  if (
    isArrowElement(latestElement) &&
    boundTextElement &&
    shouldMaintainAspectRatio
  ) {
    const fontSize =
      (nextWidth / latestElement.width) * boundTextElement.fontSize;
    if (fontSize < MIN_FONT_SIZE) {
      return;
    }
    boundTextFont.fontSize = fontSize;
  }

  if (
    nextWidth !== 0 &&
    nextHeight !== 0 &&
    Number.isFinite(newOrigin.x) &&
    Number.isFinite(newOrigin.y)
  ) {
    const updates = {
      ...newOrigin,
      width: Math.abs(nextWidth),
      height: Math.abs(nextHeight),
      ...rescaledPoints,
    };

    scene.mutateElement(latestElement, updates, {
      informMutation: shouldInformMutation,
      isDragging: false,
    });

    if (boundTextElement && boundTextFont != null) {
      scene.mutateElement(boundTextElement, {
        fontSize: boundTextFont.fontSize,
      });
    }
    handleBindTextResize(
      latestElement,
      scene,
      handleDirection,
      shouldMaintainAspectRatio,
    );

    updateBoundElements(latestElement, scene, {
      // TODO: confirm with MARK if this actually makes sense
      newSize: { width: nextWidth, height: nextHeight },
    });
  }
};

const getNextSingleWidthAndHeightFromPointer = (
  latestElement: ExcalidrawElement,
  origElement: ExcalidrawElement,
  handleDirection: TransformHandleDirection,
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
  // Gets bounds corners
  const [x1, y1, x2, y2] = getResizedElementAbsoluteCoords(
    origElement,
    origElement.width,
    origElement.height,
    true,
  );
  const startTopLeft = pointFrom(x1, y1);
  const startBottomRight = pointFrom(x2, y2);
  const startCenter = pointCenter(startTopLeft, startBottomRight);

  // Calculate new dimensions based on cursor position
  const rotatedPointer = pointRotateRads(
    pointFrom(pointerX, pointerY),
    startCenter,
    -origElement.angle as Radians,
  );

  // Get bounds corners rendered on screen
  const [esx1, esy1, esx2, esy2] = getResizedElementAbsoluteCoords(
    latestElement,
    latestElement.width,
    latestElement.height,
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

  if (handleDirection.includes("e")) {
    scaleX = (rotatedPointer[0] - startTopLeft[0]) / boundsCurrentWidth;
  }
  if (handleDirection.includes("s")) {
    scaleY = (rotatedPointer[1] - startTopLeft[1]) / boundsCurrentHeight;
  }
  if (handleDirection.includes("w")) {
    scaleX = (startBottomRight[0] - rotatedPointer[0]) / boundsCurrentWidth;
  }
  if (handleDirection.includes("n")) {
    scaleY = (startBottomRight[1] - rotatedPointer[1]) / boundsCurrentHeight;
  }

  // We have to use dimensions of element on screen, otherwise the scaling of the
  // dimensions won't match the cursor for linear elements.
  let nextWidth = latestElement.width * scaleX;
  let nextHeight = latestElement.height * scaleY;

  if (shouldResizeFromCenter) {
    nextWidth = 2 * nextWidth - origElement.width;
    nextHeight = 2 * nextHeight - origElement.height;
  }

  // adjust dimensions to keep sides ratio
  if (shouldMaintainAspectRatio) {
    const widthRatio = Math.abs(nextWidth) / origElement.width;
    const heightRatio = Math.abs(nextHeight) / origElement.height;
    if (handleDirection.length === 1) {
      nextHeight *= widthRatio;
      nextWidth *= heightRatio;
    }
    if (handleDirection.length === 2) {
      const ratio = Math.max(widthRatio, heightRatio);
      nextWidth = origElement.width * ratio * Math.sign(nextWidth);
      nextHeight = origElement.height * ratio * Math.sign(nextHeight);
    }
  }

  return {
    nextWidth,
    nextHeight,
  };
};

const getNextMultipleWidthAndHeightFromPointer = (
  selectedElements: readonly NonDeletedExcalidrawElement[],
  originalElementsMap: ElementsMap,
  elementsMap: ElementsMap,
  handleDirection: TransformHandleDirection,
  pointerX: number,
  pointerY: number,
  {
    shouldMaintainAspectRatio = false,
    shouldResizeFromCenter = false,
  }: {
    shouldResizeFromCenter?: boolean;
    shouldMaintainAspectRatio?: boolean;
  } = {},
) => {
  const originalElementsArray = selectedElements.map(
    (el) => originalElementsMap.get(el.id)!,
  );

  // getCommonBoundingBox() uses getBoundTextElement() which returns null for
  // original elements from pointerDownState, so we have to find and add these
  // bound text elements manually. Additionally, the coordinates of bound text
  // elements aren't always up to date.
  const boundTextElements = originalElementsArray.reduce((acc, orig) => {
    if (!isLinearElement(orig)) {
      return acc;
    }
    const textId = getBoundTextElementId(orig);
    if (!textId) {
      return acc;
    }
    const text = originalElementsMap.get(textId) ?? null;
    if (!isBoundToContainer(text)) {
      return acc;
    }
    return [
      ...acc,
      {
        ...text,
        ...LinearElementEditor.getBoundTextElementPosition(
          orig,
          text,
          elementsMap,
        ),
      },
    ];
  }, [] as ExcalidrawTextElementWithContainer[]);

  const originalBoundingBox = getCommonBoundingBox(
    originalElementsArray.map((orig) => orig).concat(boundTextElements),
  );

  const { minX, minY, maxX, maxY, midX, midY } = originalBoundingBox;
  const width = maxX - minX;
  const height = maxY - minY;

  const anchorsMap = {
    ne: [minX, maxY],
    se: [minX, minY],
    sw: [maxX, minY],
    nw: [maxX, maxY],
    e: [minX, minY + height / 2],
    w: [maxX, minY + height / 2],
    n: [minX + width / 2, maxY],
    s: [minX + width / 2, minY],
  } as Record<TransformHandleDirection, GlobalPoint>;

  // anchor point must be on the opposite side of the dragged selection handle
  // or be the center of the selection if shouldResizeFromCenter
  const [anchorX, anchorY] = shouldResizeFromCenter
    ? [midX, midY]
    : anchorsMap[handleDirection];

  const resizeFromCenterScale = shouldResizeFromCenter ? 2 : 1;

  const scale =
    Math.max(
      Math.abs(pointerX - anchorX) / width || 0,
      Math.abs(pointerY - anchorY) / height || 0,
    ) * resizeFromCenterScale;

  let nextWidth =
    handleDirection.includes("e") || handleDirection.includes("w")
      ? Math.abs(pointerX - anchorX) * resizeFromCenterScale
      : width;
  let nextHeight =
    handleDirection.includes("n") || handleDirection.includes("s")
      ? Math.abs(pointerY - anchorY) * resizeFromCenterScale
      : height;

  if (shouldMaintainAspectRatio) {
    nextWidth = width * scale * Math.sign(pointerX - anchorX);
    nextHeight = height * scale * Math.sign(pointerY - anchorY);
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

  const [flipByX, flipByY] = flipConditionsMap[handleDirection].map(
    (condition) => condition,
  );

  return {
    originalBoundingBox,
    nextWidth,
    nextHeight,
    flipByX,
    flipByY,
  };
};

export const resizeMultipleElements = (
  selectedElements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  handleDirection: TransformHandleDirection,
  scene: Scene,
  originalElementsMap: ElementsMap,
  {
    shouldMaintainAspectRatio = false,
    shouldResizeFromCenter = false,
    flipByX = false,
    flipByY = false,
    nextHeight,
    nextWidth,
    originalBoundingBox,
  }: {
    nextWidth?: number;
    nextHeight?: number;
    shouldMaintainAspectRatio?: boolean;
    shouldResizeFromCenter?: boolean;
    flipByX?: boolean;
    flipByY?: boolean;
    // added to improve performance
    originalBoundingBox?: BoundingBox;
  } = {},
) => {
  // in the case of just flipping, there is no need to specify the next width and height
  if (
    nextWidth === undefined &&
    nextHeight === undefined &&
    flipByX === undefined &&
    flipByY === undefined
  ) {
    return;
  }

  // do not allow next width or height to be 0
  if (nextHeight === 0 || nextWidth === 0) {
    return;
  }

  if (!originalElementsMap) {
    originalElementsMap = elementsMap;
  }

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
      const origElement = originalElementsMap!.get(element.id);
      if (origElement) {
        acc.push({ orig: origElement, latest: element });
      }
      return acc;
    },
    [],
  );

  let boundingBox: BoundingBox;

  if (originalBoundingBox) {
    boundingBox = originalBoundingBox;
  } else {
    const boundTextElements = targetElements.reduce((acc, { orig }) => {
      if (!isLinearElement(orig)) {
        return acc;
      }
      const textId = getBoundTextElementId(orig);
      if (!textId) {
        return acc;
      }
      const text = originalElementsMap!.get(textId) ?? null;
      if (!isBoundToContainer(text)) {
        return acc;
      }
      return [
        ...acc,
        {
          ...text,
          ...LinearElementEditor.getBoundTextElementPosition(
            orig,
            text,
            elementsMap,
          ),
        },
      ];
    }, [] as ExcalidrawTextElementWithContainer[]);

    boundingBox = getCommonBoundingBox(
      targetElements.map(({ orig }) => orig).concat(boundTextElements),
    );
  }
  const { minX, minY, maxX, maxY, midX, midY } = boundingBox;
  const width = maxX - minX;
  const height = maxY - minY;

  if (nextWidth === undefined && nextHeight === undefined) {
    nextWidth = width;
    nextHeight = height;
  }

  if (shouldMaintainAspectRatio) {
    if (nextWidth === undefined) {
      nextWidth = nextHeight! * (width / height);
    } else if (nextHeight === undefined) {
      nextHeight = nextWidth! * (height / width);
    } else if (Math.abs(nextWidth / nextHeight - width / height) > 0.001) {
      nextWidth = nextHeight * (width / height);
    }
  }

  if (nextWidth && nextHeight) {
    let scaleX =
      handleDirection.includes("e") || handleDirection.includes("w")
        ? Math.abs(nextWidth) / width
        : 1;
    let scaleY =
      handleDirection.includes("n") || handleDirection.includes("s")
        ? Math.abs(nextHeight) / height
        : 1;

    let scale: number;

    if (handleDirection.length === 1) {
      scale =
        handleDirection.includes("e") || handleDirection.includes("w")
          ? scaleX
          : scaleY;
    } else {
      scale = Math.max(
        Math.abs(nextWidth) / width || 0,
        Math.abs(nextHeight) / height || 0,
      );
    }

    const anchorsMap = {
      ne: [minX, maxY],
      se: [minX, minY],
      sw: [maxX, minY],
      nw: [maxX, maxY],
      e: [minX, minY + height / 2],
      w: [maxX, minY + height / 2],
      n: [minX + width / 2, maxY],
      s: [minX + width / 2, minY],
    } as Record<TransformHandleDirection, GlobalPoint>;

    // anchor point must be on the opposite side of the dragged selection handle
    // or be the center of the selection if shouldResizeFromCenter
    const [anchorX, anchorY] = shouldResizeFromCenter
      ? [midX, midY]
      : anchorsMap[handleDirection];

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

    /**
     * to flip an element:
     * 1. determine over which axis is the element being flipped
     *    (could be x, y, or both) indicated by `flipFactorX` & `flipFactorY`
     * 2. shift element's position by the amount of width or height (or both) or
     *    mirror points in the case of linear & freedraw elemenets
     * 3. adjust element angle
     */
    const [flipFactorX, flipFactorY] = [flipByX ? -1 : 1, flipByY ? -1 : 1];

    const elementsAndUpdates: {
      element: NonDeletedExcalidrawElement;
      update: Mutable<
        Pick<ExcalidrawElement, "x" | "y" | "width" | "height" | "angle">
      > & {
        points?: ExcalidrawLinearElement["points"];
        fontSize?: ExcalidrawTextElement["fontSize"];
        scale?: ExcalidrawImageElement["scale"];
        boundTextFontSize?: ExcalidrawTextElement["fontSize"];
        startBinding?: ExcalidrawElbowArrowElement["startBinding"];
        endBinding?: ExcalidrawElbowArrowElement["endBinding"];
        fixedSegments?: ExcalidrawElbowArrowElement["fixedSegments"];
      };
    }[] = [];

    for (const { orig, latest } of targetElements) {
      // bounded text elements are updated along with their container elements
      if (isTextElement(orig) && isBoundToContainer(orig)) {
        continue;
      }

      const width = orig.width * scaleX;
      const height = orig.height * scaleY;
      const angle = normalizeRadians(
        (orig.angle * flipFactorX * flipFactorY) as Radians,
      );

      const isLinearOrFreeDraw =
        isLinearElement(orig) || isFreeDrawElement(orig);
      const offsetX = orig.x - anchorX;
      const offsetY = orig.y - anchorY;
      const shiftX = flipByX && !isLinearOrFreeDraw ? width : 0;
      const shiftY = flipByY && !isLinearOrFreeDraw ? height : 0;
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

      if (isElbowArrow(orig)) {
        // Mirror fixed point binding for elbow arrows
        // when resize goes into the negative direction
        if (orig.startBinding) {
          update.startBinding = {
            ...orig.startBinding,
            fixedPoint: [
              flipByX
                ? -orig.startBinding.fixedPoint[0] + 1
                : orig.startBinding.fixedPoint[0],
              flipByY
                ? -orig.startBinding.fixedPoint[1] + 1
                : orig.startBinding.fixedPoint[1],
            ],
          };
        }
        if (orig.endBinding) {
          update.endBinding = {
            ...orig.endBinding,
            fixedPoint: [
              flipByX
                ? -orig.endBinding.fixedPoint[0] + 1
                : orig.endBinding.fixedPoint[0],
              flipByY
                ? -orig.endBinding.fixedPoint[1] + 1
                : orig.endBinding.fixedPoint[1],
            ],
          };
        }
        if (orig.fixedSegments && rescaledPoints.points) {
          update.fixedSegments = orig.fixedSegments.map((segment) => ({
            ...segment,
            start: rescaledPoints.points[segment.index - 1],
            end: rescaledPoints.points[segment.index],
          }));
        }
      }

      if (isImageElement(orig)) {
        update.scale = [
          orig.scale[0] * flipFactorX,
          orig.scale[1] * flipFactorY,
        ];
      }

      if (isTextElement(orig)) {
        const metrics = measureFontSizeFromWidth(orig, elementsMap, width);
        if (!metrics) {
          return;
        }
        update.fontSize = metrics.size;
      }

      const boundTextElement = originalElementsMap.get(
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

      scene.mutateElement(element, update);

      updateBoundElements(element, scene, {
        simultaneouslyUpdated: elementsToUpdate,
        newSize: { width, height },
      });

      const boundTextElement = getBoundTextElement(element, elementsMap);
      if (boundTextElement && boundTextFontSize) {
        scene.mutateElement(boundTextElement, {
          fontSize: boundTextFontSize,
          angle: isLinearElement(element) ? undefined : angle,
        });
        handleBindTextResize(element, scene, handleDirection, true);
      }
    }

    scene.triggerUpdate();
  }
};
