import type { GlobalPoint, Line, LocalPoint } from "./types";

/**
 * Create a line from two points.
 *
 * @param points The two points lying on the line
 * @returns The line on which the points lie
 */
export function createLine<P extends GlobalPoint | LocalPoint>([a, b]: [
  P,
  P,
]): Line<P> {
  "inline";
  return [a, b] as Line<P>;
}
