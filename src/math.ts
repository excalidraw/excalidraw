import { Point, AppState } from "./types";
import { ExcalidrawElement } from "./element/types";
import { getElementAbsoluteCoords } from "./element/bounds";

// https://stackoverflow.com/a/6853926/232122
export function distanceBetweenPointAndSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSquare = C * C + D * D;
  let param = -1;
  if (lenSquare !== 0) {
    // in case of 0 length line
    param = dot / lenSquare;
  }

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.hypot(dx, dy);
}

export function rotate(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  angle: number,
) {
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  return [
    (x1 - x2) * Math.cos(angle) - (y1 - y2) * Math.sin(angle) + x2,
    (x1 - x2) * Math.sin(angle) + (y1 - y2) * Math.cos(angle) + y2,
  ];
}

export function adjustXYWithRotation(
  side: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se",
  element: ExcalidrawElement,
  deltaX: number,
  deltaY: number,
) {
  let { x, y, angle } = element;
  if (side === "e" || side === "ne" || side === "se") {
    x -= (deltaX / 2) * (1 - Math.cos(angle));
    y -= (deltaX / 2) * -Math.sin(angle);
  }
  if (side === "s" || side === "sw" || side === "se") {
    x -= (deltaY / 2) * Math.sin(angle);
    y -= (deltaY / 2) * (1 - Math.cos(angle));
  }
  if (side === "w" || side === "nw" || side === "sw") {
    x += (deltaX / 2) * (1 + Math.cos(angle));
    y += (deltaX / 2) * Math.sin(angle);
  }
  if (side === "n" || side === "nw" || side === "ne") {
    x += (deltaY / 2) * -Math.sin(angle);
    y += (deltaY / 2) * (1 + Math.cos(angle));
  }
  return { x, y };
}

