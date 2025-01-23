import { invariant } from "../excalidraw/utils";
import { pointFrom } from "./point";
import { distanceToLineSegment, lineSegment } from "./segment";
import type { GlobalPoint, LocalPoint, Rectangle } from "./types";

export function rectangle<P extends GlobalPoint | LocalPoint>(
  topLeft: P,
  bottomRight: P,
): Rectangle<P> {
  return [topLeft, bottomRight] as Rectangle<P>;
}

export function rectangleFromPair<P extends GlobalPoint | LocalPoint>(
  pair: [a: P, b: P],
): Rectangle<P> {
  return pair as Rectangle<P>;
}

export function rectangleFromArray<P extends GlobalPoint | LocalPoint>(
  pointArray: P[],
): Rectangle<P> {
  invariant(
    pointArray.length === 4,
    "Point array contains more or less points to create a rectangle from",
  );

  return pointArray as Rectangle<P>;
}

export function rectangleDistanceFromPoint<
  Point extends GlobalPoint | LocalPoint,
>(r: Rectangle<Point>, p: Point): number {
  const sides = [
    lineSegment(pointFrom(r[0][0], r[0][1]), pointFrom(r[1][0], r[0][1])),
    lineSegment(pointFrom(r[1][0], r[0][1]), pointFrom(r[1][0], r[1][1])),
    lineSegment(pointFrom(r[1][0], r[1][1]), pointFrom(r[0][0], r[1][1])),
    lineSegment(pointFrom(r[0][0], r[1][1]), pointFrom(r[0][0], r[0][1])),
  ];

  return Math.min(...sides.map((side) => distanceToLineSegment(p, side)));
}
