import * as GA from "../ga";
import * as GAPoint from "../gapoints";
import * as GADirection from "../gadirections";
import * as GALine from "../galines";
import * as GATransform from "../gatransforms";

import {
  isPathALoop,
  rotate,
  isPointInPolygon,
  intersectLineAndSegment,
} from "../math";
import { pointsOnBezierCurves } from "points-on-curve";

import {
  NonDeletedExcalidrawElement,
  ExcalidrawBindableElement,
} from "./types";

import { getElementAbsoluteCoords, getCurvePathOps } from "./bounds";
import { Point } from "../types";
import { Drawable } from "roughjs/bin/core";
import { AppState } from "../types";
import { getShapeForElement } from "../renderer/renderElement";

const isElementDraggableFromInside = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
): boolean => {
  if (element.type === "arrow") {
    return false;
  }
  const dragFromInside =
    element.backgroundColor !== "transparent" ||
    appState.selectedElementIds[element.id];
  if (element.type === "line" || element.type === "draw") {
    return dragFromInside && isPathALoop(element.points);
  }
  return dragFromInside;
};

export const hitTest = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  x: number,
  y: number,
): boolean => {
  // How many pixels off the shape boundary we still consider a hit
  const threshold = 10 / appState.zoom;
  const check = isElementDraggableFromInside(element, appState)
    ? isInsideCheck
    : isNearCheck;
  return hitTestPointAgainstElement({ element, x, y, threshold, check });
};

export const bindingBorderTest = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  x: number,
  y: number,
): boolean => {
  switch (element.type) {
    case "rectangle":
    case "text":
    case "diamond":
    case "ellipse":
      const smallerDimension = Math.min(element.width, element.height);
      // We make the bindable boundary bigger for bigger elements
      const threshold =
        Math.max(15, Math.min(0.25 * smallerDimension, 80)) / appState.zoom;
      const check = isOutsideCheck;
      return hitTestPointAgainstElement({ element, x, y, threshold, check });
  }
  return false;
};

type HitTestArgs = {
  element: NonDeletedExcalidrawElement;
  x: number;
  y: number;
  threshold: number;
  check: (point: GA.Point, line: GA.Line, threshold: number) => boolean;
};

const hitTestPointAgainstElement = (args: HitTestArgs): boolean => {
  switch (args.element.type) {
    case "rectangle":
    case "text":
      return hitTestRectangle(args);
    case "diamond":
      return hitTestDiamond(args);
    case "ellipse":
      return hitTestEllipse(args);
    case "arrow":
    case "line":
    case "draw":
      return hitTestLinear(args);
    case "selection":
      console.warn(
        "This should not happen, we need to investigate why it does.",
      );
      return false;
  }
};

const isInsideCheck = (
  point: GA.Point,
  line: GA.Line,
  threshold: number,
): boolean => {
  return GAPoint.distanceToLine(point, line) < threshold;
};

const isNearCheck = (
  point: GA.Point,
  line: GA.Line,
  threshold: number,
): boolean => {
  return Math.abs(GAPoint.distanceToLine(point, line)) < threshold;
};

const isOutsideCheck = (
  point: GA.Point,
  line: GA.Line,
  threshold: number,
): boolean => {
  const distance = GAPoint.distanceToLine(point, line);
  return 0 <= distance && distance < threshold;
};

const hitTestRectangle = (args: HitTestArgs): boolean => {
  const [, point, hwidth, hheight] = pointRelativeToElement(args);
  const nearSide =
    GAPoint.distanceToLine(point, GALine.vector(hwidth, hheight)) > 0
      ? GALine.equation(0, 1, -hheight)
      : GALine.equation(1, 0, -hwidth);
  return args.check(point, nearSide, args.threshold);
};

const hitTestDiamond = (args: HitTestArgs): boolean => {
  const [, point, hwidth, hheight] = pointRelativeToElement(args);
  const side = GALine.equation(hheight, hwidth, -hheight * hwidth);
  return args.check(point, side, args.threshold);
};

