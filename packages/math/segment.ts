import type { GlobalPoint, LineSegment, LocalPoint } from "./types";

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
