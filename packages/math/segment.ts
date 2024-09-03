import {
  isPoint,
  pointCenter,
  pointFromVector,
  pointRotateRads,
} from "./point";
import type { GlobalPoint, LineSegment, LocalPoint, Radians } from "./types";
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
export function lineSegment<P extends GlobalPoint | LocalPoint>(
  a: P,
  b: P,
): LineSegment<P> {
  return [a, b] as LineSegment<P>;
}

export function lineSegmentFromPointArray<P extends GlobalPoint | LocalPoint>(
  pointArray: P[],
): LineSegment<P> | undefined {
  return pointArray.length === 2
    ? lineSegment<P>(pointArray[0], pointArray[1])
    : undefined;
}

/**
 *
 * @param segment
 * @returns
 */
export const isLineSegment = <Point extends GlobalPoint | LocalPoint>(
  segment: unknown,
): segment is LineSegment<Point> =>
  Array.isArray(segment) &&
  segment.length === 2 &&
  isPoint(segment[0]) &&
  isPoint(segment[0]);

/**
 * Return the coordinates resulting from rotating the given line about an origin by an angle in radians
 * note that when the origin is not given, the midpoint of the given line is used as the origin.
 *
 * @param l
 * @param angle
 * @param origin
 * @returns
 */
export const lineSegmentRotate = <Point extends LocalPoint | GlobalPoint>(
  l: LineSegment<Point>,
  angle: Radians,
  origin?: Point,
): LineSegment<Point> => {
  return lineSegment(
    pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle),
    pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle),
  );
};

/**
 * Calculates the point two line segments with a definite start and end point
 * intersect at.
 */
export const segmentsIntersectAt = <Point extends GlobalPoint | LocalPoint>(
  a: Readonly<LineSegment<Point>>,
  b: Readonly<LineSegment<Point>>,
): Point | null => {
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
};

export const pointOnLineSegment = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  line: LineSegment<Point>,
  threshold = PRECISION,
) => {
  const distance = distanceToLineSegment(point, line);

  if (distance === 0) {
    return true;
  }

  return distance < threshold;
};

export const distanceToLineSegment = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  line: LineSegment<Point>,
) => {
  const [x, y] = point;
  const [[x1, y1], [x2, y2]] = line;

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
};
