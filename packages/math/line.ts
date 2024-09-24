import { pointCenter, pointRotateRads } from "./point";
import type { GenericPoint, Line, Radians } from "./types";

/**
 * Create a line from two points.
 *
 * @param points The two points lying on the line
 * @returns The line on which the points lie
 */
export function line<P extends GenericPoint>(a: P, b: P): Line<P> {
  return [a, b] as Line<P>;
}

/**
 * Convenient point creation from an array of two points.
 *
 * @param param0 The array with the two points to convert to a line
 * @returns The created line
 */
export function lineFromPointPair<P extends GenericPoint>([a, b]: [
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
export function lineFromPointArray<P extends GenericPoint>(
  pointArray: P[],
): Line<P> | undefined {
  return pointArray.length === 2
    ? line<P>(pointArray[0], pointArray[1])
    : undefined;
}

// return the coordinates resulting from rotating the given line about an origin by an angle in degrees
// note that when the origin is not given, the midpoint of the given line is used as the origin
export const lineRotate = <Point extends GenericPoint>(
  l: Line<Point>,
  angle: Radians,
  origin?: Point,
): Line<Point> => {
  return line(
    pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle),
    pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle),
  );
};
