import { pointCenter, pointFrom, pointRotateRads } from "./point";
import type { GlobalPoint, Line, LocalPoint, Radians } from "./types";

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
 * Convenient point creation from an array of two points.
 *
 * @param param0 The array with the two points to convert to a line
 * @returns The created line
 */
export function lineFromPointPair<P extends GlobalPoint | LocalPoint>([a, b]: [
  P,
  P,
]): Line<P> {
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
  return pointArray.length === 2
    ? line<P>(pointArray[0], pointArray[1])
    : undefined;
}

/**
 * Return the coordinates resulting from rotating the given line about an
 * origin by an angle in degrees note that when the origin is not given,
 * the midpoint of the given line is used as the origin
 *
 * @param l
 * @param angle
 * @param origin
 * @returns
 */
export const lineRotate = <Point extends LocalPoint | GlobalPoint>(
  l: Line<Point>,
  angle: Radians,
  origin?: Point,
): Line<Point> => {
  return line(
    pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle),
    pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle),
  );
};

/**
 * Determines the intersection point (unless the lines are parallel) of two
 * lines
 *
 * @param a
 * @param b
 * @returns
 */
export const linesIntersectAt = <Point extends GlobalPoint | LocalPoint>(
  a: Line<Point>,
  b: Line<Point>,
): Point | null => {
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
};
