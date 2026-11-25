/**
 * The outlines elbow arrows are routed around (see `elbowArrowTemplates.ts`):
 * each element's as a convex polygon (a rectangle's corners, a diamond's, or
 * an ellipse's, closely around it, ignoring any rounding of their corners),
 * and how far one reaches toward a side over a span across that side, which
 * is how far a segment over that span has to stay away from it.
 *
 * Over a span past the outline's own extent across, it reaches as far as it
 * does at its own end nearest the span, so how far it reaches only ever
 * changes continuously as the span or the outline moves.
 */

import { clamp } from "@excalidraw/math";

import type { Point } from "./elbowArrowFrame";

/** A side of an outline: left, right, top or bottom (with y down) */
export type Side = "l" | "r" | "t" | "b";

/** How many corners an ellipse's outline has (a multiple of 4) */
const ELLIPSE_CORNERS = 24;

/**
 * The outline of a rectangle, a diamond or an ellipse with its middle at
 * `cx`, `cy`, half as wide as `hw` and half as high as `hh` (before it's
 * turned by `angle` about its middle, clockwise, with y down): an ellipse's
 * just around it, with sides touching it at its sides
 */
export const shapeOutline = (
  shape: "rectangle" | "diamond" | "ellipse",
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  angle: number,
): Point[] => {
  let points: Point[];
  if (shape === "diamond") {
    points = [
      [cx, cy - hh],
      [cx + hw, cy],
      [cx, cy + hh],
      [cx - hw, cy],
    ];
  } else if (shape === "ellipse") {
    const out = 1 / Math.cos(Math.PI / ELLIPSE_CORNERS);
    points = Array.from({ length: ELLIPSE_CORNERS }, (_, i) => {
      const t = ((2 * i + 1) * Math.PI) / ELLIPSE_CORNERS;
      return [cx + hw * out * Math.cos(t), cy + hh * out * Math.sin(t)];
    });
  } else {
    points = [
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ];
  }
  if (!angle) {
    return points;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(([x, y]) => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ]);
};

/** The part of a convex polygon on the side of a line where `n·p <= k` */
const clipToHalfPlane = (
  polygon: readonly Point[],
  [nx, ny]: Point,
  k: number,
): Point[] => {
  const clipped: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const dp = nx * p[0] + ny * p[1] - k;
    const dq = nx * q[0] + ny * q[1] - k;
    if (dp <= 0) {
      clipped.push(p);
    }
    if (dp * dq < 0) {
      const t = dp / (dp - dq);
      clipped.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return clipped;
};

/**
 * A convex outline grown by `distance` all around: its sides moved out by
 * that much, and its corners cut off that far out, square with the axes
 * (rather than rounded), as far as its bounds grown by that much go
 */
export const growOutline = (
  outline: readonly Point[],
  distance: number,
): Point[] => {
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const l = Math.min(...xs) - distance;
  const t = Math.min(...ys) - distance;
  const r = Math.max(...xs) + distance;
  const b = Math.max(...ys) + distance;
  let grown: Point[] = [
    [l, t],
    [r, t],
    [r, b],
    [l, b],
  ];
  if (outline.length < 3) {
    return grown;
  }
  const cx = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const cy = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % outline.length];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length < 1e-9) {
      continue;
    }
    // (the side's normal, pointing out of the outline)
    let nx = (q[1] - p[1]) / length;
    let ny = -(q[0] - p[0]) / length;
    if (nx * (cx - p[0]) + ny * (cy - p[1]) > 0) {
      nx = -nx;
      ny = -ny;
    }
    grown = clipToHalfPlane(grown, [nx, ny], nx * p[0] + ny * p[1] + distance);
  }
  return grown;
};

/**
 * How far a convex outline reaches toward `side` (the furthest left, right,
 * up or down it is) over the span from `from` to `to` across that side
 * (along x for the top and the bottom, along y for the left and the right)
 */
export const reach = (
  outline: readonly Point[],
  side: Side,
  from: number,
  to: number,
): number => {
  const value = side === "t" || side === "b" ? 1 : 0;
  const across = 1 - value;
  const toward = side === "t" || side === "l" ? -1 : 1;
  let lo = Infinity;
  let hi = -Infinity;
  for (const point of outline) {
    lo = Math.min(lo, point[across]);
    hi = Math.max(hi, point[across]);
  }
  const s1 = clamp(Math.min(from, to), lo, hi);
  const s2 = clamp(Math.max(from, to), lo, hi);
  let furthest = -Infinity;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % outline.length];
    if (p[across] >= s1 && p[across] <= s2) {
      furthest = Math.max(furthest, toward * p[value]);
    }
    // (where a side of it crosses either end of the span)
    for (const s of s1 === s2 ? [s1] : [s1, s2]) {
      if ((p[across] - s) * (q[across] - s) < 0) {
        const t = (s - p[across]) / (q[across] - p[across]);
        furthest = Math.max(
          furthest,
          toward * (p[value] + t * (q[value] - p[value])),
        );
      }
    }
  }
  return toward * furthest;
};

/**
 * Whether an axis-aligned segment from `p` to `q` runs through the inside
 * of a convex outline (touching it doesn't count)
 */
export const runsThrough = (
  outline: readonly Point[],
  [x1, y1]: Point,
  [x2, y2]: Point,
): boolean => {
  if (outline.length < 3) {
    return false;
  }
  const horizontal = y1 === y2;
  const [at, from, to] = horizontal
    ? [y1, Math.min(x1, x2), Math.max(x1, x2)]
    : [x1, Math.min(y1, y2), Math.max(y1, y2)];
  const [lo, hi, before, after]: Side[] = horizontal
    ? ["t", "b", "l", "r"]
    : ["l", "r", "t", "b"];
  if (
    !(at > reach(outline, lo, -Infinity, Infinity)) ||
    !(at < reach(outline, hi, -Infinity, Infinity))
  ) {
    return false;
  }
  return (
    from < reach(outline, after, at, at) && to > reach(outline, before, at, at)
  );
};
