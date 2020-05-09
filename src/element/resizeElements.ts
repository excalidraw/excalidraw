import { SHIFT_LOCKING_ANGLE } from "../constants";
import { rescalePoints } from "../points";

import { rotate, adjustXYWithRotation, getFlipAdjustment } from "../math";
import {
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  ResizeArrowFnType,
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

type ResizeTestType = ReturnType<typeof resizeTest>;

export const resizeElements = (
  resizeHandle: ResizeTestType,
  setResizeHandle: (nextResizeHandle: ResizeTestType) => void,
  selectedElements: NonDeletedExcalidrawElement[],
  resizeArrowFn: ResizeArrowFnType | null, // XXX eliminate in #1339
  setResizeArrowFn: (fn: ResizeArrowFnType) => void, // XXX eliminate in #1339
  event: PointerEvent, // XXX we want to make it independent?
  pointerX: number,
  pointerY: number,
  offsetX: number,
  offsetY: number,
  lastX: number, // XXX eliminate in #1339
  lastY: number, // XXX eliminate in #1339
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
        resizeHandle,
        resizeArrowFn,
        setResizeArrowFn,
        event.shiftKey,
        pointerX,
        pointerY,
        lastX,
        lastY,
      );
    } else if (resizeHandle) {
      resizeSingleElement(
        element,
        resizeHandle,
        getResizeWithSidesSameLengthKey(event),
        getResizeCenterPointKey(event),
        pointerX,
        pointerY,
        offsetX,
        offsetY,
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
    resizeMultipleElements(
      selectedElements,
      resizeHandle,
      pointerX,
      pointerY,
      offsetX,
      offsetY,
    );
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
  resizeHandle: "nw" | "ne" | "sw" | "se",
  resizeArrowFn: ResizeArrowFnType | null,
  setResizeArrowFn: (fn: ResizeArrowFnType) => void,
  sidesWithSameLength: boolean,
  pointerX: number,
  pointerY: number,
  lastX: number,
  lastY: number,
) => {
  const [, [px, py]] = element.points;
  const isResizeEnd =
    (resizeHandle === "nw" && (px < 0 || py < 0)) ||
    (resizeHandle === "ne" && px >= 0) ||
    (resizeHandle === "sw" && px <= 0) ||
    (resizeHandle === "se" && (px > 0 || py > 0));
  applyResizeArrowFn(
    element,
    resizeArrowFn,
    setResizeArrowFn,
    isResizeEnd,
    sidesWithSameLength,
    pointerX,
    pointerY,
    lastX,
    lastY,
  );
};

const arrowResizeOrigin: ResizeArrowFnType = (
  element,
  pointIndex,
  deltaX,
  deltaY,
  pointerX,
  pointerY,
  sidesWithSameLength,
) => {
  const [px, py] = element.points[pointIndex];
  let x = element.x + deltaX;
  let y = element.y + deltaY;
  let pointX = px - deltaX;
  let pointY = py - deltaY;

  if (sidesWithSameLength) {
    const { width, height } = getPerfectElementSize(
      element.type,
      px + element.x - pointerX,
      py + element.y - pointerY,
    );
    x = px + element.x - width;
    y = py + element.y - height;
    pointX = width;
    pointY = height;
  }

  mutateElement(element, {
    x,
    y,
    points: element.points.map((point, i) =>
      i === pointIndex ? ([pointX, pointY] as const) : point,
    ),
  });
};

const arrowResizeEnd: ResizeArrowFnType = (
  element,
  pointIndex,
  deltaX,
  deltaY,
  pointerX,
  pointerY,
  sidesWithSameLength,
) => {
  const [px, py] = element.points[pointIndex];
  if (sidesWithSameLength) {
    const { width, height } = getPerfectElementSize(
      element.type,
      pointerX - element.x,
      pointerY - element.y,
    );
    mutateElement(element, {
      points: element.points.map((point, i) =>
        i === pointIndex ? ([width, height] as const) : point,
      ),
    });
  } else {
    mutateElement(element, {
      points: element.points.map((point, i) =>
        i === pointIndex ? ([px + deltaX, py + deltaY] as const) : point,
      ),
    });
  }
};

const applyResizeArrowFn = (
  element: NonDeleted<ExcalidrawLinearElement>,
  resizeArrowFn: ResizeArrowFnType | null,
  setResizeArrowFn: (fn: ResizeArrowFnType) => void,
  isResizeEnd: boolean,
  sidesWithSameLength: boolean,
  x: number,
  y: number,
  lastX: number,
  lastY: number,
) => {
  const angle = element.angle;
  const [deltaX, deltaY] = rotate(x - lastX, y - lastY, 0, 0, -angle);
  if (!resizeArrowFn) {
    if (isResizeEnd) {
      resizeArrowFn = arrowResizeEnd;
    } else {
      resizeArrowFn = arrowResizeOrigin;
    }
  }
  resizeArrowFn(element, 1, deltaX, deltaY, x, y, sidesWithSameLength);
  setResizeArrowFn(resizeArrowFn);
};

const resizeSingleElement = (
  element: NonDeletedExcalidrawElement,
  resizeHandle: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se",
  sidesWithSameLength: boolean,
  isResizeFromCenter: boolean,
  pointerX: number,
  pointerY: number,
  offsetX: number,
  offsetY: number,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  // rotation pointer with reverse angle
  const [rotatedX, rotatedY] = rotate(
    pointerX - offsetX,
    pointerY - offsetY,
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
  const rescaledPoints = isLinearElement(element)
    ? {
        points: rescalePoints(
          0,
          nextWidth,
          rescalePoints(1, nextHeight, element.points),
        ),
      }
    : {};
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
  offsetX: number,
  offsetY: number,
) => {
  const [x1, y1, x2, y2] = getCommonBounds(elements);
  switch (resizeHandle) {
    case "se": {
      const scale = Math.max(
        (pointerX - offsetX - x1) / (x2 - x1),
        (pointerY - offsetY - y1) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const x = element.x + (element.x - x1) * (scale - 1);
          const y = element.y + (element.y - y1) * (scale - 1);
          mutateElement(element, { width, height, x, y });
        });
      }
      break;
    }
    case "nw": {
      const scale = Math.max(
        (x2 - (pointerX - offsetX)) / (x2 - x1),
        (y2 - (pointerY - offsetY)) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const x = element.x - (x2 - element.x) * (scale - 1);
          const y = element.y - (y2 - element.y) * (scale - 1);
          mutateElement(element, { width, height, x, y });
        });
      }
      break;
    }
    case "ne": {
      const scale = Math.max(
        (pointerX - offsetX - x1) / (x2 - x1),
        (y2 - (pointerY - offsetY)) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const x = element.x + (element.x - x1) * (scale - 1);
          const y = element.y - (y2 - element.y) * (scale - 1);
          mutateElement(element, { width, height, x, y });
        });
      }
      break;
    }
    case "sw": {
      const scale = Math.max(
        (x2 - (pointerX - offsetX)) / (x2 - x1),
        (pointerY - offsetY - y1) / (y2 - y1),
      );
      if (scale > 0) {
        elements.forEach((element) => {
          const width = element.width * scale;
          const height = element.height * scale;
          const x = element.x - (x2 - element.x) * (scale - 1);
          const y = element.y + (element.y - y1) * (scale - 1);
          mutateElement(element, { width, height, x, y });
        });
      }
      break;
    }
  }
};

export const canResizeMutlipleElements = (
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  return elements.every((element) =>
    ["rectangle", "diamond", "ellipse"].includes(element.type),
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
