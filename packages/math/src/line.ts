import { pointFrom } from "./point";

import type { GlobalPoint, Line, LocalPoint } from "./types";

/**
 * Create a line from two points.
 *
 * @param points The two points lying on the line
 * @returns The line on which the points lie
 */
export function line<P extends GlobalPoint | LocalPoint>(a: P, b: P): Line<P> {
  return [a, b] as Line<P>;
}

/**
 * Determines the intersection point (unless the lines are parallel) of two
 * lines
 *
 * @param a
 * @param b
 * @returns
 */
export function linesIntersectAt<Point extends GlobalPoint | LocalPoint>(
  a: Line<Point>,
  b: Line<Point>,
): Point | null {
  const A1 = a[1][1] - a[0][1];
  const B1 = a[0][0] - a[1][0];
  const A2 = b[1][1] - b[0][1];
  const B2 = b[0][0] - b[1][0];
  const D = A1 * B2 - A2 * B1;
  if (D !== 0) {
    const C1 = A1 * a[0][0] + B1 * a[0][1];
    const C2 = A2 * b[0][0] + B2 * b[0][1];
    return pointFrom<Point>((C1 * B2 - C2 * B1) / D, (A1 * C2 - A2 * C1) / D);
  }

  return null;
}
