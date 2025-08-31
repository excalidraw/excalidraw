import { pointFrom } from "./point";
import { lineSegment, lineSegmentIntersectionPoints } from "./segment";

import type { GlobalPoint, LineSegment, LocalPoint, Rectangle } from "./types";

export function rectangle<P extends GlobalPoint | LocalPoint>(
  topLeft: P,
  bottomRight: P,
): Rectangle<P> {
  return [topLeft, bottomRight] as Rectangle<P>;
}

export function rectangleFromNumberSequence<
  Point extends LocalPoint | GlobalPoint,
>(minX: number, minY: number, maxX: number, maxY: number) {
  return rectangle(pointFrom<Point>(minX, minY), pointFrom<Point>(maxX, maxY));
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

export function rectangleIntersectRectangle<
  Point extends LocalPoint | GlobalPoint,
>(rectangle1: Rectangle<Point>, rectangle2: Rectangle<Point>): boolean {
  const [[minX1, minY1], [maxX1, maxY1]] = rectangle1;
  const [[minX2, minY2], [maxX2, maxY2]] = rectangle2;

  return minX1 < maxX2 && maxX1 > minX2 && minY1 < maxY2 && maxY1 > minY2;
}
