import { SHIFT_LOCKING_ANGLE } from "../constants";
import { rescalePoints } from "../points";

import { rotate, adjustXYWithRotation, getFlipAdjustment } from "../math";
import {
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
} from "./types";
import {
  getElementAbsoluteCoords,
  getCommonBounds,
  getResizedElementAbsoluteCoords,
} from "./bounds";
import { isLinearElement } from "./typeChecks";
import { mutateElement } from "./mutateElement";
import { getPerfectElementSize } from "./sizeHelpers";
import {
  getCursorForResizingElement,
  normalizeTransformHandleType,
} from "./resizeTest";
import { measureText, getFontString } from "../utils";
import { updateBoundElements } from "./binding";
import {
  TransformHandleType,
  MaybeTransformHandleType,
} from "./transformHandles";

const normalizeAngle = (angle: number): number => {
  if (angle >= 2 * Math.PI) {
    return angle - 2 * Math.PI;
  }
  return angle;
};

// Returns true when a resize (scaling/rotation) happened
export const resizeElements = (
  transformHandleType: MaybeTransformHandleType,
  setTransformHandle: (nextTransformHandle: MaybeTransformHandleType) => void,
  selectedElements: readonly NonDeletedExcalidrawElement[],
  resizeArrowDirection: "origin" | "end",
  isRotateWithDiscreteAngle: boolean,
  isResizeWithSidesSameLength: boolean,
  isResizeCenterPoint: boolean,
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
  originalElements: readonly NonDeletedExcalidrawElement[],
) => {
  if (selectedElements.length === 1) {
    const [element] = selectedElements;
    if (transformHandleType === "rotation") {
      rotateSingleElement(
        element,
        pointerX,
        pointerY,
        isRotateWithDiscreteAngle,
      );
      updateBoundElements(element);
    } else if (
      isLinearElement(element) &&
      element.points.length === 2 &&
      (transformHandleType === "nw" ||
        transformHandleType === "ne" ||
        transformHandleType === "sw" ||
        transformHandleType === "se")
    ) {
      resizeSingleTwoPointElement(
        element,
        resizeArrowDirection,
        isRotateWithDiscreteAngle,
        pointerX,
        pointerY,
      );
    } else if (
      element.type === "text" &&
      (transformHandleType === "nw" ||
        transformHandleType === "ne" ||
        transformHandleType === "sw" ||
        transformHandleType === "se")
    ) {
      resizeSingleTextElement(
        element,
        transformHandleType,
        isResizeCenterPoint,
        pointerX,
        pointerY,
      );
    } else if (transformHandleType) {
      resizeSingleElement(
        element,
        transformHandleType,
        isResizeWithSidesSameLength,
        isResizeCenterPoint,
        pointerX,
        pointerY,
      );
      setTransformHandle(
        normalizeTransformHandleType(element, transformHandleType),
      );
      if (element.width < 0) {
        mutateElement(element, { width: -element.width });
      }
      if (element.height < 0) {
        mutateElement(element, { height: -element.height });
      }
    }

    // update cursor
    // FIXME it is not very nice to have this here
    document.documentElement.style.cursor = getCursorForResizingElement({
      element,
      transformHandleType,
    });

    return true;
  } else if (selectedElements.length > 1) {
    if (transformHandleType === "rotation") {
      rotateMultipleElements(
        selectedElements,
        pointerX,
        pointerY,
        isRotateWithDiscreteAngle,
        centerX,
        centerY,
        originalElements,
      );
      return true;
    } else if (
      transformHandleType === "nw" ||
      transformHandleType === "ne" ||
      transformHandleType === "sw" ||
      transformHandleType === "se"
    ) {
      resizeMultipleElements(
        selectedElements,
        transformHandleType,
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
  pointerX: number,
  pointerY: number,
  isRotateWithDiscreteAngle: boolean,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  let angle = (5 * Math.PI) / 2 + Math.atan2(pointerY - cy, pointerX - cx);
  if (isRotateWithDiscreteAngle) {
    angle += SHIFT_LOCKING_ANGLE / 2;
    angle -= angle % SHIFT_LOCKING_ANGLE;
  }
  angle = normalizeAngle(angle);
  mutateElement(element, { angle });
};

const resizeSingleTwoPointElement = (
  element: NonDeleted<ExcalidrawLinearElement>,
  resizeArrowDirection: "origin" | "end",
  isRotateWithDiscreteAngle: boolean,
  pointerX: number,
  pointerY: number,
) => {
  const pointOrigin = element.points[0]; // can assume always [0, 0]?
  const pointEnd = element.points[1];
  if (resizeArrowDirection === "end") {
    if (isRotateWithDiscreteAngle) {
      const { width, height } = getPerfectElementSize(
        element.type,
        pointerX - element.x,
        pointerY - element.y,
      );
      mutateElement(element, {
        points: [pointOrigin, [width, height]],
      });
    } else {
      mutateElement(element, {
        points: [
          pointOrigin,
          [
            pointerX - pointOrigin[0] - element.x,
            pointerY - pointOrigin[1] - element.y,
          ],
        ],
      });
    }
  } else {
    // resizeArrowDirection === "origin"
    if (isRotateWithDiscreteAngle) {
      const { width, height } = getPerfectElementSize(
        element.type,
        element.x + pointEnd[0] - pointOrigin[0] - pointerX,
        element.y + pointEnd[1] - pointOrigin[1] - pointerY,
      );
      mutateElement(element, {
        x: element.x + pointEnd[0] - pointOrigin[0] - width,
        y: element.y + pointEnd[1] - pointOrigin[1] - height,
        points: [pointOrigin, [width, height]],
      });
    } else {
      mutateElement(element, {
        x: pointerX,
        y: pointerY,
        points: [
          pointOrigin,
          [
            pointEnd[0] - (pointerX - pointOrigin[0] - element.x),
            pointEnd[1] - (pointerY - pointOrigin[1] - element.y),
          ],
        ],
      });
    }
  }
};

const rescalePointsInElement = (
  element: NonDeletedExcalidrawElement,
  width: number,
  height: number,
) =>
  isLinearElement(element)
    ? {
        points: rescalePoints(
          0,
          width,
          rescalePoints(1, height, element.points),
        ),
      }
    : {};

const MIN_FONT_SIZE = 1;

const measureFontSizeFromWH = (
  element: NonDeleted<ExcalidrawTextElement>,
  nextWidth: number,
  nextHeight: number,
): { size: number; baseline: number } | null => {
  // We only use width to scale font on resize
  const nextFontSize = element.fontSize * (nextWidth / element.width);
  if (nextFontSize < MIN_FONT_SIZE) {
    return null;
  }
  const metrics = measureText(
    element.text,
    getFontString({ fontSize: nextFontSize, fontFamily: element.fontFamily }),
  );
  return {
    size: nextFontSize,
    baseline: metrics.baseline + (nextHeight - metrics.height),
  };
};

const getSidesForTransformHandle = (
  transformHandleType: TransformHandleType,
  isResizeFromCenter: boolean,
) => {
  return {
    n:
      /^(n|ne|nw)$/.test(transformHandleType) ||
      (isResizeFromCenter && /^(s|se|sw)$/.test(transformHandleType)),
    s:
      /^(s|se|sw)$/.test(transformHandleType) ||
      (isResizeFromCenter && /^(n|ne|nw)$/.test(transformHandleType)),
    w:
      /^(w|nw|sw)$/.test(transformHandleType) ||
      (isResizeFromCenter && /^(e|ne|se)$/.test(transformHandleType)),
    e:
      /^(e|ne|se)$/.test(transformHandleType) ||
      (isResizeFromCenter && /^(w|nw|sw)$/.test(transformHandleType)),
  };
};

const resizeSingleTextElement = (
  element: NonDeleted<ExcalidrawTextElement>,
  transformHandleType: "nw" | "ne" | "sw" | "se",
  isResizeFromCenter: boolean,
  pointerX: number,
  pointerY: number,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  // rotation pointer with reverse angle
  const [rotatedX, rotatedY] = rotate(
    pointerX,
    pointerY,
    cx,
    cy,
    -element.angle,
  );
  let scale;
  switch (transformHandleType) {
    case "se":
      scale = Math.max(
        (rotatedX - x1) / (x2 - x1),
        (rotatedY - y1) / (y2 - y1),
      );
      break;
    case "nw":
      scale = Math.max(
        (x2 - rotatedX) / (x2 - x1),
        (y2 - rotatedY) / (y2 - y1),
      );
      break;
    case "ne":
      scale = Math.max(
        (rotatedX - x1) / (x2 - x1),
        (y2 - rotatedY) / (y2 - y1),
      );
      break;
    case "sw":
      scale = Math.max(
        (x2 - rotatedX) / (x2 - x1),
        (rotatedY - y1) / (y2 - y1),
      );
      break;
  }
  if (scale > 0) {
    const nextWidth = element.width * scale;
    const nextHeight = element.height * scale;
    const nextFont = measureFontSizeFromWH(element, nextWidth, nextHeight);
    if (nextFont === null) {
      return;
    }
    const [nextX1, nextY1, nextX2, nextY2] = getResizedElementAbsoluteCoords(
      element,
      nextWidth,
      nextHeight,
    );
    const deltaX1 = (x1 - nextX1) / 2;
    const deltaY1 = (y1 - nextY1) / 2;
    const deltaX2 = (x2 - nextX2) / 2;
    const deltaY2 = (y2 - nextY2) / 2;
    const [nextElementX, nextElementY] = adjustXYWithRotation(
      getSidesForTransformHandle(transformHandleType, isResizeFromCenter),
      element.x,
      element.y,
      element.angle,
      deltaX1,
      deltaY1,
      deltaX2,
      deltaY2,
    );
    mutateElement(element, {
      fontSize: nextFont.size,
      width: nextWidth,
      height: nextHeight,
      baseline: nextFont.baseline,
      x: nextElementX,
      y: nextElementY,
    });
  }
};

const resizeSingleElement = (
  element: NonDeletedExcalidrawElement,
  transformHandleType: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se",
  sidesWithSameLength: boolean,
  isResizeFromCenter: boolean,
  pointerX: number,
  pointerY: number,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  // rotation pointer with reverse angle
  const [rotatedX, rotatedY] = rotate(
    pointerX,
    pointerY,
    cx,
    cy,
    -element.angle,
  );
  let scaleX = 1;
  let scaleY = 1;
  if (
    transformHandleType === "e" ||
    transformHandleType === "ne" ||
    transformHandleType === "se"
  ) {
    scaleX = (rotatedX - x1) / (x2 - x1);
  }
  if (
    transformHandleType === "s" ||
    transformHandleType === "sw" ||
    transformHandleType === "se"
  ) {
    scaleY = (rotatedY - y1) / (y2 - y1);
  }
  if (
    transformHandleType === "w" ||
    transformHandleType === "nw" ||
    transformHandleType === "sw"
  ) {
    scaleX = (x2 - rotatedX) / (x2 - x1);
  }
  if (
    transformHandleType === "n" ||
    transformHandleType === "nw" ||
    transformHandleType === "ne"
  ) {
    scaleY = (y2 - rotatedY) / (y2 - y1);
  }
  let nextWidth = element.width * scaleX;
  let nextHeight = element.height * scaleY;
  if (sidesWithSameLength) {
    nextWidth = nextHeight = Math.max(nextWidth, nextHeight);
  }
  const [nextX1, nextY1, nextX2, nextY2] = getResizedElementAbsoluteCoords(
    element,
    nextWidth,
    nextHeight,
  );
  const deltaX1 = (x1 - nextX1) / 2;
  const deltaY1 = (y1 - nextY1) / 2;
  const deltaX2 = (x2 - nextX2) / 2;
  const deltaY2 = (y2 - nextY2) / 2;
  const rescaledPoints = rescalePointsInElement(element, nextWidth, nextHeight);
  updateBoundElements(element, {
    newSize: { width: nextWidth, height: nextHeight },
  });
  const [finalX1, finalY1, finalX2, finalY2] = getResizedElementAbsoluteCoords(
    {
      ...element,
      ...rescaledPoints,
    },
    Math.abs(nextWidth),
    Math.abs(nextHeight),
  );
  const [flipDiffX, flipDiffY] = getFlipAdjustment(
    transformHandleType,
    nextWidth,
    nextHeight,
    nextX1,
    nextY1,
    nextX2,
    nextY2,
    finalX1,
    finalY1,
    finalX2,
    finalY2,
    isLinearElement(element),
    element.angle,
  );
  const [nextElementX, nextElementY] = adjustXYWithRotation(
    getSidesForTransformHandle(transformHandleType, isResizeFromCenter),
    element.x - flipDiffX,
    element.y - flipDiffY,
    element.angle,
    deltaX1,
    deltaY1,
    deltaX2,
    deltaY2,
  );
  if (
    nextWidth !== 0 &&
    nextHeight !== 0 &&
    Number.isFinite(nextElementX) &&
    Number.isFinite(nextElementY)
  ) {
    mutateElement(element, {
      width: nextWidth,
      height: nextHeight,
      x: nextElementX,
      y: nextElementY,
      ...rescaledPoints,
    });
  }
};

const resizeMultipleElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  transformHandleType: "nw" | "ne" | "sw" | "se",
  pointerX: number,
  pointerY: number,
) => {
  const [x1, y1, x2, y2] = getCommonBounds(elements);
  let scale: number;
  let getNextXY: (
    element: NonDeletedExcalidrawElement,
    origCoords: readonly [number, number, number, number],
    finalCoords: readonly [number, number, number, number],
  ) => { x: number; y: number };
  switch (transformHandleType) {
    case "se":
      scale = Math.max(
        (pointerX - x1) / (x2 - x1),
        (pointerY - y1) / (y2 - y1),
      );
      getNextXY = (element, [origX1, origY1], [finalX1, finalY1]) => {
        const x = element.x + (origX1 - x1) * (scale - 1) + origX1 - finalX1;
        const y = element.y + (origY1 - y1) * (scale - 1) + origY1 - finalY1;
        return { x, y };
      };
      break;
    case "nw":
      scale = Math.max(
        (x2 - pointerX) / (x2 - x1),
        (y2 - pointerY) / (y2 - y1),
      );
      getNextXY = (element, [, , origX2, origY2], [, , finalX2, finalY2]) => {
        const x = element.x - (x2 - origX2) * (scale - 1) + origX2 - finalX2;
        const y = element.y - (y2 - origY2) * (scale - 1) + origY2 - finalY2;
        return { x, y };
      };
      break;
    case "ne":
      scale = Math.max(
        (pointerX - x1) / (x2 - x1),
        (y2 - pointerY) / (y2 - y1),
      );
      getNextXY = (element, [origX1, , , origY2], [finalX1, , , finalY2]) => {
        const x = element.x + (origX1 - x1) * (scale - 1) + origX1 - finalX1;
        const y = element.y - (y2 - origY2) * (scale - 1) + origY2 - finalY2;
        return { x, y };
      };
      break;
    case "sw":
      scale = Math.max(
        (x2 - pointerX) / (x2 - x1),
        (pointerY - y1) / (y2 - y1),
      );
      getNextXY = (element, [, origY1, origX2], [, finalY1, finalX2]) => {
        const x = element.x - (x2 - origX2) * (scale - 1) + origX2 - finalX2;
        const y = element.y + (origY1 - y1) * (scale - 1) + origY1 - finalY1;
        return { x, y };
      };
      break;
  }
  if (scale > 0) {
    const updates = elements.reduce(
      (prev, element) => {
        if (!prev) {
          return prev;
        }
        const width = element.width * scale;
        const height = element.height * scale;
        let font: { fontSize?: number; baseline?: number } = {};
        if (element.type === "text") {
          const nextFont = measureFontSizeFromWH(element, width, height);
          if (nextFont === null) {
            return null;
          }
          font = { fontSize: nextFont.size, baseline: nextFont.baseline };
        }
        const origCoords = getElementAbsoluteCoords(element);
        const rescaledPoints = rescalePointsInElement(element, width, height);
        updateBoundElements(element, {
          newSize: { width, height },
          simultaneouslyUpdated: elements,
        });
        const finalCoords = getResizedElementAbsoluteCoords(
          {
            ...element,
            ...rescaledPoints,
          },
          width,
          height,
        );
        const { x, y } = getNextXY(element, origCoords, finalCoords);
        return [...prev, { width, height, x, y, ...rescaledPoints, ...font }];
      },
      [] as
        | {
            width: number;
            height: number;
            x: number;
            y: number;
            points?: (readonly [number, number])[];
            fontSize?: number;
            baseline?: number;
          }[]
        | null,
    );
    if (updates) {
      elements.forEach((element, index) => {
        mutateElement(element, updates[index]);
      });
    }
  }
};

const rotateMultipleElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  pointerX: number,
  pointerY: number,
  isRotateWithDiscreteAngle: boolean,
  centerX: number,
  centerY: number,
  originalElements: readonly NonDeletedExcalidrawElement[],
) => {
  let centerAngle =
    (5 * Math.PI) / 2 + Math.atan2(pointerY - centerY, pointerX - centerX);
  if (isRotateWithDiscreteAngle) {
    centerAngle += SHIFT_LOCKING_ANGLE / 2;
    centerAngle -= centerAngle % SHIFT_LOCKING_ANGLE;
  }
  elements.forEach((element, index) => {
    if (isLinearElement(element) && element.points.length === 2) {
      // FIXME this is a bit tricky (how can we make this more readable?)
      const originalElement = originalElements[index];
      if (
        !isLinearElement(originalElement) ||
        originalElement.points.length !== 2
      ) {
        throw new Error("original element not compatible"); // should not happen
      }
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(originalElement);
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const [rotatedCX, rotatedCY] = rotate(
        cx,
        cy,
        centerX,
        centerY,
        centerAngle,
      );
      const { points } = originalElement;
      const [rotatedX, rotatedY] = rotate(
        points[1][0],
        points[1][1],
        points[0][0],
        points[0][1],
        centerAngle,
      );
      mutateElement(element, {
        x:
          originalElement.x +
          (rotatedCX - cx) +
          ((originalElement.points[0][0] + originalElement.points[1][0]) / 2 -
            (points[0][0] + rotatedX) / 2),
        y:
          originalElement.y +
          (rotatedCY - cy) +
          ((originalElement.points[0][1] + originalElement.points[1][1]) / 2 -
            (points[0][1] + rotatedY) / 2),
        points: [
          [points[0][0], points[0][1]],
          [rotatedX, rotatedY],
        ],
      });
    } else {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const [rotatedCX, rotatedCY] = rotate(
        cx,
        cy,
        centerX,
        centerY,
        centerAngle + originalElements[index].angle - element.angle,
      );
      mutateElement(element, {
        x: element.x + (rotatedCX - cx),
        y: element.y + (rotatedCY - cy),
        angle: normalizeAngle(centerAngle + originalElements[index].angle),
      });
    }
  });
};

export const getResizeOffsetXY = (
  transformHandleType: MaybeTransformHandleType,
  selectedElements: NonDeletedExcalidrawElement[],
  x: number,
  y: number,
): [number, number] => {
  const [x1, y1, x2, y2] =
    selectedElements.length === 1
      ? getElementAbsoluteCoords(selectedElements[0])
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
