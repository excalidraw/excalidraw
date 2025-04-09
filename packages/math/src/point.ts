import { degreesToRadians, radiansToDegrees } from "./angle";
import { PRECISION } from "./utils";
import { vectorDot, vectorFromPoint, vectorScale } from "./vector";

import type {
  LocalPoint,
  GlobalPoint,
  Radians,
  Degrees,
  Vector,
} from "./types";

/**
 * Create a properly typed Point instance from the X and Y coordinates.
 *
 * @param x The X coordinate
 * @param y The Y coordinate
 * @returns The branded and created point
 */
export function pointFrom<Point extends GlobalPoint | LocalPoint>(
  x: number,
  y: number,
): Point {
  return [x, y] as Point;
}

/**
 * Converts and remaps an array containing a pair of numbers to Point.
 *
 * @param numberArray The number array to check and to convert to Point
 * @returns The point instance
 */
export function pointFromArray<Point extends GlobalPoint | LocalPoint>(
  numberArray: number[],
): Point | undefined {
  return numberArray.length === 2
    ? pointFrom<Point>(numberArray[0], numberArray[1])
    : undefined;
}

/**
 * Converts and remaps a pair of numbers to Point.
 *
 * @param pair A number pair to convert to Point
 * @returns The point instance
 */
export function pointFromPair<Point extends GlobalPoint | LocalPoint>(
  pair: [number, number],
): Point {
  return pair as Point;
}

/**
 * Convert a vector to a point.
 *
 * @param v The vector to convert
 * @returns The point the vector points at with origin 0,0
 */
export function pointFromVector<P extends GlobalPoint | LocalPoint>(
  v: Vector,
  offset: P = pointFrom(0, 0),
): P {
  return pointFrom<P>(offset[0] + v[0], offset[1] + v[1]);
}

/**
 * Checks if the provided value has the shape of a Point.
 *
 * @param p The value to attempt verification on
 * @returns TRUE if the provided value has the shape of a local or global point
 */
export function isPoint(p: unknown): p is LocalPoint | GlobalPoint {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    !isNaN(p[0]) &&
    typeof p[1] === "number" &&
    !isNaN(p[1])
  );
}

/**
 * Compare two points coordinate-by-coordinate and if
 * they are closer than INVERSE_PRECISION it returns TRUE.
 *
 * @param a Point The first point to compare
 * @param b Point The second point to compare
 * @returns TRUE if the points are sufficiently close to each other
 */
export function pointsEqual<Point extends GlobalPoint | LocalPoint>(
  a: Point,
  b: Point,
): boolean {
  const abs = Math.abs;
  return abs(a[0] - b[0]) < PRECISION && abs(a[1] - b[1]) < PRECISION;
}

/**
 * Rotate a point by [angle] radians.
 *
 * @param point The point to rotate
 * @param center The point to rotate around, the center point
 * @param angle The radians to rotate the point by
 * @returns The rotated point
 */
