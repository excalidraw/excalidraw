import { degreesToRadians } from "./angle";
import type {
  LocalPoint,
  GlobalPoint,
  Radians,
  Degrees,
  Vector,
  ViewportPoint,
  GenericPoint,
  Extent,
} from "./types";
import { PRECISION } from "./utils";
import { vectorFromPoint, vectorScale } from "./vector";

/**
 * Create a properly typed Point instance from the X and Y coordinates.
 *
 * @param x The X coordinate
 * @param y The Y coordinate
 * @returns The branded and created point
 */
export function point<Point extends GlobalPoint | LocalPoint | ViewportPoint>(
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
export function pointFromArray<
  Point extends GlobalPoint | LocalPoint | ViewportPoint,
>(numberArray: number[]): Point | undefined {
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
export function pointFromPair<
  Point extends GlobalPoint | LocalPoint | ViewportPoint,
>(pair: [number, number]): Point {
  return pair as Point;
}

/**
 * Convert a vector to a point.
 *
 * @param v The vector to convert
 * @returns The point the vector points at with origin 0,0
 */
export function pointFromVector<
  P extends GlobalPoint | LocalPoint | ViewportPoint,
>(v: Vector): P {
  return v as unknown as P;
}

/**
 * Checks if the provided value has the shape of a Point.
 *
 * @param p The value to attempt verification on
 * @returns TRUE if the provided value has the shape of a local or global point
 */
export function isPoint(
  p: unknown,
): p is LocalPoint | GlobalPoint | ViewportPoint {
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
export function pointsEqual<
  Point extends GlobalPoint | LocalPoint | ViewportPoint,
>(a: Point, b: Point): boolean {
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
export function pointRotateRads<
  Point extends GlobalPoint | LocalPoint | ViewportPoint,
>([x, y]: Point, [cx, cy]: Point, angle: Radians): Point {
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
export function pointRotateDegs<
  Point extends GlobalPoint | LocalPoint | ViewportPoint,
>(point: Point, center: Point, angle: Degrees): Point {
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
  From extends GlobalPoint | LocalPoint | ViewportPoint,
  To extends GlobalPoint | LocalPoint | ViewportPoint,
>(p: From, v: Vector = [0, 0] as Vector): To {
  return point(p[0] + v[0], p[1] + v[1]);
}

/**
 * Find the center point at equal distance from both points.
 *
 * @param a One of the points to create the middle point for
 * @param b The other point to create the middle point for
 * @returns The middle point
 */
export function pointCenter<P extends LocalPoint | GlobalPoint | ViewportPoint>(
  ...p: P[]
): P {
  return pointFromPair(
    p
      .reduce((mid, x) => [mid[0] + x[0], mid[1] + x[1]], [0, 0])
      .map((x) => x / p.length) as [number, number],
  );
}

/**
 * Add together two points by their coordinates like you'd apply a translation
 * to a point by a vector.
 *
 * @param a One point to act as a basis
 * @param b The other point to act like the vector to translate by
 * @returns
 */
export function pointAdd<
  Point extends LocalPoint | GlobalPoint | ViewportPoint,
>(a: Point, b: Point): Point {
  return point(a[0] + b[0], a[1] + b[1]);
}

/**
 * Subtract a point from another point like you'd translate a point by an
 * invese vector.
 *
 * @param a The point to translate
 * @param b The point which will act like a vector
 * @returns The resulting point
 */
export function pointSubtract<
  Point extends LocalPoint | GlobalPoint | ViewportPoint,
>(a: Point, b: Point): Point {
  return point(a[0] - b[0], a[1] - b[1]);
}

/**
 * Calculate the distance between two points.
 *
 * @param a First point
 * @param b Second point
 * @returns The euclidean distance between the two points.
 */
export function pointDistance<
  P extends LocalPoint | GlobalPoint | ViewportPoint,
>(a: P, b: P): number {
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
export function pointDistanceSq<
  P extends LocalPoint | GlobalPoint | ViewportPoint,
>(a: P, b: P): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Scale a point from a given origin by the multiplier.
 *
 * @param p The point to scale
 * @param mid The origin to scale from
 * @param multiplier The scaling factor
 * @returns
 */
export const pointScaleFromOrigin = <
  P extends GlobalPoint | LocalPoint | ViewportPoint,
>(
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
export const isPointWithinBounds = <
  P extends GlobalPoint | LocalPoint | ViewportPoint,
>(
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
 * The extent (width and height) of a set of points.
 *
 * @param points The points to calculate the extent for
 * @returns
 */
export const pointExtent = (points: readonly GenericPoint[]): Extent => {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  } as Extent;
};

/**
 * Rescale the set of points from the top leftmost point as origin
 *
 * @param dimension 0 for rescaling only x, 1 for y
 * @param newSize The target size
 * @param points The points to restcale
 * @param normalize Whether to normalize the result
 */
// TODO: Center should be parametric and should use pointScaleFromOrigin()
export const pointRescaleFromTopLeft = <Point extends GenericPoint>(
  dimension: 0 | 1,
  newSize: number,
  points: readonly Point[],
  normalize: boolean,
): Point[] => {
  const coordinates = points.map((point) => point[dimension]);
  const maxCoordinate = Math.max(...coordinates);
  const minCoordinate = Math.min(...coordinates);
  const size = maxCoordinate - minCoordinate;
  const scale = size === 0 ? 1 : newSize / size;

  let nextMinCoordinate = Infinity;

  const scaledPoints = points.map((point): Point => {
    const newCoordinate = point[dimension] * scale;
    const newPoint = [...point];
    newPoint[dimension] = newCoordinate;
    if (newCoordinate < nextMinCoordinate) {
      nextMinCoordinate = newCoordinate;
    }
    return newPoint as Point;
  });

  if (!normalize) {
    return scaledPoints;
  }

  if (scaledPoints.length === 2) {
    // we don't translate two-point lines
    return scaledPoints;
  }

  const translation = minCoordinate - nextMinCoordinate;

  const nextPoints = scaledPoints.map((scaledPoint) =>
    pointFromPair<Point>(
      scaledPoint.map((value, currentDimension) => {
        return currentDimension === dimension ? value + translation : value;
      }) as [number, number],
    ),
  );

  return nextPoints;
};
