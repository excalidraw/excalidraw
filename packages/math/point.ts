import { PRECISION } from "./utils";

//
// === Types
//

/**
 * Represents a 2D position in world or canvas space. A
 * global coordinate.
 */
export type GlobalPoint = [x: number, y: number] & {
  _brand: "excalimath__globalpoint";
};

/**
 * Represents a 2D position in whatever local space it's
 * needed. A local coordinate.
 */
export type LocalPoint = [x: number, y: number] & {
  _brand: "excalimath__localpoint";
};

//
// Functions
//

/**
 * Represents a generic 2D position irrelevant of the
 * coordinate system. Useful for library function
 * definitions which don't care about coordinate origins.
 */
export type Point = LocalPoint | GlobalPoint;

/**
 * Compare two points coordinate-by-coordinate and if
 * they are closer than INVERSE_PRECISION it returns TRUE.
 *
 * @param a Point The first point to compare
 * @param b Point The second point to compare
 * @returns TRUE if the points are sufficiently close to each other
 */
export function pointsEqual(a: Point, b: Point): boolean {
  "inline";
  return Math.abs(a[0] - b[0]) < PRECISION && Math.abs(a[1] - b[1]) < PRECISION;
}
