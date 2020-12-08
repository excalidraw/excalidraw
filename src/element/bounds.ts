import { ExcalidrawElement, ExcalidrawLinearElement, Arrowhead } from "./types";
import { distance2d, rotate } from "../math";
import rough from "roughjs/bin/rough";
import { Drawable, Op } from "roughjs/bin/core";
import { Point } from "../types";
import {
  getShapeForElement,
  generateRoughOptions,
} from "../renderer/renderElement";
import { isLinearElement } from "./typeChecks";
import { rescalePoints } from "../points";

// x and y position of top left corner, x and y position of bottom right corner
export type Bounds = readonly [number, number, number, number];

// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
export const getElementAbsoluteCoords = (
  element: ExcalidrawElement,
): Bounds => {
  if (isLinearElement(element)) {
    return getLinearElementAbsoluteCoords(element);
  }
  return [
    element.x,
    element.y,
    element.x + element.width,
    element.y + element.height,
  ];
};

export const pointRelativeTo = (
  element: ExcalidrawElement,
  absoluteCoords: Point,
): Point => {
  return [absoluteCoords[0] - element.x, absoluteCoords[1] - element.y];
};

export const getDiamondPoints = (element: ExcalidrawElement) => {
  // Here we add +1 to avoid these numbers to be 0
  // otherwise rough.js will throw an error complaining about it
  const topX = Math.floor(element.width / 2) + 1;
  const topY = 0;
  const rightX = element.width;
  const rightY = Math.floor(element.height / 2) + 1;
  const bottomX = topX;
  const bottomY = element.height;
  const leftX = 0;
  const leftY = rightY;

  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
};

export const getCurvePathOps = (shape: Drawable): Op[] => {
  for (const set of shape.sets) {
    if (set.type === "path") {
      return set.ops;
    }
  }
  return shape.sets[0].ops;
};

const getMinMaxXYFromCurvePathOps = (
  ops: Op[],
  transformXY?: (x: number, y: number) => [number, number],
): [number, number, number, number] => {
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
          let x = equation(t, 0);
          let y = equation(t, 1);
          if (transformXY) {
            [x, y] = transformXY(x, y);
          }

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

  return [minX, minY, maxX, maxY];
};

const getLinearElementAbsoluteCoords = (
  element: ExcalidrawLinearElement,
): [number, number, number, number] => {
  if (element.points.length < 2 || !getShapeForElement(element)) {
    // XXX this is just a poor estimate and not very useful
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
  const ops = getCurvePathOps(shape[0]);

  const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);

  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

export const getArrowheadPoints = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
) => {
  const ops = getCurvePathOps(shape[0]);
  if (ops.length < 1) {
    return null;
  }

  // The index of the bCurve operation to examine.
  const index = position === "start" ? 1 : ops.length - 1;

  const data = ops[index].data;
  const p3 = [data[4], data[5]] as Point;
  const p2 = [data[2], data[3]] as Point;
  const p1 = [data[0], data[1]] as Point;

  // We need to find p0 of the bezier curve.
  // It is typically the last point of the previous
  // curve; it can also be the position of moveTo operation.
  const prevOp = ops[index - 1];
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

  // Ee know the last point of the arrow (or the first, if start arrowhead).
  const [x2, y2] = position === "start" ? p0 : p3;

  // By using cubic bezier equation (B(t)) and the given parameters,
  // we calculate a point that is closer to the last point.
  // The value 0.3 is chosen arbitrarily and it works best for all
  // the tested cases.
  const [x1, y1] = [equation(0.3, 0), equation(0.3, 1)];

  // Find the normalized direction vector based on the
  // previously calculated points.
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const nx = (x2 - x1) / distance;
  const ny = (y2 - y1) / distance;

  const size = {
    arrow: 30,
    bar: 15,
    dot: 15,
  }[arrowhead]; // pixels (will differ for each arrowhead)

  const length = element.points.reduce((total, [cx, cy], idx, points) => {
    const [px, py] = idx > 0 ? points[idx - 1] : [0, 0];
    return total + Math.hypot(cx - px, cy - py);
  }, 0);

  // Scale down the arrowhead until we hit a certain size so that it doesn't look weird.
  // This value is selected by minimizing a minimum size with the whole length of the
  // arrowhead instead of last segment of the arrowhead.
  const minSize = Math.min(size, length / 2);
  const xs = x2 - nx * minSize;
  const ys = y2 - ny * minSize;

  if (arrowhead === "dot") {
    const r = Math.hypot(ys - y2, xs - x2);
    return [x2, y2, r];
  }

  const angle = {
    arrow: 20,
    bar: 90,
  }[arrowhead]; // degrees

  // Return points
  const [x3, y3] = rotate(xs, ys, x2, y2, (-angle * Math.PI) / 180);
  const [x4, y4] = rotate(xs, ys, x2, y2, (angle * Math.PI) / 180);
  return [x2, y2, x3, y3, x4, y4];
};

