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
  resizeTest,
  getCursorForResizingElement,
  normalizeResizeHandle,
} from "./resizeTest";
import {
  getResizeCenterPointKey,
  getResizeWithSidesSameLengthKey,
} from "../keys";
import { measureText, getFontString } from "../utils";

type ResizeTestType = ReturnType<typeof resizeTest>;

export const resizeElements = (
  resizeHandle: ResizeTestType,
  setResizeHandle: (nextResizeHandle: ResizeTestType) => void,
  selectedElements: NonDeletedExcalidrawElement[],
  resizeArrowDirection: "origin" | "end",
  event: PointerEvent, // XXX we want to make it independent?
  pointerX: number,
  pointerY: number,
) => {
  if (selectedElements.length === 1) {
    const [element] = selectedElements;
    if (resizeHandle === "rotation") {
      rotateSingleElement(element, pointerX, pointerY, event.shiftKey);
    } else if (
      isLinearElement(element) &&
      element.points.length === 2 &&
      (resizeHandle === "nw" ||
        resizeHandle === "ne" ||
        resizeHandle === "sw" ||
        resizeHandle === "se")
    ) {
      resizeSingleTwoPointElement(
        element,
        resizeArrowDirection,
        event.shiftKey,
        pointerX,
        pointerY,
      );
    } else if (
      element.type === "text" &&
      (resizeHandle === "nw" ||
        resizeHandle === "ne" ||
        resizeHandle === "sw" ||
        resizeHandle === "se")
    ) {
      resizeSingleTextElement(
        element,
        resizeHandle,
        getResizeCenterPointKey(event),
        pointerX,
        pointerY,
      );
    } else if (resizeHandle) {
      resizeSingleElement(
        element,
        resizeHandle,
        getResizeWithSidesSameLengthKey(event),
        getResizeCenterPointKey(event),
        pointerX,
        pointerY,
      );
      setResizeHandle(normalizeResizeHandle(element, resizeHandle));
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
      resizeHandle,
    });

    return true;
  } else if (
    selectedElements.length > 1 &&
    (resizeHandle === "nw" ||
      resizeHandle === "ne" ||
      resizeHandle === "sw" ||
      resizeHandle === "se")
  ) {
    resizeMultipleElements(selectedElements, resizeHandle, pointerX, pointerY);
    return true;
  }
  return false;
};

const rotateSingleElement = (
  element: NonDeletedExcalidrawElement,
  pointerX: number,
  pointerY: number,
  isAngleLocking: boolean,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  let angle = (5 * Math.PI) / 2 + Math.atan2(pointerY - cy, pointerX - cx);
  if (isAngleLocking) {
    angle += SHIFT_LOCKING_ANGLE / 2;
    angle -= angle % SHIFT_LOCKING_ANGLE;
  }
  if (angle >= 2 * Math.PI) {
    angle -= 2 * Math.PI;
  }
  mutateElement(element, { angle });
};

