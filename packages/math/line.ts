import type { GlobalPoint, Line, LocalPoint } from "./types";

/**
 * Create a line from two points.
 *
 * @param points The two points lying on the line
 * @returns The line on which the points lie
 */
export function line<P extends GlobalPoint | LocalPoint>(a: P, b: P): Line<P> {
  "inline";
  return [a, b] as Line<P>;
}

/**
 * TODO
 *
 * @param param0
 * @returns
 */
export function lineFromPointPair<P extends GlobalPoint | LocalPoint>([a, b]: [
  P,
  P,
]): Line<P> {
  "inline";
  return line(a, b);
}

/**
 * TODO
 *
 * @param pointArray
 * @returns
 */
export function lineFromPointArray<P extends GlobalPoint | LocalPoint>(
  pointArray: P[],
): Line<P> | undefined {
  "inline";
  return pointArray.length === 2
    ? line<P>(pointArray[0], pointArray[1])
    : undefined;
}
