import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  Arrowhead,
  ExcalidrawFreeDrawElement,
  NonDeleted,
} from "./types";
import { distance2d, rotate } from "../math";
import rough from "roughjs/bin/rough";
import { Drawable, Op } from "roughjs/bin/core";
import { Point } from "../types";
import {
  getShapeForElement,
  generateRoughOptions,
} from "../renderer/renderElement";
import { isFreeDrawElement, isLinearElement } from "./typeChecks";
import { rescalePoints } from "../points";

// x and y position of top left corner, x and y position of bottom right corner
export type Bounds = readonly [number, number, number, number];
type MaybeQuadraticSolution = [number | null, number | null] | false;

// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
export const getElementAbsoluteCoords = (
  element: ExcalidrawElement,
): Bounds => {
  if (isFreeDrawElement(element)) {
    return getFreeDrawElementAbsoluteCoords(element);
  } else if (isLinearElement(element)) {
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

// reference: https://eliot-jones.com/2019/12/cubic-bezier-curve-bounding-boxes
const getBezierValueForT = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
) => {
  const oneMinusT = 1 - t;
  return (
    Math.pow(oneMinusT, 3) * p0 +
    3 * Math.pow(oneMinusT, 2) * t * p1 +
    3 * oneMinusT * Math.pow(t, 2) * p2 +
    Math.pow(t, 3) * p3
  );
};

const solveQuadratic = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): MaybeQuadraticSolution => {
  const i = p1 - p0;
  const j = p2 - p1;
  const k = p3 - p2;

  const a = 3 * i - 6 * j + 3 * k;
  const b = 6 * j - 6 * i;
  const c = 3 * i;

  const sqrtPart = b * b - 4 * a * c;
  const hasSolution = sqrtPart >= 0;

  if (!hasSolution) {
    return false;
  }

  const t1 = (-b + Math.sqrt(sqrtPart)) / (2 * a);
  const t2 = (-b - Math.sqrt(sqrtPart)) / (2 * a);

  let s1 = null;
  let s2 = null;

  if (t1 >= 0 && t1 <= 1) {
    s1 = getBezierValueForT(t1, p0, p1, p2, p3);
  }

  if (t2 >= 0 && t2 <= 1) {
    s2 = getBezierValueForT(t2, p0, p1, p2, p3);
  }

  return [s1, s2];
};

const getCubicBezierCurveBound = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): Bounds => {
  const solX = solveQuadratic(p0[0], p1[0], p2[0], p3[0]);
  const solY = solveQuadratic(p0[1], p1[1], p2[1], p3[1]);

  let minX = Math.min(p0[0], p3[0]);
  let maxX = Math.max(p0[0], p3[0]);

  if (solX) {
    const xs = solX.filter((x) => x !== null) as number[];
    minX = Math.min(minX, ...xs);
    maxX = Math.max(maxX, ...xs);
  }

  let minY = Math.min(p0[1], p3[1]);
  let maxY = Math.max(p0[1], p3[1]);
  if (solY) {
    const ys = solY.filter((y) => y !== null) as number[];
    minY = Math.min(minY, ...ys);
    maxY = Math.max(maxY, ...ys);
  }
  return [minX, minY, maxX, maxY];
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
        currentP = data as unknown as Point;
        // move operation does not draw anything; so, it always
        // returns false
      } else if (op === "bcurveTo") {
        const _p1 = [data[0], data[1]] as Point;
        const _p2 = [data[2], data[3]] as Point;
        const _p3 = [data[4], data[5]] as Point;

        const p1 = transformXY ? transformXY(..._p1) : _p1;
        const p2 = transformXY ? transformXY(..._p2) : _p2;
        const p3 = transformXY ? transformXY(..._p3) : _p3;

        const p0 = transformXY ? transformXY(...currentP) : currentP;
        currentP = _p3;

        const [minX, minY, maxX, maxY] = getCubicBezierCurveBound(
          p0,
          p1,
          p2,
          p3,
        );

        limits.minX = Math.min(limits.minX, minX);
        limits.minY = Math.min(limits.minY, minY);

        limits.maxX = Math.max(limits.maxX, maxX);
        limits.maxY = Math.max(limits.maxY, maxY);
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

const getBoundsFromPoints = (
  points: ExcalidrawFreeDrawElement["points"],
): [number, number, number, number] => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
};