export function calculateResizedPosition(
  side: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se",
  element: ExcalidrawElement,
  xPointer: number,
  yPointer: number,
  appState: AppState,
  sidesWithSameLength: boolean,
): { width: number; height: number; x: number; y: number } {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);

  // center point for rotation
  const cx = x1 + (x2 - x1) / 2;
  const cy = y1 + (y2 - y1) / 2;

  // rotation with current angle
  const angle = element.angle;
  const [rotatedX, rotatedY] = rotate(xPointer, yPointer, cx, cy, -angle);

  const handleOffset = 4 / appState.zoom; // XXX import constant
  const dashedLinePadding = 4 / appState.zoom; // XXX import constant

  let scaleX, scaleY, width, height, x, y;
  switch (side) {
    case "nw": {
      scaleX = (x2 - handleOffset - dashedLinePadding - rotatedX) / (x2 - x1);
      scaleY = (y2 - handleOffset - dashedLinePadding - rotatedY) / (y2 - y1);
      width = element.width * scaleX;
      height = element.height * scaleY;
      x = element.x - (x2 - element.x) * (scaleX - 1);
      y = element.y - (y2 - element.y) * (scaleY - 1);
      if (sidesWithSameLength) {
        width = Math.max(width, height);
        height = width;
        x = x - width - x2 - rotatedX;
      }
      return {
        width,
        height,
        x,
        y,
        ...adjustXYWithRotation(
          side,
          element,
          element.width - width,
          element.height - height,
        ),
      };
    }
    case "ne": {
      scaleX = (rotatedX - handleOffset - dashedLinePadding - x1) / (x2 - x1);
      scaleY = (y2 - handleOffset - dashedLinePadding - rotatedY) / (y2 - y1);
      width = element.width * scaleX;
      height = element.height * scaleY;
      x = element.x + (element.x - x1) * (scaleX - 1);
      y = element.y - (y2 - element.y) * (scaleY - 1);
      if (sidesWithSameLength) {
        width = Math.max(width, height);
        height = width;
        x = x + (width - x2 - rotatedX);
      }
      return {
        width,
        height,
        x,
        y,
        ...adjustXYWithRotation(
          side,
          element,
          width - element.width,
          element.height - height,
        ),
      };
    }
    case "sw": {
      scaleX = (x2 - handleOffset - dashedLinePadding - rotatedX) / (x2 - x1);
      scaleY = (rotatedY - handleOffset - dashedLinePadding - y1) / (y2 - y1);
      width = element.width * scaleX;
      height = element.height * scaleY;
      x = element.x - (x2 - element.x) * (scaleX - 1);
      y = element.y + (element.y - y1) * (scaleY - 1);
      if (sidesWithSameLength) {
        width = Math.max(width, height);
        height = width;
        x = x - width - x2 - rotatedX;
      }
      return {
        width,
        height,
        x,
        y,
        ...adjustXYWithRotation(
          side,
          element,
          element.width - width,
          height - element.height,
        ),
      };
    }
    case "se": {
      scaleX = (rotatedX - handleOffset - dashedLinePadding - x1) / (x2 - x1);
      scaleY = (rotatedY - handleOffset - dashedLinePadding - y1) / (y2 - y1);
      width = element.width * scaleX;
      height = element.height * scaleY;
      x = element.x + (element.x - x1) * (scaleX - 1);
      y = element.y + (element.y - y1) * (scaleY - 1);
      if (sidesWithSameLength) {
        width = Math.max(width, height);
        height = width;
      }
      return {
        width,
        height,
        ...adjustXYWithRotation(
          side,
          element,
          width - element.width,
          height - element.height,
        ),
      };
    }
    case "n": {
      scaleY = (y2 - handleOffset - dashedLinePadding - rotatedY) / (y2 - y1);
      height = element.height * scaleY;
      y = element.y - (y2 - element.y) * (scaleY - 1);
      return {
        width: element.width,
        height,
        x: element.x,
        y,
        ...adjustXYWithRotation(side, element, 0, element.height - height),
      };
    }
    case "w": {
      scaleX = (x2 - handleOffset - dashedLinePadding - rotatedX) / (x2 - x1);
      width = element.width * scaleX;
      x = element.x - (x2 - element.x) * (scaleX - 1);
      return {
        width,
        height: element.height,
        x,
        y: element.y,
        ...adjustXYWithRotation(side, element, element.width - width, 0),
      };
    }
    case "s": {
      scaleY = (rotatedY - handleOffset - dashedLinePadding - y1) / (y2 - y1);
      height = element.height * scaleY;
      y = element.y + (element.y - y1) * (scaleY - 1);
      return {
        width: element.width,
        height,
        x: element.x,
        y,
        ...adjustXYWithRotation(side, element, 0, height - element.height),
      };
    }
    case "e": {
      scaleX = (rotatedX - handleOffset - dashedLinePadding - x1) / (x2 - x1);
      width = element.width * scaleX;
      x = element.x + (element.x - x1) * (scaleX - 1);
      return {
        width,
        height: element.height,
        x,
        y: element.y,
        ...adjustXYWithRotation(side, element, width - element.width, 0),
      };
    }
    default:
      return {
        width: element.width,
        height: element.height,
        x: element.x,
        y: element.y,
      };
  }
}

export const getPointOnAPath = (point: Point, path: Point[]) => {
  const [px, py] = point;
  const [start, ...other] = path;
  let [lastX, lastY] = start;
  let kLine: number = 0;
  let idx: number = 0;

  // if any item in the array is true, it means that a point is
  // on some segment of a line based path
  const retVal = other.some(([x2, y2], i) => {
    // we always take a line when dealing with line segments
    const x1 = lastX;
    const y1 = lastY;

    lastX = x2;
    lastY = y2;

    // if a point is not within the domain of the line segment
    // it is not on the line segment
    if (px < x1 || px > x2) {
      return false;
    }

    // check if all points lie on the same line
    // y1 = kx1 + b, y2 = kx2 + b
    // y2 - y1 = k(x2 - x2) -> k = (y2 - y1) / (x2 - x1)

    // coefficient for the line (p0, p1)
    const kL = (y2 - y1) / (x2 - x1);

    // coefficient for the line segment (p0, point)
    const kP1 = (py - y1) / (px - x1);

    // coefficient for the line segment (point, p1)
    const kP2 = (py - y2) / (px - x2);

    // because we are basing both lines from the same starting point
    // the only option for collinearity is having same coefficients

    // using it for floating point comparisons
    const epsilon = 0.3;

    // if coefficient is more than an arbitrary epsilon,
    // these lines are nor collinear
    if (Math.abs(kP1 - kL) > epsilon && Math.abs(kP2 - kL) > epsilon) {
      return false;
    }

    // store the coefficient because we are goint to need it
    kLine = kL;
    idx = i;

    return true;
  });

  // Return a coordinate that is always on the line segment
  if (retVal === true) {
    return { x: point[0], y: kLine * point[0], segment: idx };
  }

  return null;
};
