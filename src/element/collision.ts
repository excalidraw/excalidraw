import * as GA from "../ga";
import * as GAPoint from "../gapoints";
import * as GADirection from "../gadirections";
import * as GALine from "../galines";
import * as GATransform from "../gatransforms";

import { isPathALoop, isPointInPolygon } from "../math";
import { pointsOnBezierCurves } from "points-on-curve";

import {
  NonDeletedExcalidrawElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  ExcalidrawDiamondElement,
  ExcalidrawTextElement,
  ExcalidrawEllipseElement,
} from "./types";

import { getElementAbsoluteCoords, getCurvePathOps, Bounds } from "./bounds";
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
  const point: Point = [x, y];
  return hitTestPointAgainstElement({ element, point, threshold, check });
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
      const point: Point = [x, y];
      return hitTestPointAgainstElement({ element, point, threshold, check });
  }
  return false;
};

type HitTestArgs = {
  element: NonDeletedExcalidrawElement;
  point: Point;
  threshold: number;
  check: (distance: number, threshold: number) => boolean;
};

const hitTestPointAgainstElement = (args: HitTestArgs): boolean => {
  switch (args.element.type) {
    case "rectangle":
    case "text":
    case "diamond":
    case "ellipse":
      const distance = distanceToBindableElement(args.element, args.point);
      return args.check(distance, args.threshold);
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

export const distanceToBindableElement = (
  element: ExcalidrawBindableElement,
  point: Point,
): number => {
  switch (element.type) {
    case "rectangle":
    case "text":
      return distanceToRectangle(element, point);
    case "diamond":
      return distanceToDiamond(element, point);
    case "ellipse":
      return distanceToEllipse(element, point);
  }
};

const isInsideCheck = (distance: number, threshold: number): boolean => {
  return distance < threshold;
};

const isNearCheck = (distance: number, threshold: number): boolean => {
  return Math.abs(distance) < threshold;
};

const isOutsideCheck = (distance: number, threshold: number): boolean => {
  return 0 <= distance && distance < threshold;
};

const distanceToRectangle = (
  element: ExcalidrawRectangleElement | ExcalidrawTextElement,
  point: Point,
): number => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point);
  const nearSide =
    GAPoint.distanceToLine(pointRel, GALine.vector(hwidth, hheight)) > 0
      ? GALine.equation(0, 1, -hheight)
      : GALine.equation(1, 0, -hwidth);
  return GAPoint.distanceToLine(pointRel, nearSide);
};

const distanceToDiamond = (
  element: ExcalidrawDiamondElement,
  point: Point,
): number => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point);
  const side = GALine.equation(hheight, hwidth, -hheight * hwidth);
  return GAPoint.distanceToLine(pointRel, side);
};

const distanceToEllipse = (
  element: ExcalidrawEllipseElement,
  point: Point,
): number => {
  const [pointRel, tangent] = ellipseParamsForTest(element, point);
  return GAPoint.distanceToLine(pointRel, tangent);
};

const ellipseParamsForTest = (
  element: ExcalidrawEllipseElement,
  point: Point,
): [GA.Point, GA.Line] => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point);
  const [px, py] = GAPoint.toTuple(pointRel);

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

  const tangent = GALine.orthogonalThrough(pointRel, closestPoint);
  return [pointRel, tangent];
};

