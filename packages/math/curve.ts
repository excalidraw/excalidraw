import { isPoint, pointRotateRads } from "./point";
import type { Curve, GenericPoint, Radians } from "./types";

/**
 *
 * @param a
 * @param b
 * @param c
 * @param d
 * @returns
 */
export function curve<Point extends GenericPoint>(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
) {
  return [start, control1, control2, end] as Curve<Point>;
}

export const curveRotate = <Point extends GenericPoint>(
  curve: Curve<Point>,
  angle: Radians,
  origin: Point,
) => {
  return curve.map((p) => pointRotateRads(p, origin, angle));
};

export const isCurve = <Point extends GenericPoint>(
  c: unknown,
): c is Curve<Point> => {
  return (
    c != null &&
    Array.isArray(c) &&
    c.length === 4 &&
    isPoint((c as Curve<Point>)[0]) &&
    isPoint((c as Curve<Point>)[1]) &&
    isPoint((c as Curve<Point>)[2]) &&
    isPoint((c as Curve<Point>)[3])
  );
};
