import * as GA from "../ga";
import * as GAPoint from "../gapoints";
import * as GADirection from "../gadirections";
import * as GALine from "../galines";
import * as GATransform from "../gatransforms";

import { isPointInPolygon } from "../math";
import { pointsOnBezierCurves } from "points-on-curve";

import {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  ExcalidrawDiamondElement,
  ExcalidrawTextElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  StrokeRoundness,
  ExcalidrawFrameLikeElement,
  ExcalidrawIframeLikeElement,
} from "./types";

import {
  getElementAbsoluteCoords,
  getCurvePathOps,
  getRectangleBoxAbsoluteCoords,
  RectangleBox,
} from "./bounds";
import { Point } from "../types";
import { Drawable } from "roughjs/bin/core";
import { Mutable } from "../utility-types";

export const maxBindingGap = (
  element: ExcalidrawElement,
  elementWidth: number,
  elementHeight: number,
): number => {
  // Aligns diamonds with rectangles
  const shapeRatio = element.type === "diamond" ? 1 / Math.sqrt(2) : 1;
  const smallerDimension = shapeRatio * Math.min(elementWidth, elementHeight);
  // We make the bindable boundary bigger for bigger elements
  return Math.max(16, Math.min(0.25 * smallerDimension, 32));
};

export const distanceToBindableElement = (
  element: ExcalidrawBindableElement,
  point: Point,
): number => {
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return distanceToRectangle(element, point);
    case "diamond":
      return distanceToDiamond(element, point);
    case "ellipse":
      return distanceToEllipse(element, point);
  }
};

const distanceToRectangle = (
  element:
    | ExcalidrawRectangleElement
    | ExcalidrawTextElement
    | ExcalidrawFreeDrawElement
    | ExcalidrawImageElement
    | ExcalidrawIframeLikeElement
    | ExcalidrawFrameLikeElement,
  point: Point,
): number => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point);
  return Math.max(
    GAPoint.distanceToLine(pointRel, GALine.equation(0, 1, -hheight)),
    GAPoint.distanceToLine(pointRel, GALine.equation(1, 0, -hwidth)),
  );
};

const distanceToRectangleBox = (box: RectangleBox, point: Point): number => {
  const [, pointRel, hwidth, hheight] = pointRelativeToDivElement(point, box);
  return Math.max(
    GAPoint.distanceToLine(pointRel, GALine.equation(0, 1, -hheight)),
    GAPoint.distanceToLine(pointRel, GALine.equation(1, 0, -hwidth)),
  );
};

const distanceToDiamond = (
  element: ExcalidrawDiamondElement,
  point: Point,
): number => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point);
  const side = GALine.equation(hheight, hwidth, -hheight * hwidth);
  return GAPoint.distanceToLine(pointRel, side);
};

export const distanceToEllipse = (
  element: ExcalidrawEllipseElement,
  point: Point,
): number => {
  const [pointRel, tangent] = ellipseParamsForTest(element, point);
  return -GALine.sign(tangent) * GAPoint.distanceToLine(pointRel, tangent);
};

const ellipseParamsForTest = (
  element: ExcalidrawEllipseElement,
  point: Point,
): [GA.Point, GA.Line] => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point);
  const [px, py] = GAPoint.toTuple(pointRel);

  // We're working in positive quadrant, so start with `t = 45deg`, `tx=cos(t)`
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
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const center = coordsCenter(x1, y1, x2, y2);
  // GA has angle orientation opposite to `rotate`
  const rotate = GATransform.rotation(center, element.angle);
  const pointRotated = GATransform.apply(rotate, point);
  const pointRelToCenter = GA.sub(pointRotated, GADirection.from(center));
  const pointRelToCenterAbs = GAPoint.abs(pointRelToCenter);
  const elementPos = GA.offset(element.x, element.y);
  const pointRelToPos = GA.sub(pointRotated, elementPos);
  const halfWidth = (x2 - x1) / 2;
  const halfHeight = (y2 - y1) / 2;
  return [pointRelToPos, pointRelToCenterAbs, halfWidth, halfHeight];
};

