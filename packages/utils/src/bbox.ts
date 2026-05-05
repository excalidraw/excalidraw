import {
  vectorCross,
  vectorFromPoint,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";

export type LineSegment<P extends LocalPoint | GlobalPoint> = [P, P];

export function getBBox<P extends LocalPoint | GlobalPoint>(
  line: LineSegment<P>,
): Bounds {
  return [
    Math.min(line[0][0], line[1][0]),
    Math.min(line[0][1], line[1][1]),
    Math.max(line[0][0], line[1][0]),
    Math.max(line[0][1], line[1][1]),
  ];
}

export function doBBoxesIntersect(a: Bounds, b: Bounds) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

const EPSILON = 0.000001;

export function isPointOnLine<P extends GlobalPoint | LocalPoint>(
  l: LineSegment<P>,
  p: P,
) {
  const p1 = vectorFromPoint(l[1], l[0]);
  const p2 = vectorFromPoint(p, l[0]);

  const r = vectorCross(p1, p2);

  return Math.abs(r) < EPSILON;
}

export function isPointRightOfLine<P extends GlobalPoint | LocalPoint>(
  l: LineSegment<P>,
  p: P,
) {
  const p1 = vectorFromPoint(l[1], l[0]);
  const p2 = vectorFromPoint(p, l[0]);

  return vectorCross(p1, p2) < 0;
}

export function isLineSegmentTouchingOrCrossingLine<
  P extends GlobalPoint | LocalPoint,
>(a: LineSegment<P>, b: LineSegment<P>) {
  return (
    isPointOnLine(a, b[0]) ||
    isPointOnLine(a, b[1]) ||
    (isPointRightOfLine(a, b[0])
      ? !isPointRightOfLine(a, b[1])
      : isPointRightOfLine(a, b[1]))
  );
}

// https://martin-thoma.com/how-to-check-if-two-line-segments-intersect/
export function doLineSegmentsIntersect<P extends GlobalPoint | LocalPoint>(
  a: LineSegment<P>,
  b: LineSegment<P>,
) {
  return (
    doBBoxesIntersect(getBBox(a), getBBox(b)) &&
    isLineSegmentTouchingOrCrossingLine(a, b) &&
    isLineSegmentTouchingOrCrossingLine(b, a)
  );
}

export function getIntersectionPoint<P extends [number, number]>(
  p1: P,
  p2: P,
  p3: P,
  p4: P,
): [number, number] | null {
  const x1 = p1[0],
    y1 = p1[1];
  const x2 = p2[0],
    y2 = p2[1];
  const x3 = p3[0],
    y3 = p3[1];
  const x4 = p4[0],
    y4 = p4[1];

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < 1e-6) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denom;
  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  }
  return null;
}
