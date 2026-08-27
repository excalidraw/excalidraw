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
  tolerance: number = 1e-2,
  iterLimit: number = 4,
) => {
  const solution = solveWithAnalyticalJacobian(
    c,
    l,
    t0,
    s0,
    tolerance,
    iterLimit,
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

/**
 * Computes the intersection between a cubic spline and a line segment.
 */
export function curveIntersectLineSegment<
  Point extends GlobalPoint | LocalPoint,
>(
  c: Curve<Point>,
  l: LineSegment<Point>,
  opts?: {
    tolerance?: number;
    iterLimit?: number;
  },
): Point[] {
  let solution = calculate(
    initial_guesses[0],
    l,
    c,
    opts?.tolerance,
    opts?.iterLimit,
  );
  if (solution) {
    return [solution];
  }

  solution = calculate(
    initial_guesses[1],
    l,
    c,
    opts?.tolerance,
    opts?.iterLimit,
  );
  if (solution) {
    return [solution];
  }

  solution = calculate(
    initial_guesses[2],
    l,
    c,
    opts?.tolerance,
    opts?.iterLimit,
  );
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

  // `solution` is only nullish when the search window is narrower than the
  // tolerance (e.g. a caller-supplied tolerance larger than the window). A
  // legitimate solution of `t = 0` must not be treated as a failure.
  if (solution == null) {
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

  // No closest point found: report an "infinitely far" distance so this curve
  // is never mistaken for the nearest component when fed into `Math.min`.
  if (!closest) {
    return Infinity;
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

/**
 * Fits a chord-length parameterised C2 natural cubic spline through `points`
 * and returns one cubic Bézier segment per point pair, so the whole polyline
 * renders as a single smooth curve that interpolates every point.
 *
 * The tangents `m[0..n]` at each knot are solved from a tridiagonal system
 * (Thomas's algorithm) using the chord lengths `h[i] = |Kᵢ₊₁ − Kᵢ|` as the
 * parameter intervals, so tightly-spaced knots don't over-influence distant
 * ones. Bézier handles follow from the Hermite→Bézier identity:
 *   cp1ᵢ = Kᵢ   + mᵢ   · h[i] / 3
 *   cp2ᵢ = Kᵢ₊₁ − mᵢ₊₁ · h[i] / 3
 *
 * @param chordPower controls how handle length scales with chord length. At 1
 *   handles are exactly h/3 (standard Hermite); values below 1 make short
 *   segments curvier and long segments more taut (sub-linear scaling).
 * @param angleCorrection in [0, 1] pulls the tangent at each interior knot
 *   toward the chord bisector direction (`normalize(d1 + d2)`), linearly with
 *   turn sharpness. 0 = pure C2 spline; 1 = tangent fully aligned with the
 *   bisector. Both handles at a knot share the adjusted direction, so they
 *   stay collinear (G1 continuity is preserved).
 */
export function curveChordC2Spline<Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
  chordPower = 1,
  angleCorrection = 1,
): Curve<Point>[] {
  const n = points.length - 1; // number of segments
  if (n < 1) {
    return [];
  }

  const h = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    h[i] = Math.max(
      1e-10,
      Math.hypot(
        points[i + 1][0] - points[i][0],
        points[i + 1][1] - points[i][1],
      ),
    );
  }

  const mx = new Float64Array(n + 1);
  const my = new Float64Array(n + 1);
  const diag = new Float64Array(n + 1);
  const rhsX = new Float64Array(n + 1);
  const rhsY = new Float64Array(n + 1);

  // Row 0 – natural BC (zero second derivative at start)
  diag[0] = 2;
  rhsX[0] = (3 * (points[1][0] - points[0][0])) / h[0];
  rhsY[0] = (3 * (points[1][1] - points[0][1])) / h[0];

  // Interior rows
  for (let i = 1; i < n; i++) {
    diag[i] = 2 * (h[i - 1] + h[i]);
    rhsX[i] =
      3 *
      ((h[i] * (points[i][0] - points[i - 1][0])) / h[i - 1] +
        (h[i - 1] * (points[i + 1][0] - points[i][0])) / h[i]);
    rhsY[i] =
      3 *
      ((h[i] * (points[i][1] - points[i - 1][1])) / h[i - 1] +
        (h[i - 1] * (points[i + 1][1] - points[i][1])) / h[i]);
  }

  // Row n – natural BC (zero second derivative at end)
  diag[n] = 2;
  rhsX[n] = (3 * (points[n][0] - points[n - 1][0])) / h[n - 1];
  rhsY[n] = (3 * (points[n][1] - points[n - 1][1])) / h[n - 1];

  // Forward sweep
  for (let i = 1; i <= n; i++) {
    const sub = i < n ? h[i] : 1;
    const supPrev = i === 1 ? 1 : h[i - 2];
    const w = sub / diag[i - 1];
    diag[i] -= w * supPrev;
    rhsX[i] -= w * rhsX[i - 1];
    rhsY[i] -= w * rhsY[i - 1];
  }

  // Back substitution
  mx[n] = rhsX[n] / diag[n];
  my[n] = rhsY[n] / diag[n];
  for (let i = n - 1; i >= 0; i--) {
    const sup = i === 0 ? 1 : h[i - 1];
    mx[i] = (rhsX[i] - sup * mx[i + 1]) / diag[i];
    my[i] = (rhsY[i] - sup * my[i + 1]) / diag[i];
  }

  // Normalised tangent directions.
  const mlen = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    mlen[i] = Math.max(1e-10, Math.hypot(mx[i], my[i]));
  }

  // At interior knots, blend the C2 tangent direction toward the chord
  // bisector direction by a factor proportional to turn sharpness.
  for (let k = 1; k < n; k++) {
    const d1x = (points[k][0] - points[k - 1][0]) / h[k - 1];
    const d1y = (points[k][1] - points[k - 1][1]) / h[k - 1];
    const d2x = (points[k + 1][0] - points[k][0]) / h[k];
    const d2y = (points[k + 1][1] - points[k][1]) / h[k];
    const dot = d1x * d2x + d1y * d2y;
    // t: 0 = straight, 1 = hairpin
    const t = ((1 - dot) / 2) * angleCorrection;
    if (t < 1e-6) {
      continue;
    }
    // Bisector of the two chord directions: the natural symmetric tangent.
    const bx = d1x + d2x;
    const by = d1y + d2y;
    const blen = Math.hypot(bx, by);
    if (blen < 1e-10) {
      continue; // 180° hairpin – bisector undefined, skip
    }
    let px = bx / blen;
    let py = by / blen;
    const tx = mx[k] / mlen[k];
    const ty = my[k] / mlen[k];
    if (tx * px + ty * py < 0) {
      px = -px;
      py = -py;
    }
    // Linear blend of unit directions, then renormalize to preserve magnitude.
    const blendX = tx + t * (px - tx);
    const blendY = ty + t * (py - ty);
    const blendLen = Math.max(1e-10, Math.hypot(blendX, blendY));
    mx[k] = (blendX / blendLen) * mlen[k];
    my[k] = (blendY / blendLen) * mlen[k];
  }

  const curves: Curve<Point>[] = [];
  for (let i = 0; i < n; i++) {
    const cpDist = Math.pow(h[i], chordPower) / 3;
    curves.push(
      curve(
        pointFrom<Point>(points[i][0], points[i][1]),
        pointFrom<Point>(
          points[i][0] + (mx[i] / mlen[i]) * cpDist,
          points[i][1] + (my[i] / mlen[i]) * cpDist,
        ),
        pointFrom<Point>(
          points[i + 1][0] - (mx[i + 1] / mlen[i + 1]) * cpDist,
          points[i + 1][1] - (my[i + 1] / mlen[i + 1]) * cpDist,
        ),
        pointFrom<Point>(points[i + 1][0], points[i + 1][1]),
      ),
    );
  }

  return curves;
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
