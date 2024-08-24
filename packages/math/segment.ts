import { pointCenter, pointRotateRads } from "./point";
import type { GlobalPoint, LineSegment, LocalPoint, Radians } from "./types";

/**
 * Create a line segment from two points.
 *
 * @param points The two points delimiting the line segment on each end
 * @returns The line segment delineated by the points
 */
export function lineSegment<P extends GlobalPoint | LocalPoint>(
  a: P,
  b: P,
): LineSegment<P> {
  "inline";
  return [a, b] as LineSegment<P>;
}

export function lineSegmentFromPointArray<P extends GlobalPoint | LocalPoint>(
  pointArray: P[],
): LineSegment<P> | undefined {
  "inline";
  return pointArray.length === 2
    ? lineSegment<P>(pointArray[0], pointArray[1])
    : undefined;
}

// return the coordinates resulting from rotating the given line about an origin by an angle in degrees
// note that when the origin is not given, the midpoint of the given line is used as the origin
export const lineSegmentRotate = <Point extends LocalPoint | GlobalPoint>(
  l: LineSegment<Point>,
  angle: Radians,
  origin?: Point,
): LineSegment<Point> => {
  return lineSegment(
    pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle),
    pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle),
  );
};