const getLinearElementRotatedBounds = (
  element: ExcalidrawLinearElement,
  cx: number,
  cy: number,
): [number, number, number, number] => {
  if (element.points.length < 2 || !getShapeForElement(element)) {
    // XXX this is just a poor estimate and not very useful
    const { minX, minY, maxX, maxY } = element.points.reduce(
      (limits, [x, y]) => {
        [x, y] = rotate(element.x + x, element.y + y, cx, cy, element.angle);
        limits.minY = Math.min(limits.minY, y);
        limits.minX = Math.min(limits.minX, x);
        limits.maxX = Math.max(limits.maxX, x);
        limits.maxY = Math.max(limits.maxY, y);
        return limits;
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    return [minX, minY, maxX, maxY];
  }

  const shape = getShapeForElement(element) as Drawable[];

  // first element is always the curve
  const ops = getCurvePathOps(shape[0]);

  const transformXY = (x: number, y: number) =>
    rotate(element.x + x, element.y + y, cx, cy, element.angle);
  return getMinMaxXYFromCurvePathOps(ops, transformXY);
};

export const getElementBounds = (
  element: ExcalidrawElement,
): [number, number, number, number] => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  if (isLinearElement(element)) {
    return getLinearElementRotatedBounds(element, cx, cy);
  }
  if (element.type === "diamond") {
    const [x11, y11] = rotate(cx, y1, cx, cy, element.angle);
    const [x12, y12] = rotate(cx, y2, cx, cy, element.angle);
    const [x22, y22] = rotate(x1, cy, cx, cy, element.angle);
    const [x21, y21] = rotate(x2, cy, cx, cy, element.angle);
    const minX = Math.min(x11, x12, x22, x21);
    const minY = Math.min(y11, y12, y22, y21);
    const maxX = Math.max(x11, x12, x22, x21);
    const maxY = Math.max(y11, y12, y22, y21);
    return [minX, minY, maxX, maxY];
  }
  if (element.type === "ellipse") {
    const w = (x2 - x1) / 2;
    const h = (y2 - y1) / 2;
    const cos = Math.cos(element.angle);
    const sin = Math.sin(element.angle);
    const ww = Math.hypot(w * cos, h * sin);
    const hh = Math.hypot(h * cos, w * sin);
    return [cx - ww, cy - hh, cx + ww, cy + hh];
  }
  const [x11, y11] = rotate(x1, y1, cx, cy, element.angle);
  const [x12, y12] = rotate(x1, y2, cx, cy, element.angle);
  const [x22, y22] = rotate(x2, y2, cx, cy, element.angle);
  const [x21, y21] = rotate(x2, y1, cx, cy, element.angle);
  const minX = Math.min(x11, x12, x22, x21);
  const minY = Math.min(y11, y12, y22, y21);
  const maxX = Math.max(x11, x12, x22, x21);
  const maxY = Math.max(y11, y12, y22, y21);
  return [minX, minY, maxX, maxY];
};

export const getCommonBounds = (
  elements: readonly ExcalidrawElement[],
): [number, number, number, number] => {
  if (!elements.length) {
    return [0, 0, 0, 0];
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementBounds(element);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  });

  return [minX, minY, maxX, maxY];
};

export const getResizedElementAbsoluteCoords = (
  element: ExcalidrawElement,
  nextWidth: number,
  nextHeight: number,
): [number, number, number, number] => {
  if (!isLinearElement(element)) {
    return [
      element.x,
      element.y,
      element.x + nextWidth,
      element.y + nextHeight,
    ];
  }

  const points = rescalePoints(
    0,
    nextWidth,
    rescalePoints(1, nextHeight, element.points),
  );

  const gen = rough.generator();
  const curve =
    element.strokeSharpness === "sharp"
      ? gen.linearPath(
          points as [number, number][],
          generateRoughOptions(element),
        )
      : gen.curve(points as [number, number][], generateRoughOptions(element));
  const ops = getCurvePathOps(curve);
  const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);
  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

export const getElementPointsCoords = (
  element: ExcalidrawLinearElement,
  points: readonly (readonly [number, number])[],
  sharpness: ExcalidrawElement["strokeSharpness"],
): [number, number, number, number] => {
  // This might be computationally heavey
  const gen = rough.generator();
  const curve =
    sharpness === "sharp"
      ? gen.linearPath(
          points as [number, number][],
          generateRoughOptions(element),
        )
      : gen.curve(points as [number, number][], generateRoughOptions(element));
  const ops = getCurvePathOps(curve);
  const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);
  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

export const getClosestElementBounds = (
  elements: readonly ExcalidrawElement[],
  from: { x: number; y: number },
): [number, number, number, number] => {
  if (!elements.length) {
    return [0, 0, 0, 0];
  }

  let minDistance = Infinity;
  let closestElement = elements[0];

  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementBounds(element);
    const distance = distance2d((x1 + x2) / 2, (y1 + y2) / 2, from.x, from.y);

    if (distance < minDistance) {
      minDistance = distance;
      closestElement = element;
    }
  });

  return getElementBounds(closestElement);
};