const pointRelativeToDivElement = (
  pointTuple: Point,
  rectangle: RectangleBox,
): [GA.Point, GA.Point, number, number] => {
  const point = GAPoint.from(pointTuple);
  const [x1, y1, x2, y2] = getRectangleBoxAbsoluteCoords(rectangle);
  const center = coordsCenter(x1, y1, x2, y2);
  const rotate = GATransform.rotation(center, rectangle.angle);
  const pointRotated = GATransform.apply(rotate, point);
  const pointRelToCenter = GA.sub(pointRotated, GADirection.from(center));
  const pointRelToCenterAbs = GAPoint.abs(pointRelToCenter);
  const elementPos = GA.offset(rectangle.x, rectangle.y);
  const pointRelToPos = GA.sub(pointRotated, elementPos);
  const halfWidth = (x2 - x1) / 2;
  const halfHeight = (y2 - y1) / 2;
  return [pointRelToPos, pointRelToCenterAbs, halfWidth, halfHeight];
};

const relativizationToElementCenter = (
  element: ExcalidrawElement,
): GA.Transform => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const center = coordsCenter(x1, y1, x2, y2);
  // GA has angle orientation opposite to `rotate`
  const rotate = GATransform.rotation(center, element.angle);
  const translate = GA.reverse(
    GATransform.translation(GADirection.from(center)),
  );
  return GATransform.compose(rotate, translate);
};

const coordsCenter = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): GA.Point => {
  return GA.point((x1 + x2) / 2, (y1 + y2) / 2);
};

// The focus distance is the oriented ratio between the size of
// the `element` and the "focus image" of the element on which
// all focus points lie, so it's a number between -1 and 1.
// The line going through `a` and `b` is a tangent to the "focus image"
// of the element.
export const determineFocusDistance = (
  element: ExcalidrawBindableElement,
  // Point on the line, in absolute coordinates
  a: Point,
  // Another point on the line, in absolute coordinates (closer to element)
  b: Point,
): number => {
  const relateToCenter = relativizationToElementCenter(element);
  const aRel = GATransform.apply(relateToCenter, GAPoint.from(a));
  const bRel = GATransform.apply(relateToCenter, GAPoint.from(b));
  const line = GALine.through(aRel, bRel);
  const q = element.height / element.width;
  const hwidth = element.width / 2;
  const hheight = element.height / 2;
  const n = line[2];
  const m = line[3];
  const c = line[1];
  const mabs = Math.abs(m);
  const nabs = Math.abs(n);
  let ret;
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      ret = c / (hwidth * (nabs + q * mabs));
      break;
    case "diamond":
      ret = mabs < nabs ? c / (nabs * hwidth) : c / (mabs * hheight);
      break;
    case "ellipse":
      ret = c / (hwidth * Math.sqrt(n ** 2 + q ** 2 * m ** 2));
      break;
  }
  return ret || 0;
};

export const determineFocusPoint = (
  element: ExcalidrawBindableElement,
  // The oriented, relative distance from the center of `element` of the
  // returned focusPoint
  focus: number,
  adjecentPoint: Point,
): Point => {
  if (focus === 0) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const center = coordsCenter(x1, y1, x2, y2);
    return GAPoint.toTuple(center);
  }
  const relateToCenter = relativizationToElementCenter(element);
  const adjecentPointRel = GATransform.apply(
    relateToCenter,
    GAPoint.from(adjecentPoint),
  );
  const reverseRelateToCenter = GA.reverse(relateToCenter);
  let point;
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "diamond":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      point = findFocusPointForRectangulars(element, focus, adjecentPointRel);
      break;
    case "ellipse":
      point = findFocusPointForEllipse(element, focus, adjecentPointRel);
      break;
  }
  return GAPoint.toTuple(GATransform.apply(reverseRelateToCenter, point));
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
  const intersections = getSortedElementLineIntersections(
    element,
    line,
    aRel,
    gap,
  );
  return intersections.map((point) =>
    GAPoint.toTuple(GATransform.apply(reverseRelateToCenter, point)),
  );
};