const hitTestLinear = (args: HitTestArgs): boolean => {
  const { element, threshold } = args;
  if (!getShapeForElement(element)) {
    return false;
  }
  const [point, pointAbs, hwidth, hheight] = pointRelativeToElement(
    args.element,
    args.point,
  );
  const side1 = GALine.equation(0, 1, -hheight);
  const side2 = GALine.equation(1, 0, -hwidth);
  if (
    !isInsideCheck(GAPoint.distanceToLine(pointAbs, side1), threshold) ||
    !isInsideCheck(GAPoint.distanceToLine(pointAbs, side2), threshold)
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

// Returns:
//   1. the point relative to the elements (x, y) position
//   2. the point relative to the element's center with positive (x, y)
//   3. half element width
//   4. half element height
//
// Note that for linear elements the (x, y) position is not at the
// top right corner of their boundary.
//
// Rectangles, diamonds and ellipses are symmetrical over axes,
// and other elements have a rectangular boundary,
// so we only need to perform hit tests for the positive quadrant.
const pointRelativeToElement = (
  element: ExcalidrawElement,
  pointTuple: Point,
): [GA.Point, GA.Point, number, number] => {
  const point = GAPoint.from(pointTuple);
  const elementCoords = getElementAbsoluteCoords(element);
  const center = coordsCenter(elementCoords);
  const rotate = GATransform.rotation(center, -element.angle);
  const pointRotated = GATransform.apply(rotate, point);
  const pointRelToCenter = GA.sub(pointRotated, GADirection.from(center));
  const pointRelToCenterAbs = GAPoint.abs(pointRelToCenter);
  const elementPos = GA.offset(element.x, element.y);
  const pointRelToPos = GA.sub(pointRotated, elementPos);
  const [ax, ay, bx, by] = elementCoords;
  const halfWidth = (bx - ax) / 2;
  const halfHeight = (by - ay) / 2;
  return [pointRelToPos, pointRelToCenterAbs, halfWidth, halfHeight];
};

const relativizationToElementCenter = (
  element: ExcalidrawElement,
): GA.Transform => {
  const elementCoords = getElementAbsoluteCoords(element);
  const center = coordsCenter(elementCoords);
  const rotate = GATransform.rotation(center, -element.angle);
  const translate = GA.reverse(
    GATransform.translation(GADirection.from(center)),
  );
  return GATransform.compose(rotate, translate);
};

const coordsCenter = ([ax, ay, bx, by]: Bounds): GA.Transform => {
  return GA.point((ax + bx) / 2, (ay + by) / 2);
};

// Returns 2 or 0 intersection points between line going through `a` and `b`
// and the `element`, in ascending order of distance from `a`.
export const intersectElementWithLine = (
  element: ExcalidrawBindableElement,
  // Point on the line, in absolute coordinates
  a: Point,
  // Another point on the line, in absolute coordinates
  b: Point,
  // If given, the element is inflated by this value
  gap: number = 0,
): Point[] => {
  const relateToCenter = relativizationToElementCenter(element);
  const aRel = GATransform.apply(relateToCenter, GAPoint.from(a));
  const bRel = GATransform.apply(relateToCenter, GAPoint.from(b));
  const line = GALine.through(aRel, bRel);
  const reverseRelateToCenter = GA.reverse(relateToCenter);

  let intersections: GA.Point[];
  switch (element.type) {
    case "rectangle":
    case "text":
    case "diamond":
      // TODO: This doesn't work well in the corners, it needs the actual
      // circles around corners and intersect with those (quarter-circles)
      intersections = getEdgesRelativeToCenter(element, gap)
        .map((edge) => intersectSegment(line, edge))
        .filter((point): point is GA.Point => point != null);
      break;
    case "ellipse":
      // TODO:
      intersections = getEllipseIntersections(element, gap, line);
      break;
  }
  if (intersections.length < 2) {
    // Ignore the "edge" case of only intersecting with a single corner
    return [];
  }
  return intersections
    .sort((i1, i2) => GAPoint.distance(i1, aRel) - GAPoint.distance(i2, aRel))
    .map((point) =>
      GAPoint.toTuple(GATransform.apply(reverseRelateToCenter, point)),
    );
};

const getEdgesRelativeToCenter = (
  element:
    | ExcalidrawRectangleElement
    | ExcalidrawDiamondElement
    | ExcalidrawTextElement,
  gap: number,
): [GA.Point, GA.Point][] => {
  const hx = element.width / 2;
  const hy = element.height / 2;
  const isDiamond = element.type === "diamond";
  const gx = (isDiamond ? Math.hypot(hx, hy) / hy : 1) * gap;
  const gy = (isDiamond ? Math.hypot(hx, hy) / hx : 1) * gap;
  const hgx = hx + gx;
  const hgy = hy + gy;
  let a, b, c, d;
  switch (element.type) {
    case "rectangle":
    case "text":
      a = GA.point(hgx, hgy);
      b = GA.point(hgx, -hgy);
      c = GA.point(-hgx, -hgy);
      d = GA.point(-hgx, hgy);
      break;
    case "diamond":
      a = GA.point(0, hgy);
      b = GA.point(hgx, 0);
      c = GA.point(0, -hgy);
      d = GA.point(-hgx, 0);
      break;
  }
  return [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ];
};

// Returns intersection of `line` with `segment`, with `segment` moved by
// `gap` in its polar direction.
// If intersection conincides with second segment point returns null.
const intersectSegment = (
  line: GA.Line,
  segment: [GA.Point, GA.Point],
): GA.Point | null => {
  const [a, b] = segment;
  const aDist = GAPoint.distanceToLine(a, line);
  const bDist = GAPoint.distanceToLine(b, line);
  if (bDist === 0 || aDist * bDist > 0) {
    // The intersection is outside segment `[a, b)`
    return null;
  }
  return GAPoint.intersect(line, GALine.through(a, b));
};

const getEllipseIntersections = (
  element: ExcalidrawEllipseElement,
  gap: number,
  line: GA.Line,
): GA.Point[] => {
  const a = element.width / 2 + gap;
  const b = element.height / 2 + gap;
  const m = line[2];
  const n = line[3];
  const c = line[1];
  const squares = a * a * m * m + b * b * n * n;
  const discr = Math.sqrt(squares - c * c);
  if (squares === 0 || discr === 0) {
    return [];
  }
  const xn = -a * a * m * c;
  const yn = -b * b * n * c;
  return [
    GA.point(
      (xn + a * b * n * discr) / squares,
      (yn - a * b * m * discr) / squares,
    ),
    GA.point(
      (xn - a * b * n * discr) / squares,
      (yn + a * b * m * discr) / squares,
    ),
  ];
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
