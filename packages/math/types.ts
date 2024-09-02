//
// Measurements
//

/**
 * By definition one radian is the angle subtended at the centre
 * of a circle by an arc that is equal in length to the radius.
 */
export type Radians = number & { _brand: "excalimath__radian" };

/**
 * An angle measurement of a plane angle in which one full
 * rotation is 360 degrees.
 */
export type Degrees = number & { _brand: "excalimath_degree" };

//
// Range
//

/**
 * A number range which includes the start and end numbers in the range.
 */
export type InclusiveRange = [number, number] & { _brand: "excalimath_degree" };

//
// Point
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

// Line

/**
 * A line is an infinitely long object with no width, depth, or curvature.
 */
export type Line<P extends GlobalPoint | LocalPoint> = [p: P, q: P] & {
  _brand: "excalimath_line";
};

/**
 * In geometry, a line segment is a part of a straight
 * line that is bounded by two distinct end points, and
 * contains every point on the line that is between its endpoints.
 */
export type LineSegment<P extends GlobalPoint | LocalPoint> = [a: P, b: P] & {
  _brand: "excalimath_linesegment";
};

//
// Vector
//

/**
 * Represents a 2D vector
 */
export type Vector = [u: number, v: number] & {
  _brand: "excalimath__vector";
};

// Triangles

/**
 * A triangle represented by 3 points
 */
export type Triangle<P extends GlobalPoint | LocalPoint> = [
  a: P,
  b: P,
  c: P,
] & {
  _brand: "excalimath__triangle";
};

//
// Polygon
//

/**
 * A polygon is a closed shape by connecting the given points
 * rectangles and diamonds are modelled by polygons
 */
export type Polygon<Point extends GlobalPoint | LocalPoint> = Point[] & {
  _brand: "excalimath_polygon";
};

//
// Curve
//

/**
 * Cubic bezier curve with four control points
 */
export type Curve<Point extends GlobalPoint | LocalPoint> = [
  Point,
  Point,
  Point,
  Point,
] & {
  _brand: "excalimath_curve";
};

export type PolarCoords = [
  radius: number,
  /** angle in radians */
  angle: number,
];

/**
 * Angles are in radians and centered on 0, 0. Zero radians on a 1 radius circle
 * corresponds to (1, 0) cartesian coordinates (point), i.e. to the "right".
 */
export type SymmetricArc = {
  radius: number;
  startAngle: number;
  endAngle: number;
};
