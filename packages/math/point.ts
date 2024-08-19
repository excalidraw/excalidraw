import { degreesToRadians } from "./utils";
import type {
  LocalPoint,
  GlobalPoint,
  Radians,
  Degrees,
  Vector,
} from "./types";
import { PRECISION } from "./utils";

/**
 * Create a properly typed Point instance from the X and Y coordinates.
 *
 * @param x The X coordinate
 * @param y The Y coordinate
 * @returns The branded and created point
 */
export function point<Point extends GlobalPoint | LocalPoint>(
  x: number,
  y: number,
): Point {
  "inline";
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
): GlobalPoint | LocalPoint | undefined {
  "inline";
  return numberArray.length === 2
    ? point<Point>(numberArray[0], numberArray[1])
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
  "inline";
  return pair as Point;
}

/**
 * Checks if the provided value has the shape of a Point.
 *
 * @param p The value to attempt verification on
 * @returns TRUE if the provided value has the shape of a local or global point
 */
export function isPoint(p: unknown): p is LocalPoint | GlobalPoint {
  "inline";
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
  "inline";
  const abs = Math.abs;
  return abs(a[0] - b[0]) < PRECISION && abs(a[1] - b[1]) < PRECISION;
}

/**
 * Roate a point by [angle] radians.
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
  "inline";

  return point(
    (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx,
    (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy,
  );
}

/**
 * Roate a point by [angle] degree.
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
  "inline";

  return pointRotateRads(point, center, degreesToRadians(angle));
}

/**
 * TODO
 *
 * WARNING: This is not for translating Excalidraw element points!
 *          You need to account for rotation on base coordinates
 *          on your own.
 *          CONSIDER USING AN APPROPRIATE ELEMENT-AWARE TRANSLATE!
 *
 * @param p
 * @param v
 * @returns
 */
// TODO 99% of use is translating between global and local coords, which need to be formalized
export function pointTranslate<
  From extends GlobalPoint | LocalPoint,
  To extends GlobalPoint | LocalPoint,
>(p: From, v: Vector = [0, 0] as Vector): To {
  return point(p[0] + v[0], p[1] + v[1]);
}

/**
 * TODO
 *
 * @param a
 * @param b
 * @returns
 */
export const centerPoint = <P extends LocalPoint | GlobalPoint>(
  a: P,
  b: P,
): P => {
  return point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
};
