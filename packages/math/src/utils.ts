import { type Bounds } from "@excalidraw/element";
import { perpendicularDistance } from "./point";
import type { LocalPoint } from "./types";

export const PRECISION = 10e-5;

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const round = (
  value: number,
  precision: number,
  func: "round" | "floor" | "ceil" = "round",
) => {
  const multiplier = Math.pow(10, precision);

  return Math[func]((value + Number.EPSILON) * multiplier) / multiplier;
};

export const roundToStep = (
  value: number,
  step: number,
  func: "round" | "floor" | "ceil" = "round",
): number => {
  const factor = 1 / step;
  return Math[func](value * factor) / factor;
};

export const average = (a: number, b: number) => (a + b) / 2;

export const isFiniteNumber = (value: any): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export const isCloseTo = (a: number, b: number, precision = PRECISION) =>
  Math.abs(a - b) < precision;

export const doBoundsIntersect = (
  bounds1: Bounds | null,
  bounds2: Bounds | null,
): boolean => {
  if (bounds1 == null || bounds2 == null) {
    return false;
  }

  const [minX1, minY1, maxX1, maxY1] = bounds1;
  const [minX2, minY2, maxX2, maxY2] = bounds2;

  return minX1 < maxX2 && maxX1 > minX2 && minY1 < maxY2 && maxY1 > minY2;
};
/**
 * Simplify a polyline using Ramer-Douglas-Peucker algorithm.
 */
export function simplifyRDP(
  points: readonly LocalPoint[],
  epsilon: number): readonly LocalPoint[] {
  if (points.length < 3) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  let index = -1;
  let maxDist = 0;

  // Find the point with the maximum distance from the line segment between first and last
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon && index !== -1) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    // Concatenate results (omit duplicate point at junction)
    return left.slice(0, -1).concat(right);
  }
  // Not enough deviation, return straight line segment (keep only endpoints)
  return [first, last];
}
