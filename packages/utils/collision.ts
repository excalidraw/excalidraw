import type { Polycurve, Polyline } from "./geometry/shape";
import {
  pointInEllipse,
  pointOnEllipse,
  type GeometricShape,
} from "./geometry/shape";
import type { Curve } from "../math";
import {
  lineSegment,
  pointFrom,
  polygonIncludesPoint,
  pointOnLineSegment,
  pointOnPolygon,
  polygonFromPoints,
  type GlobalPoint,
  type LocalPoint,
  type Polygon,
} from "../math";

// check if the given point is considered on the given shape's border
export const isPointOnShape = <Point extends GlobalPoint | LocalPoint>(
  point: Point,
  shape: GeometricShape<Point>,
  tolerance = 0,
) => {
  // get the distance from the given point to the given element
  // check if the distance is within the given epsilon range
  switch (shape.type) {
    case "polygon":
      return pointOnPolygon(point, shape.data, tolerance);
    case "ellipse":
      return pointOnEllipse(point, shape.data, tolerance);
    case "line":
      return pointOnLineSegment(point, shape.data, tolerance);
    case "polyline":
      return pointOnPolyline(point, shape.data, tolerance);
    case "curve":
      return pointOnCurve(point, shape.data, tolerance);
    case "polycurve":
      return pointOnPolycurve(point, shape.data, tolerance);
    default:
      throw Error(`shape ${shape} is not implemented`);
  }
};

// check if the given point is considered inside the element's border
export const isPointInShape = <Point extends GlobalPoint | LocalPoint>(
  point: Point,
  shape: GeometricShape<Point>,
) => {
  switch (shape.type) {
    case "polygon":
      return polygonIncludesPoint(point, shape.data);
    case "line":
      return false;
    case "curve":
      return false;
    case "ellipse":
      return pointInEllipse(point, shape.data);
    case "polyline": {
      const polygon = polygonFromPoints(shape.data.flat());
      return polygonIncludesPoint(point, polygon);
    }
    case "polycurve": {
      return false;
    }
    default:
      throw Error(`shape ${shape} is not implemented`);
  }
};

// check if the given element is in the given bounds
export const isPointInBounds = <Point extends GlobalPoint | LocalPoint>(
  point: Point,
  bounds: Polygon<Point>,
) => {
  return polygonIncludesPoint(point, bounds);
};

const pointOnPolycurve = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  polycurve: Polycurve<Point>,
  tolerance: number,
) => {
  return polycurve.some((curve) => pointOnCurve(point, curve, tolerance));
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