export function pointRotateRads<Point extends GlobalPoint | LocalPoint>(
  [x, y]: Point,
  [cx, cy]: Point,
  angle: Radians,
): Point {
  return pointFrom(
    (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx,
    (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy,
  );
}

/**
 * Rotate a point by [angle] degree.
 *
 * @param point The point to rotate
 * @param center The point to rotate around, the center point
 * @param angle The degree to rotate the point by
 * @returns The rotated point
 */
export function pointRotateDegs<Point extends GlobalPoint | LocalPoint>(
  point: Point,
  center: Point,
  angle: Degrees,
): Point {
  return pointRotateRads(point, center, degreesToRadians(angle));
}

/**
 * Translate a point by a vector.
 *
 * WARNING: This is not for translating Excalidraw element points!
 *          You need to account for rotation on base coordinates
 *          on your own.
 *          CONSIDER USING AN APPROPRIATE ELEMENT-AWARE TRANSLATE!
 *
 * @param p The point to apply the translation on
 * @param v The vector to translate by
 * @returns
 */
// TODO 99% of use is translating between global and local coords, which need to be formalized
export function pointTranslate<
  From extends GlobalPoint | LocalPoint,
  To extends GlobalPoint | LocalPoint,
>(p: From, v: Vector = [0, 0] as Vector): To {
  return pointFrom(p[0] + v[0], p[1] + v[1]);
}

/**
 * Find the center point at equal distance from both points.
 *
 * @param a One of the points to create the middle point for
 * @param b The other point to create the middle point for
 * @returns The middle point
 */
export function pointCenter<P extends LocalPoint | GlobalPoint>(a: P, b: P): P {
  return pointFrom((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}

/**
 * Calculate the distance between two points.
 *
 * @param a First point
 * @param b Second point
 * @returns The euclidean distance between the two points.
 */
export function pointDistance<P extends LocalPoint | GlobalPoint>(
  a: P,
  b: P,
): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Calculate the squared distance between two points.
 *
 * Note: Use this if you only compare distances, it saves a square root.
 *
 * @param a First point
 * @param b Second point
 * @returns The euclidean distance between the two points.
 */
export function pointDistanceSq<P extends LocalPoint | GlobalPoint>(
  a: P,
  b: P,
): number {
  const xDiff = b[0] - a[0];
  const yDiff = b[1] - a[1];

  return xDiff * xDiff + yDiff * yDiff;
}

/**
 * Scale a point from a given origin by the multiplier.
 *
 * @param p The point to scale
 * @param mid The origin to scale from
 * @param multiplier The scaling factor
 * @returns
 */
export const pointScaleFromOrigin = <P extends GlobalPoint | LocalPoint>(
  p: P,
  mid: P,
  multiplier: number,
) => pointTranslate(mid, vectorScale(vectorFromPoint(p, mid), multiplier));

/**
 * Returns whether `q` lies inside the segment/rectangle defined by `p` and `r`.
 * This is an approximation to "does `q` lie on a segment `pr`" check.
 *
 * @param p The first point to compare against
 * @param q The actual point this function checks whether is in between
 * @param r The other point to compare against
 * @returns TRUE if q is indeed between p and r
 */
export const isPointWithinBounds = <P extends GlobalPoint | LocalPoint>(
  p: P,
  q: P,
  r: P,
) => {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  );
};

/**
 * Calculates the perpendicular distance from a point to a line segment defined by two endpoints.
 *
 * If the segment is of zero length, the function returns the distance from the point to the start.
 *
 * @typeParam P - The point type, restricted to LocalPoint or GlobalPoint.
 * @param p - The point from which the perpendicular distance is measured.
 * @param start - The starting point of the line segment.
 * @param end - The ending point of the line segment.
 * @returns The perpendicular distance from point p to the line segment defined by start and end.
 */
export const perpendicularDistance = <P extends GlobalPoint | LocalPoint>(
  p: P,
  start: P,
  end: P,
): number => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return Math.hypot(p[0] - start[0], p[1] - start[1]);
  }
  // Equation of line distance
  const numerator = Math.abs(
    dy * p[0] - dx * p[1] + end[0] * start[1] - end[1] * start[0],
  );
  const denom = Math.hypot(dx, dy);
  return numerator / denom;
};

/** * Calculates the angle between three points in degrees.
 * The angle is calculated at the first point (p0) using the second (p1) and third (p2) points.
 * The angle is measured in degrees and is always positive.
 * The function uses the dot product and the arccosine function to calculate the angle. * The result is clamped to the range [-1, 1] to avoid precision errors.
 * @param p0 The first point used to form the angle.
 * @param p1 The vertex point where the angle is calculated.
 * @param p2 The second point used to form the angle.
 * @returns The angle in degrees between the three points.
 **/
export const angleBetween = <P extends GlobalPoint | LocalPoint>(
  p0: P,
  p1: P,
  p2: P,
): Degrees => {
  const v1 = vectorFromPoint(p0, p1);
  const v2 = vectorFromPoint(p1, p2);

  // dot and cross product
  const magnitude1 = Math.hypot(v1[0], v1[1]);
  const magnitude2 = Math.hypot(v2[0], v2[1]);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0 as Degrees;
  }

  const dot = vectorDot(v1, v2);

  let cos = dot / (magnitude1 * magnitude2);
  // Clamp cos to [-1,1] to avoid precision errors
  cos = Math.max(-1, Math.min(1, cos));
  const rad = Math.acos(cos) as Radians;

  return radiansToDegrees(rad);
};