const getSortedElementLineIntersections = (
  element: ExcalidrawBindableElement,
  // Relative to element center
  line: GA.Line,
  // Relative to element center
  nearPoint: GA.Point,
  gap: number = 0,
): GA.Point[] => {
  let intersections: GA.Point[];
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "diamond":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      const corners = getCorners(element);
      intersections = corners
        .flatMap((point, i) => {
          const edge: [GA.Point, GA.Point] = [point, corners[(i + 1) % 4]];
          return intersectSegment(line, offsetSegment(edge, gap));
        })
        .concat(
          corners.flatMap((point) => getCircleIntersections(point, gap, line)),
        );
      break;
    case "ellipse":
      intersections = getEllipseIntersections(element, gap, line);
      break;
  }
  if (intersections.length < 2) {
    // Ignore the "edge" case of only intersecting with a single corner
    return [];
  }
  const sortedIntersections = intersections.sort(
    (i1, i2) =>
      GAPoint.distance(i1, nearPoint) - GAPoint.distance(i2, nearPoint),
  );
  return [
    sortedIntersections[0],
    sortedIntersections[sortedIntersections.length - 1],
  ];
};

const getCorners = (
  element:
    | ExcalidrawRectangleElement
    | ExcalidrawImageElement
    | ExcalidrawDiamondElement
    | ExcalidrawTextElement
    | ExcalidrawIframeLikeElement
    | ExcalidrawFrameLikeElement,
  scale: number = 1,
): GA.Point[] => {
  const hx = (scale * element.width) / 2;
  const hy = (scale * element.height) / 2;
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return [
        GA.point(hx, hy),
        GA.point(hx, -hy),
        GA.point(-hx, -hy),
        GA.point(-hx, hy),
      ];
    case "diamond":
      return [
        GA.point(0, hy),
        GA.point(hx, 0),
        GA.point(0, -hy),
        GA.point(-hx, 0),
      ];
  }
};

// Returns intersection of `line` with `segment`, with `segment` moved by
// `gap` in its polar direction.
// If intersection coincides with second segment point returns empty array.
const intersectSegment = (
  line: GA.Line,
  segment: [GA.Point, GA.Point],
): GA.Point[] => {
  const [a, b] = segment;
  const aDist = GAPoint.distanceToLine(a, line);
  const bDist = GAPoint.distanceToLine(b, line);
  if (aDist * bDist >= 0) {
    // The intersection is outside segment `(a, b)`
    return [];
  }
  return [GAPoint.intersect(line, GALine.through(a, b))];
};

const offsetSegment = (
  segment: [GA.Point, GA.Point],
  distance: number,
): [GA.Point, GA.Point] => {
  const [a, b] = segment;
  const offset = GATransform.translationOrthogonal(
    GADirection.fromTo(a, b),
    distance,
  );
  return [GATransform.apply(offset, a), GATransform.apply(offset, b)];
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
  const discr = squares - c * c;
  if (squares === 0 || discr <= 0) {
    return [];
  }
  const discrRoot = Math.sqrt(discr);
  const xn = -a * a * m * c;
  const yn = -b * b * n * c;
  return [
    GA.point(
      (xn + a * b * n * discrRoot) / squares,
      (yn - a * b * m * discrRoot) / squares,
    ),
    GA.point(
      (xn - a * b * n * discrRoot) / squares,
      (yn + a * b * m * discrRoot) / squares,
    ),
  ];
};

export const getCircleIntersections = (
  center: GA.Point,
  radius: number,
  line: GA.Line,
): GA.Point[] => {
  if (radius === 0) {
    return GAPoint.distanceToLine(line, center) === 0 ? [center] : [];
  }
  const m = line[2];
  const n = line[3];
  const c = line[1];
  const [a, b] = GAPoint.toTuple(center);
  const r = radius;
  const squares = m * m + n * n;
  const discr = r * r * squares - (m * a + n * b + c) ** 2;
  if (squares === 0 || discr <= 0) {
    return [];
  }
  const discrRoot = Math.sqrt(discr);
  const xn = a * n * n - b * m * n - m * c;
  const yn = b * m * m - a * m * n - n * c;

  return [
    GA.point((xn + n * discrRoot) / squares, (yn - m * discrRoot) / squares),
    GA.point((xn - n * discrRoot) / squares, (yn + m * discrRoot) / squares),
  ];
};