const resizeSingleTwoPointElement = (
  element: NonDeleted<ExcalidrawLinearElement>,
  resizeArrowDirection: "origin" | "end",
  isAngleLocking: boolean,
  pointerX: number,
  pointerY: number,
) => {
  const pointOrigin = element.points[0]; // can assume always [0, 0]?
  const pointEnd = element.points[1];
  if (resizeArrowDirection === "end") {
    if (isAngleLocking) {
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
    if (isAngleLocking) {
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

const resizeSingleTextElement = (
  element: NonDeleted<ExcalidrawTextElement>,
  resizeHandle: "nw" | "ne" | "sw" | "se",
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
  switch (resizeHandle) {
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
    const newFontSize = Math.max(element.fontSize * scale, 10);
    const metrics = measureText(
      element.text,
      getFontString({ fontSize: newFontSize, fontFamily: element.fontFamily }),
    );
    if (
      Math.abs(metrics.width - element.width) <= 1 ||
      Math.abs(metrics.height - element.height) <= 1
    ) {
      // we ignore 1px change to avoid janky behavior
      return;
    }
    const [nextX1, nextY1, nextX2, nextY2] = getResizedElementAbsoluteCoords(
      element,
      metrics.width,
      metrics.height,
    );
    const deltaX1 = (x1 - nextX1) / 2;
    const deltaY1 = (y1 - nextY1) / 2;
    const deltaX2 = (x2 - nextX2) / 2;
    const deltaY2 = (y2 - nextY2) / 2;
    const [nextElementX, nextElementY] = adjustXYWithRotation(
      resizeHandle,
      element.x,
      element.y,
      element.angle,
      deltaX1,
      deltaY1,
      deltaX2,
      deltaY2,
      isResizeFromCenter,
    );
    mutateElement(element, {
      fontSize: newFontSize,
      width: metrics.width,
      height: metrics.height,
      baseline: metrics.baseline,
      x: nextElementX,
      y: nextElementY,
    });
  }
};

const resizeSingleElement = (
  element: NonDeletedExcalidrawElement,
  resizeHandle: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se",
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
  if (resizeHandle === "e" || resizeHandle === "ne" || resizeHandle === "se") {
    scaleX = (rotatedX - x1) / (x2 - x1);
  }
  if (resizeHandle === "s" || resizeHandle === "sw" || resizeHandle === "se") {
    scaleY = (rotatedY - y1) / (y2 - y1);
  }
  if (resizeHandle === "w" || resizeHandle === "nw" || resizeHandle === "sw") {
    scaleX = (x2 - rotatedX) / (x2 - x1);
  }
  if (resizeHandle === "n" || resizeHandle === "nw" || resizeHandle === "ne") {
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
  const [finalX1, finalY1, finalX2, finalY2] = getResizedElementAbsoluteCoords(
    {
      ...element,
      ...rescaledPoints,
    },
    Math.abs(nextWidth),
    Math.abs(nextHeight),
  );
  const [flipDiffX, flipDiffY] = getFlipAdjustment(
    resizeHandle,
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
    resizeHandle,
    element.x - flipDiffX,
    element.y - flipDiffY,
    element.angle,
    deltaX1,
    deltaY1,
    deltaX2,
    deltaY2,
    isResizeFromCenter,
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
  resizeHandle: "nw" | "ne" | "sw" | "se",
  pointerX: number,
  pointerY: number,
) => {
  const [x1, y1, x2, y2] = getCommonBounds(elements);
  switch (resizeHandle) {
    case "se": {
      const scale = Math.max(
        (pointerX - x1) / (x2 - x1),
        (pointerY - y1) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const [origX1, origY1] = getElementAbsoluteCoords(element);
          const rescaledPoints = rescalePointsInElement(element, width, height);
          const [finalX1, finalY1] = getResizedElementAbsoluteCoords(
            {
              ...element,
              ...rescaledPoints,
            },
            width,
            height,
          );
          const x = element.x + (origX1 - x1) * (scale - 1) + origX1 - finalX1;
          const y = element.y + (origY1 - y1) * (scale - 1) + origY1 - finalY1;
          mutateElement(element, { width, height, x, y, ...rescaledPoints });
        });
      }
      break;
    }
    case "nw": {
      const scale = Math.max(
        (x2 - pointerX) / (x2 - x1),
        (y2 - pointerY) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const [, , origX2, origY2] = getElementAbsoluteCoords(element);
          const rescaledPoints = rescalePointsInElement(element, width, height);
          const [, , finalX2, finalY2] = getResizedElementAbsoluteCoords(
            {
              ...element,
              ...rescaledPoints,
            },
            width,
            height,
          );
          const x = element.x - (x2 - origX2) * (scale - 1) + origX2 - finalX2;
          const y = element.y - (y2 - origY2) * (scale - 1) + origY2 - finalY2;
          mutateElement(element, { width, height, x, y, ...rescaledPoints });
        });
      }
      break;
    }
    case "ne": {
      const scale = Math.max(
        (pointerX - x1) / (x2 - x1),
        (y2 - pointerY) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const [origX1, , , origY2] = getElementAbsoluteCoords(element);
          const rescaledPoints = rescalePointsInElement(element, width, height);
          const [finalX1, , , finalY2] = getResizedElementAbsoluteCoords(
            {
              ...element,
              ...rescaledPoints,
            },
            width,
            height,
          );
          const x = element.x + (origX1 - x1) * (scale - 1) + origX1 - finalX1;
          const y = element.y - (y2 - origY2) * (scale - 1) + origY2 - finalY2;
          mutateElement(element, { width, height, x, y, ...rescaledPoints });
        });
      }
      break;
    }
    case "sw": {
      const scale = Math.max(
        (x2 - pointerX) / (x2 - x1),
        (pointerY - y1) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const [, origY1, origX2] = getElementAbsoluteCoords(element);
          const rescaledPoints = rescalePointsInElement(element, width, height);
          const [, finalY1, finalX2] = getResizedElementAbsoluteCoords(
            {
              ...element,
              ...rescaledPoints,
            },
            width,
            height,
          );
          const x = element.x - (x2 - origX2) * (scale - 1) + origX2 - finalX2;
          const y = element.y + (origY1 - y1) * (scale - 1) + origY1 - finalY1;
          mutateElement(element, { width, height, x, y, ...rescaledPoints });
        });
      }
      break;
    }
  }
};

export const canResizeMutlipleElements = (
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  return elements.every(
    (element) =>
      ["rectangle", "diamond", "ellipse"].includes(element.type) ||
      isLinearElement(element),
  );
};

export const getResizeOffsetXY = (
  resizeHandle: ResizeTestType,
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
  switch (resizeHandle) {
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
  resizeHandle: ResizeTestType,
  element: NonDeleted<ExcalidrawLinearElement>,
): "origin" | "end" => {
  const [, [px, py]] = element.points;
  const isResizeEnd =
    (resizeHandle === "nw" && (px < 0 || py < 0)) ||
    (resizeHandle === "ne" && px >= 0) ||
    (resizeHandle === "sw" && px <= 0) ||
    (resizeHandle === "se" && (px > 0 || py > 0));
  return isResizeEnd ? "end" : "origin";
};
