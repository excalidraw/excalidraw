import {
  Point,
  Polygon,
  Shape,
  pointInPolygon,
  pointOnPolygon,
} from "./geometry";

// check if the given point is considered on the given shape's border
export const isPointOnElementBorder = (
  point: Point,
  shape: Shape,
  tolerance = 0,
) => {
  // get the distance from the given point to the given element
  // check if the distance is within the given epsilon range
  switch (shape.type) {
    case "polygon":
      return pointOnPolygon(point, shape.data as Polygon, tolerance);
    case "line":
      return false;
    case "curve":
      return false;
    case "ellipse":
      return false;
  }
};

// check if the given point is considered on the element's border
export const isPointInShape = (point: Point, shape: Shape, epsilon = 0) => {
  switch (shape.type) {
    case "polygon":
      return pointInPolygon(point, shape.data as Polygon);
    case "line":
      return false;
    case "curve":
      return false;
    case "ellipse":
      return false;
  }
};

// check if the given element is in the given bounds
export const isPointInBounds = (point: Point, bounds: Polygon) => {
  return pointInPolygon(point, bounds);
};
