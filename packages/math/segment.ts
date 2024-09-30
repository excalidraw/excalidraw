import { lineIntersectsSegment } from "./line";
import {
  isPoint,
  pointCenter,
  pointFromVector,
  pointRotateRads,
  pointsEqual,
} from "./point";
import type { GenericPoint, Segment, Radians, Line } from "./types";
import { PRECISION } from "./utils";
import {
  vectorAdd,
  vectorCross,
  vectorFromPoint,
  vectorScale,
  vectorSubtract,
} from "./vector";

/**
 * Create a line segment from two points.
 *
 * @param points The two points delimiting the line segment on each end
 * @returns The line segment delineated by the points
 */
export function segment<P extends GenericPoint>(a: P, b: P): Segment<P> {
  if (pointsEqual(a, b)) {
    console.warn("The start and end points of the segment cannot match");
  }

  return [a, b] as Segment<P>;
}

export function segmentFromPointArray<P extends GenericPoint>(
  pointArray: P[],
): Segment<P> | undefined {
  return pointArray.length === 2
    ? segment<P>(pointArray[0], pointArray[1])
    : undefined;
}

/**
 * Determines if the provided value is a segment
 *
 * @param value The candidate
 * @returns Returns TRUE if the provided value is a segment
 */
export function isSegment<Point extends GenericPoint>(
  value: unknown,
): value is Segment<Point> {
  return (
    Array.isArray(value) &&
    segment.length === 2 &&
    isPoint(value[0]) &&
    isPoint(value[0])
  );
}

/**
 * Return the coordinates resulting from rotating the given line about an origin by an angle in radians
 * note that when the origin is not given, the midpoint of the given line is used as the origin.
 *
 * @param l
 * @param angle
 * @param origin
 * @returns
 */
export function segmentRotate<Point extends GenericPoint>(
  l: Segment<Point>,
  angle: Radians,
  origin?: Point,
): Segment<Point> {
  return segment(
    pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle),
    pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle),
  );
}

/**
 * Calculates the point two line segments with a definite start and end point
 * intersect at.
 */
export function segmentsIntersectAt<Point extends GenericPoint>(
  a: Readonly<Segment<Point>>,
  b: Readonly<Segment<Point>>,
): Point | null {
  const a0 = vectorFromPoint(a[0]);
  const a1 = vectorFromPoint(a[1]);
  const b0 = vectorFromPoint(b[0]);
  const b1 = vectorFromPoint(b[1]);
  const r = vectorSubtract(a1, a0);
  const s = vectorSubtract(b1, b0);
  const denominator = vectorCross(r, s);

  if (denominator === 0) {
    return null;
  }

  const i = vectorSubtract(vectorFromPoint(b[0]), vectorFromPoint(a[0]));
  const u = vectorCross(i, r) / denominator;
  const t = vectorCross(i, s) / denominator;

  if (u === 0) {
    return null;
  }

  const p = vectorAdd(a0, vectorScale(r, t));

  if (t >= 0 && t < 1 && u >= 0 && u < 1) {
    return pointFromVector<Point>(p);
  }

  return null;
}

/**
 * Determnines if a point lies on a segment
 *
 * @param point
 * @param s
 * @param threshold
 * @returns
 */
export function segmentIncludesPoint<Point extends GenericPoint>(
  point: Point,
  s: Segment<Point>,
  threshold = PRECISION,
) {
  const distance = segmentDistanceToPoint(point, s);

  if (distance === 0) {
    return true;
  }

  return distance < threshold;
}

/**
 * Returns the shortest distance from a point to a segment.
 *
 * @param p
 * @param s
 * @returns
 */
export function segmentDistanceToPoint<Point extends GenericPoint>(
  p: Point,
  s: Segment<Point>,
): number {
  const [x, y] = p;
  const [[x1, y1], [x2, y2]] = s;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) {
    param = dot / len_sq;
  }

  let xx;
  let yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns the intersection point between a segment and a line, if any
 *
 * @param s
 * @param l
 * @returns
 */
export function segmentIntersectsLine<Point extends GenericPoint>(
  s: Segment<Point>,
  l: Line<Point>,
): Point | null {
  return lineIntersectsSegment(l, s);
}
