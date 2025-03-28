import { pointFrom } from "./point";
import { lineSegment, lineSegmentIntersectionPoints } from "./segment";

import type { GlobalPoint, LineSegment, LocalPoint, Rectangle } from "./types";

export function rectangle<P extends GlobalPoint | LocalPoint>(
  topLeft: P,
  bottomRight: P,
): Rectangle<P> {
  return [topLeft, bottomRight] as Rectangle<P>;
}

export function rectangleIntersectLineSegment<
  Point extends LocalPoint | GlobalPoint,
>(r: Rectangle<Point>, l: LineSegment<Point>): Point[] {
  return [
    lineSegment(r[0], pointFrom(r[1][0], r[0][1])),
    lineSegment(pointFrom(r[1][0], r[0][1]), r[1]),
    lineSegment(r[1], pointFrom(r[0][0], r[1][1])),
    lineSegment(pointFrom(r[0][0], r[1][1]), r[0]),
  ]
    .map((s) => lineSegmentIntersectionPoints(l, s))
    .filter((i): i is Point => !!i);
}
