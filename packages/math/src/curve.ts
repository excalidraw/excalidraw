import { isPoint, pointDistance, pointFrom, pointFromVector } from "./point";
import { vector, vectorNormal, vectorNormalize, vectorScale } from "./vector";
import { LegendreGaussN24CValues, LegendreGaussN24TValues } from "./constants";

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

/**
 * Computes the intersection between a cubic spline and a line segment.
 */
export function curveIntersectLineSegment<
  Point extends GlobalPoint | LocalPoint,
>(c: Curve<Point>, l: LineSegment<Point>): Point[] {
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

export function curveTangent<Point extends GlobalPoint | LocalPoint>(
  [p0, p1, p2, p3]: Curve<Point>,
  t: number,
) {
  return vector(
    -3 * (1 - t) * (1 - t) * p0[0] +
      3 * (1 - t) * (1 - t) * p1[0] -
      6 * t * (1 - t) * p1[0] -
      3 * t * t * p2[0] +
      6 * t * (1 - t) * p2[0] +
      3 * t * t * p3[0],
    -3 * (1 - t) * (1 - t) * p0[1] +
      3 * (1 - t) * (1 - t) * p1[1] -
      6 * t * (1 - t) * p1[1] -
      3 * t * t * p2[1] +
      6 * t * (1 - t) * p2[1] +
      3 * t * t * p3[1],
  );
}

export function curveCatmullRomQuadraticApproxPoints(
  points: GlobalPoint[],
  tension = 0.5,
) {
  if (points.length < 2) {
    return;
  }

  const pointSets: [GlobalPoint, GlobalPoint][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1 < 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1 >= points.length ? points.length - 1 : i + 1];
    const cpX = p1[0] + ((p2[0] - p0[0]) * tension) / 2;
    const cpY = p1[1] + ((p2[1] - p0[1]) * tension) / 2;

    pointSets.push([
      pointFrom<GlobalPoint>(cpX, cpY),
      pointFrom<GlobalPoint>(p2[0], p2[1]),
    ]);
  }

  return pointSets;
}

export function curveCatmullRomCubicApproxPoints<
  Point extends GlobalPoint | LocalPoint,
>(points: Point[], tension = 0.5) {
  if (points.length < 2) {
    return;
  }

  const pointSets: Curve<Point>[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1 < 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1 >= points.length ? points.length - 1 : i + 1];
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];
    const tangent1 = [(p2[0] - p0[0]) * tension, (p2[1] - p0[1]) * tension];
    const tangent2 = [(p3[0] - p1[0]) * tension, (p3[1] - p1[1]) * tension];
    const cp1x = p1[0] + tangent1[0] / 3;
    const cp1y = p1[1] + tangent1[1] / 3;
    const cp2x = p2[0] - tangent2[0] / 3;
    const cp2y = p2[1] - tangent2[1] / 3;

    pointSets.push(
      curve(
        pointFrom(p1[0], p1[1]),
        pointFrom(cp1x, cp1y),
        pointFrom(cp2x, cp2y),
        pointFrom(p2[0], p2[1]),
      ),
    );
  }

  return pointSets;
}

export function curveOffsetPoints(
  [p0, p1, p2, p3]: Curve<GlobalPoint>,
  offset: number,
  steps = 50,
) {
  const offsetPoints = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = curve(p0, p1, p2, p3);
    const point = bezierEquation(c, t);
    const tangent = vectorNormalize(curveTangent(c, t));
    const normal = vectorNormal(tangent);

    offsetPoints.push(pointFromVector(vectorScale(normal, offset), point));
  }

  return offsetPoints;
}

export function offsetPointsForQuadraticBezier(
  p0: GlobalPoint,
  p1: GlobalPoint,
  p2: GlobalPoint,
  offsetDist: number,
  steps = 50,
) {
  const offsetPoints = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const t1 = 1 - t;
    const point = pointFrom<GlobalPoint>(
      t1 * t1 * p0[0] + 2 * t1 * t * p1[0] + t * t * p2[0],
      t1 * t1 * p0[1] + 2 * t1 * t * p1[1] + t * t * p2[1],
    );
    const tangentX = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const tangentY = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const tangent = vectorNormalize(vector(tangentX, tangentY));
    const normal = vectorNormal(tangent);

    offsetPoints.push(pointFromVector(vectorScale(normal, offsetDist), point));
  }

  return offsetPoints;
}

/**
 * Implementation based on Legendre-Gauss quadrature for more accurate arc
 * length calculation.
 *
 * Reference: https://pomax.github.io/bezierinfo/#arclength
 *
 * @param c The curve to calculate the length of
 * @returns The approximated length of the curve
 */
export function curveLength<P extends GlobalPoint | LocalPoint>(
  c: Curve<P>,
): number {
  const z2 = 0.5;
  let sum = 0;

  for (let i = 0; i < 24; i++) {
    const t = z2 * LegendreGaussN24TValues[i] + z2;
    const derivativeVector = curveTangent(c, t);
    const magnitude = Math.sqrt(
      derivativeVector[0] * derivativeVector[0] +
        derivativeVector[1] * derivativeVector[1],
    );
    sum += LegendreGaussN24CValues[i] * magnitude;
  }

  return z2 * sum;
}

/**
 * Calculates the curve length from t=0 to t=parameter using the same
 * Legendre-Gauss quadrature method used in curveLength
 *
 * @param c The curve to calculate the partial length for
 * @param t The parameter value (0 to 1) to calculate length up to
 * @returns The length of the curve from beginning to parameter t
 */
export function curveLengthAtParameter<P extends GlobalPoint | LocalPoint>(
  c: Curve<P>,
  t: number,
): number {
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return curveLength(c);
  }

  // Scale and shift the integration interval from [0,t] to [-1,1]
  // which is what the Legendre-Gauss quadrature expects
  const z1 = t / 2;
  const z2 = t / 2;

  let sum = 0;

  for (let i = 0; i < 24; i++) {
    const parameter = z1 * LegendreGaussN24TValues[i] + z2;
    const derivativeVector = curveTangent(c, parameter);
    const magnitude = Math.sqrt(
      derivativeVector[0] * derivativeVector[0] +
        derivativeVector[1] * derivativeVector[1],
    );
    sum += LegendreGaussN24CValues[i] * magnitude;
  }

  return z1 * sum; // Scale the result back to the original interval
}

/**
 * Calculates the point at a specific percentage of a curve's total length
 * using binary search for improved efficiency and accuracy.
 *
 * @param c The curve to calculate point on
 * @param percent A value between 0 and 1 representing the percentage of the curve's length
 * @returns The point at the specified percentage of curve length
 */
export function curvePointAtLength<P extends GlobalPoint | LocalPoint>(
  c: Curve<P>,
  percent: number,
): P {
  if (percent <= 0) {
    return bezierEquation(c, 0);
  }

  if (percent >= 1) {
    return bezierEquation(c, 1);
  }

  const totalLength = curveLength(c);
  const targetLength = totalLength * percent;

  // Binary search to find parameter t where length at t equals target length
  let tMin = 0;
  let tMax = 1;
  let t = percent; // Start with a reasonable guess (t = percent)
  let currentLength = 0;

  // Tolerance for length comparison and iteration limit to avoid infinite loops
  const tolerance = totalLength * 0.0001;
  const maxIterations = 20;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    currentLength = curveLengthAtParameter(c, t);
    const error = Math.abs(currentLength - targetLength);

    if (error < tolerance) {
      break;
    }

    if (currentLength < targetLength) {
      tMin = t;
    } else {
      tMax = t;
    }

    t = (tMin + tMax) / 2;
  }

  return bezierEquation(c, t);
}
