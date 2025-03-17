import type { Bounds } from "@excalidraw/element/bounds";

import { isPoint, pointDistance, pointFrom } from "./point";
import { rectangle, rectangleIntersectLineSegment } from "./rectangle";

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

function gradient(
  f: (t: number, s: number) => number,
  t0: number,
  s0: number,
  delta: number = 1e-6,
): number[] {
  return [
    (f(t0 + delta, s0) - f(t0 - delta, s0)) / (2 * delta),
    (f(t0, s0 + delta) - f(t0, s0 - delta)) / (2 * delta),
  ];
}

function solve(
  f: (t: number, s: number) => [number, number],
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

    const y0 = f(t0, s0);
    const jacobian = [
      gradient((t, s) => f(t, s)[0], t0, s0),
      gradient((t, s) => f(t, s)[1], t0, s0),
    ];
    const b = [[-y0[0]], [-y0[1]]];
    const det =
      jacobian[0][0] * jacobian[1][1] - jacobian[0][1] * jacobian[1][0];

    if (det === 0) {
      return null;
    }

    const iJ = [
      [jacobian[1][1] / det, -jacobian[0][1] / det],
      [-jacobian[1][0] / det, jacobian[0][0] / det],
    ];
    const h = [
      [iJ[0][0] * b[0][0] + iJ[0][1] * b[1][0]],
      [iJ[1][0] * b[0][0] + iJ[1][1] * b[1][0]],
    ];

    t0 = t0 + h[0][0];
    s0 = s0 + h[1][0];

    const [tErr, sErr] = f(t0, s0);
    error = Math.max(Math.abs(tErr), Math.abs(sErr));
    iter += 1;
  }

  return [t0, s0];
}

const bezierEquation = <Point extends GlobalPoint | LocalPoint>(
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

/**
 * Computes the intersection between a cubic spline and a line segment.
 */
export function curveIntersectLineSegment<
  Point extends GlobalPoint | LocalPoint,
>(c: Curve<Point>, l: LineSegment<Point>): Point[] {
  // Optimize by doing a cheap bounding box check first
  const bounds = curveBounds(c);
  if (
    rectangleIntersectLineSegment(
      rectangle(
        pointFrom(bounds[0], bounds[1]),
        pointFrom(bounds[2], bounds[3]),
      ),
      l,
    ).length === 0
  ) {
    return [];
  }

  const line = (s: number) =>
    pointFrom<Point>(
      l[0][0] + s * (l[1][0] - l[0][0]),
      l[0][1] + s * (l[1][1] - l[0][1]),
    );

  const initial_guesses: [number, number][] = [
    [0.5, 0],
    [0.2, 0],
    [0.8, 0],
  ];

  const calculate = ([t0, s0]: [number, number]) => {
    const solution = solve(
      (t: number, s: number) => {
        const bezier_point = bezierEquation(c, t);
        const line_point = line(s);

        return [
          bezier_point[0] - line_point[0],
          bezier_point[1] - line_point[1],
        ];
      },
      t0,
      s0,
    );

    if (!solution) {
      return null;
    }

    const [t, s] = solution;

    if (t < 0 || t > 1 || s < 0 || s > 1) {
      return null;
    }

    return bezierEquation(c, t);
  };

  let solution = calculate(initial_guesses[0]);
  if (solution) {
    return [solution];
  }

  solution = calculate(initial_guesses[1]);
  if (solution) {
    return [solution];
  }

  solution = calculate(initial_guesses[2]);
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

function curveBounds<Point extends GlobalPoint | LocalPoint>(
  c: Curve<Point>,
): Bounds {
  const [P0, P1, P2, P3] = c;
  const x = [P0[0], P1[0], P2[0], P3[0]];
  const y = [P0[1], P1[1], P2[1], P3[1]];
  return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)];
}
