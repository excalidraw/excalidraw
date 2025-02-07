import { invariant } from "../excalidraw/utils";
import { line, lineSegmentIntersectionPoints, linesIntersectAt } from "./line";
import { pointFrom } from "./point";
import { distanceToLineSegment, lineSegment } from "./segment";
import type {
  GlobalPoint,
  Line,
  LineSegment,
  LocalPoint,
  Rectangle,
} from "./types";

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

export function rectangleIntersectLine<Point extends LocalPoint | GlobalPoint>(
  r: Rectangle<Point>,
  l: Line<Point>,
): Point[] {
  return [
    line(r[0], pointFrom(r[1][0], r[0][1])),
    line(pointFrom(r[1][0], r[0][1]), r[1]),
    line(r[1], pointFrom(r[0][0], r[1][1])),
    line(pointFrom(r[0][0], r[1][1]), r[0]),
  ]
    .map((s) => linesIntersectAt(l, s))
    .filter((i): i is Point => !!i);
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
