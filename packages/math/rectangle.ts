import { invariant } from "../excalidraw/utils";
import { point } from "./point";
import { segment, segmentDistanceToPoint } from "./segment";
import type { GenericPoint, Rectangle } from "./types";

export function rectangle<P extends GenericPoint>(
  topLeft: P,
  bottomRight: P,
): Rectangle<P> {
  return [topLeft, bottomRight] as Rectangle<P>;
}

export function rectangleFromPair<P extends GenericPoint>(
  pair: [a: P, b: P],
): Rectangle<P> {
  return pair as Rectangle<P>;
}

export function rectangleFromArray<P extends GenericPoint>(
  pointArray: P[],
): Rectangle<P> {
  invariant(
    pointArray.length === 4,
    "Point array contains more or less points to create a rectangle from",
  );

  return pointArray as Rectangle<P>;
}

export function rectangleDistanceFromPoint<Point extends GenericPoint>(
  r: Rectangle<Point>,
  p: Point,
): number {
  const sides = [
    segment(point(r[0][0], r[0][1]), point(r[1][0], r[0][1])),
    segment(point(r[1][0], r[0][1]), point(r[1][0], r[1][1])),
    segment(point(r[1][0], r[1][1]), point(r[0][0], r[1][1])),
    segment(point(r[0][0], r[1][1]), point(r[0][0], r[0][1])),
  ];

  return Math.min(...sides.map((side) => segmentDistanceToPoint(p, side)));
}
