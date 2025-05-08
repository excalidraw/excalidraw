import {
  lineSegment,
  pointFrom,
  polygonIncludesPoint,
  pointOnLineSegment,
  type GlobalPoint,
  type LocalPoint,
  type Polygon,
  vectorCross,
  vectorFromPoint,
} from "@excalidraw/math";

import { intersectElementWithLineSegment } from "@excalidraw/element/collision";

import { elementCenterPoint } from "@excalidraw/common";

import { distanceToElement } from "@excalidraw/element/distance";

import { isLinearElement } from "@excalidraw/excalidraw";
import { isFreeDrawElement } from "@excalidraw/element/typeChecks";
import { isPathALoop } from "@excalidraw/element/shapes";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Curve } from "@excalidraw/math";

import type { Polyline } from "./shape";

// check if the given point is considered on the given shape's border
export const isPointOnShape = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  tolerance = 1,
) => {
  const distance = distanceToElement(element, point);

  return distance <= tolerance;
};

// check if the given point is considered inside the element's border
export const isPointInShape = (
  point: GlobalPoint,
  element: ExcalidrawElement,
) => {
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    if (isPathALoop(element.points)) {
      // for a closed path, we need to check if the point is inside the path
      const r = isPointInClosedPath(
        element.points.map((p) =>
          pointFrom<GlobalPoint>(element.x + p[0], element.y + p[1]),
        ),
        point,
      );
      //console.log(r);
      return r;
    }

    // There isn't any "inside" for a non-looping path
    return false;
  }

  const intersections = intersectElementWithLineSegment(
    element,
    lineSegment(elementCenterPoint(element), point),
  );

  return intersections.length === 0;
};

/**
 * Determine if a closed path contains a point.
 *
 * Implementation notes: We'll use the fact that the path is a consecutive
 * sequence of line segments, these line segments have a winding order and
 * the fact that if a point is inside the closed path, the cross product of the
 * start point of a line segment to the point p and the end point of the line
 * segment will be negative for all segments.
 *
 * @param points
 * @param p
 */
const isPointInClosedPath = (
  points: readonly GlobalPoint[],
  p: GlobalPoint,
) => {
  const segments = points.slice(1).map((point, i) => {
    return lineSegment(points[i], point);
  });

  return segments.every((segment) => {
    const c = vectorCross(
      vectorFromPoint(segment[0], p),
      vectorFromPoint(segment[0], segment[1]),
    );

    return c < 0;
  });
};

// check if the given element is in the given bounds
export const isPointInBounds = <Point extends GlobalPoint | LocalPoint>(
  point: Point,
  bounds: Polygon<Point>,
) => {
  return polygonIncludesPoint(point, bounds);
};

const cubicBezierEquation = <Point extends LocalPoint | GlobalPoint>(
  curve: Curve<Point>,
) => {
  const [p0, p1, p2, p3] = curve;
  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  return (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);
};

const polyLineFromCurve = <Point extends LocalPoint | GlobalPoint>(
  curve: Curve<Point>,
  segments = 10,
): Polyline<Point> => {
  const equation = cubicBezierEquation(curve);
  let startingPoint = [equation(0, 0), equation(0, 1)] as Point;
  const lineSegments: Polyline<Point> = [];
  let t = 0;
  const increment = 1 / segments;

  for (let i = 0; i < segments; i++) {
    t += increment;
    if (t <= 1) {
      const nextPoint: Point = pointFrom(equation(t, 0), equation(t, 1));
      lineSegments.push(lineSegment(startingPoint, nextPoint));
      startingPoint = nextPoint;
    }
  }

  return lineSegments;
};

export const pointOnCurve = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  curve: Curve<Point>,
  threshold: number,
) => {
  return pointOnPolyline(point, polyLineFromCurve(curve), threshold);
};

export const pointOnPolyline = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  polyline: Polyline<Point>,
  threshold = 10e-5,
) => {
  return polyline.some((line) => pointOnLineSegment(point, line, threshold));
};
