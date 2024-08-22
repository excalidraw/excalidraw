import type { Curve, GlobalPoint, LocalPoint } from "./types";

export function curve<Point extends GlobalPoint | LocalPoint>(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
) {
  "inline";
  return [a, b, c, d] as Curve<Point>;
}
