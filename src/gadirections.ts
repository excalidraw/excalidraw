import * as GA from "./ga";
import { Line, Direction, Point } from "./ga";

import * as GAPoints from "./gapoints";

/**
 * A direction is stored as an array `[0, 0, 0, 0, y, x, 0, 0]` representing
 * vector `(x, y)`.
 */

export const from = (point: Point): Point => [
  0,
  0,
  0,
  0,
  point[4],
  point[5],
  0,
  0,
];

export const fromTo = (from: Point, to: Point): Direction =>
  GA.inormalized([0, 0, 0, 0, to[4] - from[4], to[5] - from[5], 0, 0]);

export const orthogonal = (direction: Direction): Direction =>
  GA.inormalized([0, 0, 0, 0, -direction[5], direction[4], 0, 0]);

export const orthogonalToLine = (line: Line): Direction => GA.mul(line, GA.I);

/** Check that 2 direction are not opposite */
export const hasSameSign = (
  a: Direction,
  b: Direction,
  strict = false,
): boolean => {
  // With strict deactivated, we consider 0 has same sign
  const isSameSign = (na: number, nb: number) =>
    strict ? na * nb > 0 : na * nb >= 0;

  return isSameSign(a[4], b[4]) && isSameSign(a[5], b[5]);
};
