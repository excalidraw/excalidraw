import type { Point, Polygon, GeometricShape } from "./geometry/shape";
import {
  pointInEllipse,
  pointInPolygon,
  pointOnCurve,
  pointOnEllipse,
  pointOnLine,
  pointOnPolycurve,
  pointOnPolygon,
  pointOnPolyline,
  close,
} from "./geometry/geometry";

// check if the given point is considered on the given shape's border
export const isPointOnShape = (
  point: Point,
  shape: GeometricShape,
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
      return pointOnLine(point, shape.data, tolerance);
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
export const isPointInShape = (point: Point, shape: GeometricShape) => {
  switch (shape.type) {
    case "polygon":
      return pointInPolygon(point, shape.data);
    case "line":
      return false;
    case "curve":
      return false;
    case "ellipse":
      return pointInEllipse(point, shape.data);
    case "polyline": {
      const polygon = close(shape.data.flat()) as Polygon;
      return pointInPolygon(point, polygon);
    }
    case "polycurve": {
      return false;
    }
    default:
      throw Error(`shape ${shape} is not implemented`);
  }
};

// check if the given element is in the given bounds
export const isPointInBounds = (point: Point, bounds: Polygon) => {
  return pointInPolygon(point, bounds);
};
