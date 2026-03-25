import { isPoint, pointDistance, pointFrom } from "./point";
import { vector } from "./vector";

import type { Curve, GlobalPoint, LineSegment, LocalPoint } from "./types";

/**
 *
 * @param a
 * @param b
 * @param c
 * @param d
 * @returns
 */
export function curve<Point extends GlobalPoint | LocalPoint>(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
) {
  return [a, b, c, d] as Curve<Point>;
}

function solveWithAnalyticalJacobian<Point extends GlobalPoint | LocalPoint>(
  curve: Curve<Point>,
  lineSegment: LineSegment<Point>,
  t0: number,
  s0: number,
  tolerance: number = 1e-3,
  iterLimit: number = 10,
): number[] | null {
  let error = Infinity;
  let iter = 0;

  while (error >= tolerance) {
    if (iter >= iterLimit) {
      return null;
    }

    // Compute bezier point at parameter t0
    const bt = 1 - t0;
    const bt2 = bt * bt;
    const bt3 = bt2 * bt;
    const t0_2 = t0 * t0;
    const t0_3 = t0_2 * t0;

    const bezierX =
      bt3 * curve[0][0] +
      3 * bt2 * t0 * curve[1][0] +
      3 * bt * t0_2 * curve[2][0] +
      t0_3 * curve[3][0];
    const bezierY =
      bt3 * curve[0][1] +
      3 * bt2 * t0 * curve[1][1] +
      3 * bt * t0_2 * curve[2][1] +
      t0_3 * curve[3][1];

    // Compute line point at parameter s0
    const lineX =
      lineSegment[0][0] + s0 * (lineSegment[1][0] - lineSegment[0][0]);
    const lineY =
      lineSegment[0][1] + s0 * (lineSegment[1][1] - lineSegment[0][1]);

    // Function values
    const fx = bezierX - lineX;
    const fy = bezierY - lineY;

    error = Math.abs(fx) + Math.abs(fy);

    if (error < tolerance) {
      break;
    }

    // Analytical derivatives
    const dfx_dt =
      -3 * bt2 * curve[0][0] +
      3 * bt2 * curve[1][0] -
      6 * bt * t0 * curve[1][0] -
      3 * t0_2 * curve[2][0] +
      6 * bt * t0 * curve[2][0] +
      3 * t0_2 * curve[3][0];

    const dfy_dt =
      -3 * bt2 * curve[0][1] +
      3 * bt2 * curve[1][1] -
      6 * bt * t0 * curve[1][1] -
      3 * t0_2 * curve[2][1] +
      6 * bt * t0 * curve[2][1] +
      3 * t0_2 * curve[3][1];

    // Line derivatives
    const dfx_ds = -(lineSegment[1][0] - lineSegment[0][0]);
    const dfy_ds = -(lineSegment[1][1] - lineSegment[0][1]);

    // Jacobian determinant
    const det = dfx_dt * dfy_ds - dfx_ds * dfy_dt;

    if (Math.abs(det) < 1e-12) {
      return null;
    }

    // Newton step
    const invDet = 1 / det;
    const dt = invDet * (dfy_ds * -fx - dfx_ds * -fy);
    const ds = invDet * (-dfy_dt * -fx + dfx_dt * -fy);

    t0 += dt;
    s0 += ds;
    iter += 1;
  }

  return [t0, s0];
}

export const bezierEquation = <Point extends GlobalPoint | LocalPoint>(
  c: Curve<Point>,
  t: number,
) =>
  pointFrom<Point>(
    (1 - t) ** 3 * c[0][0] +
      3 * (1 - t) ** 2 * t * c[1][0] +
      3 * (1 - t) * t ** 2 * c[2][0] +
      t ** 3 * c[3][0],
    (1 - t) ** 3 * c[0][1] +
      3 * (1 - t) ** 2 * t * c[1][1] +
      3 * (1 - t) * t ** 2 * c[2][1] +
      t ** 3 * c[3][1],
  );

const initial_guesses: [number, number][] = [
  [0.5, 0],
  [0.2, 0],
  [0.8, 0],
];

const calculate = <Point extends GlobalPoint | LocalPoint>(
  [t0, s0]: [number, number],
  l: LineSegment<Point>,
  c: Curve<Point>,
) => {
  const solution = solveWithAnalyticalJacobian(c, l, t0, s0, 1e-2, 4);

  if (!solution) {
    return null;
  }

  const [t, s] = solution;

  if (t < 0 || t > 1 || s < 0 || s > 1) {
    return null;
  }

  return bezierEquation(c, t);
};

/**
 * Computes the intersection between a cubic spline and a line segment.
 */
export function curveIntersectLineSegment<
  Point extends GlobalPoint | LocalPoint,
>(c: Curve<Point>, l: LineSegment<Point>): Point[] {
  let solution = calculate(initial_guesses[0], l, c);
  if (solution) {
    return [solution];
  }

  solution = calculate(initial_guesses[1], l, c);
  if (solution) {
    return [solution];
  }

  solution = calculate(initial_guesses[2], l, c);
  if (solution) {
    return [solution];
  }

  return [];
}

/**
 * Finds the closest point on the Bezier curve from another point
 *
 * @param x
 * @param y
 * @param P0
 * @param P1
 * @param P2
 * @param P3
 * @param tolerance
 * @param maxLevel
 * @returns
 */
export function curveClosestPoint<Point extends GlobalPoint | LocalPoint>(
  c: Curve<Point>,
  p: Point,
  tolerance: number = 1e-3,
): Point | null {
  const localMinimum = (
    min: number,
    max: number,
    f: (t: number) => number,
    e: number = tolerance,
  ) => {
    let m = min;
    let n = max;
    let k;

    while (n - m > e) {
      k = (n + m) / 2;
      if (f(k - e) < f(k + e)) {
        n = k;
      } else {
        m = k;
      }
    }

    return k;
  };

  const maxSteps = 30;
  let closestStep = 0;
  for (let min = Infinity, step = 0; step < maxSteps; step++) {
    const d = pointDistance(p, bezierEquation(c, step / maxSteps));
    if (d < min) {
      min = d;
      closestStep = step;
    }
  }

  const t0 = Math.max((closestStep - 1) / maxSteps, 0);
  const t1 = Math.min((closestStep + 1) / maxSteps, 1);
  const solution = localMinimum(t0, t1, (t) =>
    pointDistance(p, bezierEquation(c, t)),
  );

  if (!solution) {
    return null;
  }

  return bezierEquation(c, solution);
}

/**
 * Determines the distance between a point and the closest point on the
 * Bezier curve.
 *
 * @param c The curve to test
 * @param p The point to measure from
 */
export function curvePointDistance<Point extends GlobalPoint | LocalPoint>(
  c: Curve<Point>,
  p: Point,
) {
  const closest = curveClosestPoint(c, p);

  if (!closest) {
    return 0;
  }

  return pointDistance(p, closest);
}

/**
 * Determines if the parameter is a Curve
 */
export function isCurve<P extends GlobalPoint | LocalPoint>(
  v: unknown,
): v is Curve<P> {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    isPoint(v[0]) &&
    isPoint(v[1]) &&
    isPoint(v[2]) &&
    isPoint(v[3])
  );
}