const hitTestEllipse = (args: HitTestArgs): boolean => {
  const [point, tangent] = ellipseParamsForTest(args);
  return args.check(point, tangent, args.threshold);
};

const ellipseParamsForTest = (args: HitTestArgs): [GA.Point, GA.Line] => {
  const [, point, hwidth, hheight] = pointRelativeToElement(args);
  const [px, py] = GAPoint.toTuple(point);

  let tx = 0.707;
  let ty = 0.707;

  const a = hwidth;
  const b = hheight;

  // This is a numerical method to find the params tx, ty at which
  // the ellipse has the closest point to the given point
  [0, 1, 2, 3].forEach((_) => {
    const xx = a * tx;
    const yy = b * ty;

    const ex = ((a * a - b * b) * tx ** 3) / a;
    const ey = ((b * b - a * a) * ty ** 3) / b;

    const rx = xx - ex;
    const ry = yy - ey;

    const qx = px - ex;
    const qy = py - ey;

    const r = Math.hypot(ry, rx);
    const q = Math.hypot(qy, qx);

    tx = Math.min(1, Math.max(0, ((qx * r) / q + ex) / a));
    ty = Math.min(1, Math.max(0, ((qy * r) / q + ey) / b));
    const t = Math.hypot(ty, tx);
    tx /= t;
    ty /= t;
  });

  const closestPoint = GA.point(a * tx, b * ty);

  const tangent = GALine.orthogonalThrough(point, closestPoint);
  return [point, tangent];
};

const hitTestLinear = (args: HitTestArgs): boolean => {
  const { element, threshold } = args;
  if (!getShapeForElement(element)) {
    return false;
  }
  const [point, pointAbs, hwidth, hheight] = pointRelativeToElement(args);
  const side1 = GALine.equation(0, 1, -hheight);
  const side2 = GALine.equation(1, 0, -hwidth);
  if (
    !isInsideCheck(pointAbs, side1, threshold) ||
    !isInsideCheck(pointAbs, side2, threshold)
  ) {
    return false;
  }
  const [relX, relY] = GAPoint.toTuple(point);

  const shape = getShapeForElement(element) as Drawable[];

  if (args.check === isInsideCheck) {
    const hit = shape.some((subshape) =>
      hitTestCurveInside(subshape, relX, relY, threshold),
    );
    if (hit) {
      return true;
    }
  }

  // hit test all "subshapes" of the linear element
  return shape.some((subshape) =>
    hitTestRoughShape(subshape, relX, relY, threshold),
  );
};

// Returns the point relative to the elements (x, y) position, the point
// relative to the element's center with positive (x, y), and half
// the element's width/height.
//
// Rectangles, diamonds and ellipses are symmetrical over axes,
// and other elements have a rectangular boundary,
// so we only need to perform hit tests for the positive quadrant.
//
// Note that for linear elements the (x, y) position is not at the
// top right corner of their boundary.
const pointRelativeToElement = (
  args: HitTestArgs,
): [GA.Point, GA.Point, number, number] => {
  const { x, y, element } = args;
  // a is topleft corner, b is bottom right
  const [ax, ay, bx, by] = getElementAbsoluteCoords(element);
  const center = GA.point((ax + bx) / 2, (ay + by) / 2);
  const point = GA.point(x, y);
  const counterRotate = GATransform.rotation(center, -element.angle);
  const pointRotated = GATransform.apply(counterRotate, point);
  const pointRelToCenter = GA.sub(pointRotated, GADirection.from(center));
  const pointRelToCenterAbs = GAPoint.abs(pointRelToCenter);
  const position = GA.offset(element.x, element.y);
  const pointRelToPos = GA.sub(pointRotated, position);
  return [pointRelToPos, pointRelToCenterAbs, (bx - ax) / 2, (by - ay) / 2];
};

