import { ExcalidrawElement, ExcalidrawLinearElement } from "./types";
import { rotate } from "../math";
import { Drawable } from "roughjs/bin/core";
import { Point } from "../types";
import { getShapeForElement } from "../renderer/renderElement";
import { isLinearElement } from "./typeChecks";

// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
export function getElementAbsoluteCoords(element: ExcalidrawElement) {
  if (isLinearElement(element)) {
    return getLinearElementAbsoluteBounds(element);
  }
  return [
    element.x,
    element.y,
    element.x + element.width,
    element.y + element.height,
  ];
}

export function getDiamondPoints(element: ExcalidrawElement) {
  // Here we add +1 to avoid these numbers to be 0
  // otherwise rough.js will throw an error complaining about it
  const topX = Math.floor(element.width / 2) + 1;
  const topY = 0;
  const rightX = element.width;
  const rightY = Math.floor(element.height / 2) + 1;
  const bottomX = topX;
  const bottomY = element.height;
  const leftX = topY;
  const leftY = rightY;

  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
}

export function getLinearElementAbsoluteBounds(
  element: ExcalidrawLinearElement,
) {
  if (element.points.length < 2 || !getShapeForElement(element)) {
    const { minX, minY, maxX, maxY } = element.points.reduce(
      (limits, [x, y]) => {
        limits.minY = Math.min(limits.minY, y);
        limits.minX = Math.min(limits.minX, x);

        limits.maxX = Math.max(limits.maxX, x);
        limits.maxY = Math.max(limits.maxY, y);

        return limits;
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    return [
      minX + element.x,
      minY + element.y,
      maxX + element.x,
      maxY + element.y,
    ];
  }

  const shape = getShapeForElement(element) as Drawable[];

  // first element is always the curve
  const ops = shape[0].sets[0].ops;

  let currentP: Point = [0, 0];

  const { minX, minY, maxX, maxY } = ops.reduce(
    (limits, { op, data }) => {
      // There are only four operation types:
      // move, bcurveTo, lineTo, and curveTo
      if (op === "move") {
        // change starting point
        currentP = (data as unknown) as Point;
        // move operation does not draw anything; so, it always
        // returns false
      } else if (op === "bcurveTo") {
        // create points from bezier curve
        // bezier curve stores data as a flattened array of three positions
        // [x1, y1, x2, y2, x3, y3]
        const p1 = [data[0], data[1]] as Point;
        const p2 = [data[2], data[3]] as Point;
        const p3 = [data[4], data[5]] as Point;

        const p0 = currentP;
        currentP = p3;

        const equation = (t: number, idx: number) =>
          Math.pow(1 - t, 3) * p3[idx] +
          3 * t * Math.pow(1 - t, 2) * p2[idx] +
          3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
          p0[idx] * Math.pow(t, 3);

        let t = 0;
        while (t <= 1.0) {
          const x = equation(t, 0);
          const y = equation(t, 1);

          limits.minY = Math.min(limits.minY, y);
          limits.minX = Math.min(limits.minX, x);

          limits.maxX = Math.max(limits.maxX, x);
          limits.maxY = Math.max(limits.maxY, y);

          t += 0.1;
        }
      } else if (op === "lineTo") {
        // TODO: Implement this
      } else if (op === "qcurveTo") {
        // TODO: Implement this
      }
      return limits;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
}

export function getArrowPoints(
  element: ExcalidrawLinearElement,
  shape: Drawable[],
) {
  const ops = shape[0].sets[0].ops;

  const data = ops[ops.length - 1].data;
  const p3 = [data[4], data[5]] as Point;
  const p2 = [data[2], data[3]] as Point;
  const p1 = [data[0], data[1]] as Point;

  // we need to find p0 of the bezier curve
  // it is typically the last point of the previous
  // curve; it can also be the position of moveTo operation
  const prevOp = ops[ops.length - 2];
  let p0: Point = [0, 0];
  if (prevOp.op === "move") {
    p0 = (prevOp.data as unknown) as Point;
  } else if (prevOp.op === "bcurveTo") {
    p0 = [prevOp.data[4], prevOp.data[5]];
  }

  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  // we know the last point of the arrow
  const [x2, y2] = p3;

  // by using cubic bezier equation (B(t)) and the given parameters,
  // we calculate a point that is closer to the last point
  // The value 0.3 is chosen arbitrarily and it works best for all
  // the tested cases
  const [x1, y1] = [equation(0.3, 0), equation(0.3, 1)];

  // find the normalized direction vector based on the
  // previously calculated points
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const nx = (x2 - x1) / distance;
  const ny = (y2 - y1) / distance;

  const size = 30; // pixels
  const arrowLength = element.points.reduce((total, [cx, cy], idx, points) => {
    const [px, py] = idx > 0 ? points[idx - 1] : [0, 0];
    return total + Math.hypot(cx - px, cy - py);
  }, 0);

  // Scale down the arrow until we hit a certain size so that it doesn't look weird
  // This value is selected by minizing a minmum size with the whole length of the arrow
  // intead of last segment of the arrow
  const minSize = Math.min(size, arrowLength / 2);
  const xs = x2 - nx * minSize;
  const ys = y2 - ny * minSize;

  const angle = 20; // degrees
  const [x3, y3] = rotate(xs, ys, x2, y2, (-angle * Math.PI) / 180);
  const [x4, y4] = rotate(xs, ys, x2, y2, (angle * Math.PI) / 180);

  return [x2, y2, x3, y3, x4, y4];
}

export function getCommonBounds(elements: readonly ExcalidrawElement[]) {
  if (!elements.length) {
    return [0, 0, 0, 0];
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const angle = element.angle;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const [x11, y11] = rotate(x1, y1, cx, cy, angle);
    const [x12, y12] = rotate(x1, y2, cx, cy, angle);
    const [x22, y22] = rotate(x2, y2, cx, cy, angle);
    const [x21, y21] = rotate(x2, y1, cx, cy, angle);
    minX = Math.min(minX, x11, x12, x22, x21);
    minY = Math.min(minY, y11, y12, y22, y21);
    maxX = Math.max(maxX, x11, x12, x22, x21);
    maxY = Math.max(maxY, y11, y12, y22, y21);
  });

  return [minX, minY, maxX, maxY];
}