// The focus point is the tangent point of the "focus image" of the
// `element`, where the tangent goes through `point`.
export const findFocusPointForEllipse = (
  ellipse: ExcalidrawEllipseElement,
  // Between -1 and 1 (not 0) the relative size of the "focus image" of
  // the element on which the focus point lies
  relativeDistance: number,
  // The point for which we're trying to find the focus point, relative
  // to the ellipse center.
  point: GA.Point,
): GA.Point => {
  const relativeDistanceAbs = Math.abs(relativeDistance);
  const a = (ellipse.width * relativeDistanceAbs) / 2;
  const b = (ellipse.height * relativeDistanceAbs) / 2;

  const orientation = Math.sign(relativeDistance);
  const [px, pyo] = GAPoint.toTuple(point);

  // The calculation below can't handle py = 0
  const py = pyo === 0 ? 0.0001 : pyo;

  const squares = px ** 2 * b ** 2 + py ** 2 * a ** 2;
  // Tangent mx + ny + 1 = 0
  const m =
    (-px * b ** 2 +
      orientation * py * Math.sqrt(Math.max(0, squares - a ** 2 * b ** 2))) /
    squares;

  let n = (-m * px - 1) / py;

  if (n === 0) {
    // if zero {-0, 0}, fall back to a same-sign value in the similar range
    n = (Object.is(n, -0) ? -1 : 1) * 0.01;
  }

  const x = -(a ** 2 * m) / (n ** 2 * b ** 2 + m ** 2 * a ** 2);
  return GA.point(x, (-m * x - 1) / n);
};

export const findFocusPointForRectangulars = (
  element:
    | ExcalidrawRectangleElement
    | ExcalidrawImageElement
    | ExcalidrawDiamondElement
    | ExcalidrawTextElement
    | ExcalidrawIframeLikeElement
    | ExcalidrawFrameLikeElement,
  // Between -1 and 1 for how far away should the focus point be relative
  // to the size of the element. Sign determines orientation.
  relativeDistance: number,
  // The point for which we're trying to find the focus point, relative
  // to the element center.
  point: GA.Point,
): GA.Point => {
  const relativeDistanceAbs = Math.abs(relativeDistance);
  const orientation = Math.sign(relativeDistance);
  const corners = getCorners(element, relativeDistanceAbs);

  let maxDistance = 0;
  let tangentPoint: null | GA.Point = null;
  corners.forEach((corner) => {
    const distance = orientation * GALine.through(point, corner)[1];
    if (distance > maxDistance) {
      maxDistance = distance;
      tangentPoint = corner;
    }
  });
  return tangentPoint!;
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
  roundness: StrokeRoundness,
) => {
  const ops = getCurvePathOps(drawable);
  const points: Mutable<Point>[] = [];
  let odd = false; // select one line out of double lines
  for (const operation of ops) {
    if (operation.op === "move") {
      odd = !odd;
      if (odd) {
        points.push([operation.data[0], operation.data[1]]);
      }
    } else if (operation.op === "bcurveTo") {
      if (odd) {
        points.push([operation.data[0], operation.data[1]]);
        points.push([operation.data[2], operation.data[3]]);
        points.push([operation.data[4], operation.data[5]]);
      }
    } else if (operation.op === "lineTo") {
      if (odd) {
        points.push([operation.data[0], operation.data[1]]);
      }
    }
  }
  if (points.length >= 4) {
    if (roundness === "sharp") {
      return isPointInPolygon(points, x, y);
    }
    const polygonPoints = pointsOnBezierCurves(points, 10, 5);
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
      currentP = data as unknown as Point;
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
      return hitTestCurveInside(drawable, x, y, "sharp");
    } else if (op === "qcurveTo") {
      // TODO: Implement this
      console.warn("qcurveTo is not implemented yet");
    }

    return false;
  });
};
