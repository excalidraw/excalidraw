import type { GlobalPoint, LocalPoint, Polygon } from "./types";

export function polygon<Point extends GlobalPoint | LocalPoint>(
  ...points: Point[]
) {
  "inline";
  return points as Polygon<Point>;
}

export function polygonFromPoints<Point extends GlobalPoint | LocalPoint>(
  points: Point[],
) {
  "inline";
  return points as Polygon<Point>;
}

export function polygonIsClosed<Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
) {
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}
