import type { GlobalPoint, LocalPoint, Vector } from "./types";

/**
 * Create a vector from the x and y coordiante elements.
 *
 * @param x The X aspect of the vector
 * @param y T Y aspect of the vector
 * @returns The constructed vector with X and Y as the coordinates
 */
export function vector(
  x: number,
  y: number,
  originX: number = 0,
  originY: number = 0,
): Vector {
  "inline";
  return [x - originX, y - originY] as Vector;
}

/**
 * Turn a point into a vector with the origin point.
 *
 * @param p The point to turn into a vector
 * @param origin The origin point in a given coordiante system
 * @returns The created vector from the point and the origin
 */
export function vectorFromPoint<Point extends GlobalPoint | LocalPoint>(
  p: Point,
  origin: Point = [0, 0] as Point,
): Vector {
  "inline";
  return vector(p[0] - origin[0], p[1] - origin[1]);
}

/**
 * Cross product is a binary operation on two vectors in 2D space.
 * It results in a vector that is perpendicular to both vectors.
 *
 * @param a One of the vectors to use for the directed area calculation
 * @param b The other vector to use for the directed area calculation
 * @returns The directed area value for the two vectos
 */
export function vectorCross(a: Vector, b: Vector): number {
  "inline";
  return a[0] * b[1] - b[0] * a[1];
}

/**
 * Dot product is defined as the sum of the products of the
 * two vectors.
 *
 * @param a One of the vectors for which the sum of products is calculated
 * @param b The other vector for which the sum of products is calculated
 * @returns The sum of products of the two vectors
 */
export function vectorDot(a: Vector, b: Vector) {
  "inline";
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Determines if the value has the shape of a Vector.
 *
 * @param v The value to test
 * @returns TRUE if the value has the shape and components of a Vectors
 */
export function isVector(v: unknown): v is Vector {
  "inline";
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    !isNaN(v[0]) &&
    typeof v[1] === "number" &&
    !isNaN(v[1])
  );
}

/**
 * Add two vectors by adding their coordinates.
 *
 * @param a One of the vectors to add
 * @param b The other vector to add
 * @returns The sum vector of the two provided vectors
 */
export function vectorAdd(a: Readonly<Vector>, b: Readonly<Vector>): Vector {
  "inline";
  return [a[0] + b[0], a[1] + b[1]] as Vector;
}

/**
 * Add two vectors by adding their coordinates.
 *
 * @param start One of the vectors to add
 * @param end The other vector to add
 * @returns The sum vector of the two provided vectors
 */
export function vectorSubtract(
  start: Readonly<Vector>,
  end: Readonly<Vector>,
): Vector {
  "inline";
  return [start[0] - end[0], start[1] - end[1]] as Vector;
}

/**
 * TODO
 *
 * @param v
 * @param scalar
 * @returns
 */
export function vectorScale(v: Vector, scalar: number): Vector {
  "inline";
  return vector(v[0] * scalar, v[1] * scalar);
}
