import { pointsEqual } from "./point";
import { segment, segmentIncludesPoint } from "./segment";
import type { GenericPoint, Polygon } from "./types";
import { PRECISION } from "./utils";

export function polygon<Point extends GenericPoint>(...points: Point[]) {
  return polygonClose(points) as Polygon<Point>;
}

export function polygonFromPoints<Point extends GenericPoint>(points: Point[]) {
  return polygonClose(points) as Polygon<Point>;
}

export const polygonIncludesPoint = <Point extends GenericPoint>(
  point: Point,
  polygon: Polygon<Point>,
) => {
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    if (
      ((yi > y && yj <= y) || (yi <= y && yj > y)) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
};

export const pointOnPolygon = <Point extends GenericPoint>(
  p: Point,
  poly: Polygon<Point>,
  threshold = PRECISION,
) => {
  let on = false;

  for (let i = 0, l = poly.length - 1; i < l; i++) {
    if (segmentIncludesPoint(p, segment(poly[i], poly[i + 1]), threshold)) {
      on = true;
      break;
    }
  }

  return on;
};

function polygonClose<Point extends GenericPoint>(polygon: Point[]) {
  return polygonIsClosed(polygon)
    ? polygon
    : ([...polygon, polygon[0]] as Polygon<Point>);
}

function polygonIsClosed<Point extends GenericPoint>(polygon: Point[]) {
  return pointsEqual(polygon[0], polygon[polygon.length - 1]);
}
