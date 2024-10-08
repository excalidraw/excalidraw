import { ellipseLineIntersectionPoints } from "./ellipse";
import { pointFrom, pointCenter, pointRotateRads } from "./point";
import { segmentIncludesPoint } from "./segment";
import type { GenericPoint, Line, Radians, Segment } from "./types";

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
export function lineRotate<Point extends GenericPoint>(
  l: Line<Point>,
  angle: Radians,
  origin?: Point,
): Line<Point> {
  return line(
    pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle),
    pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle),
  );
}

/**
 * Returns the intersection point of two infinite lines, if any
 *
 * @param a One of the line to intersect
 * @param b Another line to intersect
 * @returns The intersection point
 */
export function lineLineIntersectionPoint<Point extends GenericPoint>(
  [[x1, y1], [x2, y2]]: Line<Point>,
  [[x3, y3], [x4, y4]]: Line<Point>,
): Point | null {
  const a = x1 * y2 - x2 * y1;
  const c = x3 * y4 - x4 * y3;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (den === 0) {
    return null;
  }
  const xnum = a * (x3 - x4) - (x1 - x2) * c;
  const ynum = a * (y3 - y4) - (y1 - y2) * c;

  return pointFrom<Point>(xnum / den, ynum / den);
}

/**
 * Returns the intersection point of a segment and a line
 *
 * @param l
 * @param s
 * @returns
 */
export function lineSegmentIntersectionPoints<Point extends GenericPoint>(
  l: Line<Point>,
  s: Segment<Point>,
): Point | null {
  const candidate = lineLineIntersectionPoint(l, line(s[0], s[1]));
  if (!candidate || !segmentIncludesPoint(candidate, s)) {
    return null;
  }

  return candidate;
}

export const lineInterceptsEllipse = ellipseLineIntersectionPoints;