const getFreeDrawElementAbsoluteCoords = (
  element: ExcalidrawFreeDrawElement,
): [number, number, number, number] => {
  const [minX, minY, maxX, maxY] = getBoundsFromPoints(element.points);

  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

const getLinearElementAbsoluteCoords = (
  element: ExcalidrawLinearElement,
): [number, number, number, number] => {
  let coords: [number, number, number, number];

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
    coords = [
      minX + element.x,
      minY + element.y,
      maxX + element.x,
      maxY + element.y,
    ];
  } else {
    const shape = getShapeForElement(element)!;

    // first element is always the curve
    const ops = getCurvePathOps(shape[0]);

    const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);

    coords = [
      minX + element.x,
      minY + element.y,
      maxX + element.x,
      maxY + element.y,
    ];
  }

  return coords;
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
    p0 = prevOp.data as unknown as Point;
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
    triangle: 15,
  }[arrowhead]; // pixels (will differ for each arrowhead)

  let length = 0;

  if (arrowhead === "arrow") {
    // Length for -> arrows is based on the length of the last section
    const [cx, cy] = element.points[element.points.length - 1];
    const [px, py] =
      element.points.length > 1
        ? element.points[element.points.length - 2]
        : [0, 0];

    length = Math.hypot(cx - px, cy - py);
  } else {
    // Length for other arrowhead types is based on the total length of the line
    for (let i = 0; i < element.points.length; i++) {
      const [px, py] = element.points[i - 1] || [0, 0];
      const [cx, cy] = element.points[i];
      length += Math.hypot(cx - px, cy - py);
    }
  }

  // Scale down the arrowhead until we hit a certain size so that it doesn't look weird.
  // This value is selected by minimizing a minimum size with the last segment of the arrowhead
  const minSize = Math.min(size, length / 2);
  const xs = x2 - nx * minSize;
  const ys = y2 - ny * minSize;

  if (arrowhead === "dot") {
    const r = Math.hypot(ys - y2, xs - x2) + element.strokeWidth;
    return [x2, y2, r];
  }

  const angle = {
    arrow: 20,
    bar: 90,
    triangle: 25,
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

  const shape = getShapeForElement(element)!;

  // first element is always the curve
  const ops = getCurvePathOps(shape[0]);

  const transformXY = (x: number, y: number) =>
    rotate(element.x + x, element.y + y, cx, cy, element.angle);
  return getMinMaxXYFromCurvePathOps(ops, transformXY);
};

// We could cache this stuff
export const getElementBounds = (
  element: ExcalidrawElement,
): [number, number, number, number] => {
  let bounds: [number, number, number, number];

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  if (isFreeDrawElement(element)) {
    const [minX, minY, maxX, maxY] = getBoundsFromPoints(
      element.points.map(([x, y]) =>
        rotate(x, y, cx - element.x, cy - element.y, element.angle),
      ),
    );

    return [
      minX + element.x,
      minY + element.y,
      maxX + element.x,
      maxY + element.y,
    ];
  } else if (isLinearElement(element)) {
    bounds = getLinearElementRotatedBounds(element, cx, cy);
  } else if (element.type === "diamond") {
    const [x11, y11] = rotate(cx, y1, cx, cy, element.angle);
    const [x12, y12] = rotate(cx, y2, cx, cy, element.angle);
    const [x22, y22] = rotate(x1, cy, cx, cy, element.angle);
    const [x21, y21] = rotate(x2, cy, cx, cy, element.angle);
    const minX = Math.min(x11, x12, x22, x21);
    const minY = Math.min(y11, y12, y22, y21);
    const maxX = Math.max(x11, x12, x22, x21);
    const maxY = Math.max(y11, y12, y22, y21);
    bounds = [minX, minY, maxX, maxY];
  } else if (element.type === "ellipse") {
    const w = (x2 - x1) / 2;
    const h = (y2 - y1) / 2;
    const cos = Math.cos(element.angle);
    const sin = Math.sin(element.angle);
    const ww = Math.hypot(w * cos, h * sin);
    const hh = Math.hypot(h * cos, w * sin);
    bounds = [cx - ww, cy - hh, cx + ww, cy + hh];
  } else {
    const [x11, y11] = rotate(x1, y1, cx, cy, element.angle);
    const [x12, y12] = rotate(x1, y2, cx, cy, element.angle);
    const [x22, y22] = rotate(x2, y2, cx, cy, element.angle);
    const [x21, y21] = rotate(x2, y1, cx, cy, element.angle);
    const minX = Math.min(x11, x12, x22, x21);
    const minY = Math.min(y11, y12, y22, y21);
    const maxX = Math.max(x11, x12, x22, x21);
    const maxY = Math.max(y11, y12, y22, y21);
    bounds = [minX, minY, maxX, maxY];
  }

  return bounds;
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
  if (!(isLinearElement(element) || isFreeDrawElement(element))) {
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

  let bounds: [number, number, number, number];

  if (isFreeDrawElement(element)) {
    // Free Draw
    bounds = getBoundsFromPoints(points);
  } else {
    // Line
    const gen = rough.generator();
    const curve =
      element.strokeSharpness === "sharp"
        ? gen.linearPath(
            points as [number, number][],
            generateRoughOptions(element),
          )
        : gen.curve(
            points as [number, number][],
            generateRoughOptions(element),
          );
    const ops = getCurvePathOps(curve);
    bounds = getMinMaxXYFromCurvePathOps(ops);
  }

  const [minX, minY, maxX, maxY] = bounds;
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

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  midX: number;
  midY: number;
  width: number;
  height: number;
}

export const getCommonBoundingBox = (
  elements: ExcalidrawElement[] | readonly NonDeleted<ExcalidrawElement>[],
): Box => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2,
  };
};