// Input and output is in absolute coordinates
export const intersectElementWithLine = (
  element: ExcalidrawBindableElement,
  a: Point,
  b: Point,
): Point[] => {
  const absoluteCoords = getElementAbsoluteCoords(element);
  const [x1, y1, x2, y2] = absoluteCoords;
  a = adjustXYForElementRotation(element.angle, absoluteCoords, ...a);
  b = adjustXYForElementRotation(element.angle, absoluteCoords, ...b);

  switch (element.type) {
    case "rectangle":
    case "text":
      const c1: Point = [x1, y1];
      const c2: Point = [x2, y1];
      const c3: Point = [x2, y2];
      const c4: Point = [x1, y2];
      return [
        intersectLineAndSegment(a, b, c1, c2),
        intersectLineAndSegment(a, b, c2, c3),
        intersectLineAndSegment(a, b, c3, c4),
        intersectLineAndSegment(a, b, c4, c1),
      ]
        .filter((point) => point != null)
        .map(
          (point) =>
            adjustXYForElementRotation(
              -element.angle,
              absoluteCoords,
              ...(point as Point),
            ) as Point,
        );
    case "diamond":
      return [];
    case "ellipse":
      return [];
  }
};

// The way the current hit test code works is that it takes the pointer
// and rotates it around the element center to avoid having to rotate
// all the element points instead to account for the element's rotation
const adjustXYForElementRotation = (
  elementAngle: number,
  elementAbsoluteCoords: [number, number, number, number],
  x: number,
  y: number,
): [number, number] => {
  const [x1, y1, x2, y2] = elementAbsoluteCoords;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  // reverse rotate the pointer
  const xy = rotate(x, y, cx, cy, -elementAngle);
  return xy;
};

const pointInBezierEquation = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  [mx, my]: Point,
  lineThreshold: number,
) => {
  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  // go through t in increments of 0.01
  let t = 0;
  while (t <= 1.0) {
    const tx = equation(t, 0);
    const ty = equation(t, 1);

    const diff = Math.sqrt(Math.pow(tx - mx, 2) + Math.pow(ty - my, 2));

    if (diff < lineThreshold) {
      return true;
    }

    t += 0.01;
  }

  return false;
};

const hitTestCurveInside = (
  drawable: Drawable,
  x: number,
  y: number,
  lineThreshold: number,
) => {
  const ops = getCurvePathOps(drawable);
  const points: Point[] = [];
  for (const operation of ops) {
    if (operation.op === "move") {
      if (points.length) {
        break;
      }
      points.push([operation.data[0], operation.data[1]]);
    } else if (operation.op === "bcurveTo") {
      points.push([operation.data[0], operation.data[1]]);
      points.push([operation.data[2], operation.data[3]]);
      points.push([operation.data[4], operation.data[5]]);
    }
  }
  if (points.length >= 4) {
    const polygonPoints = pointsOnBezierCurves(points as any, 10, 5);
    return isPointInPolygon(polygonPoints, x, y);
  }
  return false;
};

const hitTestRoughShape = (
  drawable: Drawable,
  x: number,
  y: number,
  lineThreshold: number,
) => {
  // read operations from first opSet
  const ops = getCurvePathOps(drawable);

  // set start position as (0,0) just in case
  // move operation does not exist (unlikely but it is worth safekeeping it)
  let currentP: Point = [0, 0];

  return ops.some(({ op, data }, idx) => {
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

      // check if points are on the curve
      // cubic bezier curves require four parameters
      // the first parameter is the last stored position (p0)
      const retVal = pointInBezierEquation(
        p0,
        p1,
        p2,
        p3,
        [x, y],
        lineThreshold,
      );

      // set end point of bezier curve as the new starting point for
      // upcoming operations as each operation is based on the last drawn
      // position of the previous operation
      return retVal;
    } else if (op === "lineTo") {
      // TODO: Implement this
    } else if (op === "qcurveTo") {
      // TODO: Implement this
    }

    return false;
  });
};
