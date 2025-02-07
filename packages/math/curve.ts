import type { Bounds } from "../excalidraw/element/bounds";
import { isPointOnLineSegment } from "./line";
import { isPoint, pointDistance, pointFrom } from "./point";
import {
  rectangle,
  rectangleIntersectLine,
  rectangleIntersectLineSegment,
} from "./rectangle";
import type {
  Curve,
  GlobalPoint,
  Line,
  LineSegment,
  LocalPoint,
} from "./types";

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

/*computes intersection between a cubic spline and a line segment*/
export function curveIntersectLine<Point extends GlobalPoint | LocalPoint>(
  c: Curve<Point>,
  l: Line<Point>,
): Point[] {
  const bounds = curveBounds(c);
  if (
    rectangleIntersectLine(
      rectangle(
        pointFrom(bounds[0], bounds[1]),
        pointFrom(bounds[2], bounds[3]),
      ),
      l,
    ).length === 0
  ) {
    return [];
  }

  const C1 = pointFrom<Point>(
    Math.round(c[0][0] * 1e4) / 1e4,
    Math.round(c[0][1] * 1e4) / 1e4,
  );
  const C2 = pointFrom<Point>(
    Math.round(c[1][0] * 1e4) / 1e4,
    Math.round(c[1][1] * 1e4) / 1e4,
  );
  const C3 = pointFrom<Point>(
    Math.round(c[2][0] * 1e4) / 1e4,
    Math.round(c[2][1] * 1e4) / 1e4,
  );
  const C4 = pointFrom<Point>(
    Math.round(c[3][0] * 1e4) / 1e4,
    Math.round(c[3][1] * 1e4) / 1e4,
  );
  const [px, py] = [
    [C1[0], C2[0], C3[0], C4[0]],
    [C1[1], C2[1], C3[1], C4[1]],
  ];
  const bx = bezierCoeffs(px[0], px[1], px[2], px[3]);
  const by = bezierCoeffs(py[0], py[1], py[2], py[3]);
  const r = curveCubicRoots([bx, by], l);
  const X = [];
  const intersections = [];
  // verify the roots are in bounds of the linear segment
  for (let i = 0; i < 3; i++) {
    const t = r[i];

    X[0] = bx[0] * t * t * t + bx[1] * t * t + bx[2] * t + bx[3];
    X[1] = by[0] * t * t * t + by[1] * t * t + by[2] * t + by[3];

    if (!isNaN(X[0]) && !isNaN(X[1])) {
      intersections.push(pointFrom(X[0], X[1]));
    }
  }

  return intersections;
}

export function curveIntersectLineSegment<
  Point extends GlobalPoint | LocalPoint,
>(c: Curve<Point>, l: LineSegment<Point>): Point[] {
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

  const C1 = pointFrom<Point>(
    Math.round(c[0][0] * 1e4) / 1e4,
    Math.round(c[0][1] * 1e4) / 1e4,
  );
  const C2 = pointFrom<Point>(
    Math.round(c[1][0] * 1e4) / 1e4,
    Math.round(c[1][1] * 1e4) / 1e4,
  );
  const C3 = pointFrom<Point>(
    Math.round(c[2][0] * 1e4) / 1e4,
    Math.round(c[2][1] * 1e4) / 1e4,
  );
  const C4 = pointFrom<Point>(
    Math.round(c[3][0] * 1e4) / 1e4,
    Math.round(c[3][1] * 1e4) / 1e4,
  );
  const [px, py] = [
    [C1[0], C2[0], C3[0], C4[0]],
    [C1[1], C2[1], C3[1], C4[1]],
  ];
  const bx = bezierCoeffs(px[0], px[1], px[2], px[3]);
  const by = bezierCoeffs(py[0], py[1], py[2], py[3]);

  const r = curveCubicRoots([bx, by], l);
  const X = [];
  const intersections: Point[] = [];
  // verify the roots are in bounds of the linear segment
  for (let i = 0; i < 3; i++) {
    const t = r[i];

    X[0] = bx[0] * t * t * t + bx[1] * t * t + bx[2] * t + bx[3];
    X[1] = by[0] * t * t * t + by[1] * t * t + by[2] * t + by[3];

    // Above is intersection point assuming infinitely long line segment,
    // make sure we are also in bounds of the line
    const candidate = pointFrom<Point>(X[0], X[1]);
    if (
      !isNaN(X[0]) &&
      !isNaN(X[1]) &&
      isPointOnLineSegment(l, candidate, 1e-2)
    ) {
      intersections.push(candidate);
    }
  }

  return intersections;
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
 * @param maxIterations
 * @returns
 */
export function curveClosestPoint<Point extends GlobalPoint | LocalPoint>(
  c: Curve<Point>,
  p: Point,
  tolerance: number = 1e-6,
  maxIterations: number = 100,
): Point {
  const [P0, P1, P2, P3] = c;
  let t = 0.5; // Initial guess for t
  for (let i = 0; i < maxIterations; i++) {
    const B = [
      (1 - t) ** 3 * P0[0] +
        3 * (1 - t) ** 2 * t * P1[0] +
        3 * (1 - t) * t ** 2 * P2[0] +
        t ** 3 * P3[0],
      (1 - t) ** 3 * P0[1] +
        3 * (1 - t) ** 2 * t * P1[1] +
        3 * (1 - t) * t ** 2 * P2[1] +
        t ** 3 * P3[1],
    ]; // Current point on the curve
    const dB = [
      3 * (1 - t) ** 2 * (P1[0] - P0[0]) +
        6 * (1 - t) * t * (P2[0] - P1[0]) +
        3 * t ** 2 * (P3[0] - P2[0]),
      3 * (1 - t) ** 2 * (P1[1] - P0[1]) +
        6 * (1 - t) * t * (P2[1] - P1[1]) +
        3 * t ** 2 * (P3[1] - P2[1]),
    ]; // Derivative at t

    // Compute f(t) and f'(t)
    const f = (p[0] - B[0]) * dB[0] + (p[1] - B[1]) * dB[1];
    const df =
      (-1 * dB[0]) ** 2 -
      dB[1] ** 2 +
      (p[0] - B[0]) *
        (-6 * (1 - t) * (P1[0] - P0[0]) +
          6 * (1 - 2 * t) * (P2[0] - P1[0]) +
          6 * t * (P3[0] - P2[0])) +
      (p[1] - B[1]) *
        (-6 * (1 - t) * (P1[1] - P0[1]) +
          6 * (1 - 2 * t) * (P2[1] - P1[1]) +
          6 * t * (P3[1] - P2[1]));

    // Check for convergence
    if (Math.abs(f) < tolerance) {
      break;
    }

    // Update t using Newton-Raphson
    t = t - f / df;

    // Clamp t to [0, 1] to stay within the curve segment
    t = Math.max(0, Math.min(1, t));
  }

  // Return the closest point on the curve
  return pointFrom(
    (1 - t) ** 3 * P0[0] +
      3 * (1 - t) ** 2 * t * P1[0] +
      3 * (1 - t) * t ** 2 * P2[0] +
      t ** 3 * P3[0],
    (1 - t) ** 3 * P0[1] +
      3 * (1 - t) ** 2 * t * P1[1] +
      3 * (1 - t) * t ** 2 * P2[1] +
      t ** 3 * P3[1],
  );
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
  return pointDistance(p, curveClosestPoint(c, p));
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

function curveCubicRoots<Point extends GlobalPoint | LocalPoint>(
  [bx, by]: [number[], number[]],
  l: [Point, Point],
) {
  const L1 = pointFrom<Point>(
    Math.round(l[0][0] * 1e4) / 1e4,
    Math.round(l[0][1] * 1e4) / 1e4,
  );
  const L2 = pointFrom<Point>(
    Math.round(l[1][0] * 1e4) / 1e4,
    Math.round(l[1][1] * 1e4) / 1e4,
  );

  const [lx, ly] = [
    [L1[0], L2[0]],
    [L1[1], L2[1]],
  ];

  const A = ly[1] - ly[0]; //A=y2-y1
  const B = lx[0] - lx[1]; //B=x1-x2
  const C = lx[0] * (ly[0] - ly[1]) + ly[0] * (lx[1] - lx[0]); //C=x1*(y1-y2)+y1*(x2-x1)

  const P = [];
  P[0] = A * bx[0] + B * by[0]; /*t^3*/
  P[1] = A * bx[1] + B * by[1]; /*t^2*/
  P[2] = A * bx[2] + B * by[2]; /*t*/
  P[3] = A * bx[3] + B * by[3] + C; /*1*/

  return cubicRoots(P);
}

function cubicRoots([a, b, c, d]: number[]): number[] {
  const A = b / Math.max(a, 1e-10);
  const B = c / Math.max(a, 1e-10);
  const C = d / Math.max(a, 1e-10);

  //var Q, R, D, S, T, Im;

  const Q = (3 * B - Math.pow(A, 2)) / 9;
  const R = (9 * A * B - 27 * C - 2 * Math.pow(A, 3)) / 54;
  const D = Math.pow(Q, 3) + Math.pow(R, 2); // polynomial discriminant

  const t = [];
  let Im = 0.0;

  if (D >= 0) {
    // complex or duplicate roots
    const S =
      Math.sign(R + Math.sqrt(D)) * Math.pow(Math.abs(R + Math.sqrt(D)), 1 / 3);
    const T =
      Math.sign(R - Math.sqrt(D)) * Math.pow(Math.abs(R - Math.sqrt(D)), 1 / 3);

    t[0] = -A / 3 + (S + T); // real root
    t[1] = -A / 3 - (S + T) / 2; // real part of complex root
    t[2] = -A / 3 - (S + T) / 2; // real part of complex root
    Im = Math.abs((Math.sqrt(3) * (S - T)) / 2); // complex part of root pair

    /*discard complex roots*/
    if (Im !== 0) {
      t[1] = -1;
      t[2] = -1;
    }
  } // distinct real roots
  else {
    const th = Math.acos(R / Math.sqrt(-Math.pow(Q, 3)));

    t[0] = 2 * Math.sqrt(-Q) * Math.cos(th / 3) - A / 3;
    t[1] = 2 * Math.sqrt(-Q) * Math.cos((th + 2 * Math.PI) / 3) - A / 3;
    t[2] = 2 * Math.sqrt(-Q) * Math.cos((th + 4 * Math.PI) / 3) - A / 3;
    Im = 0.0;
  }

  /*discard out of spec roots*/
  for (let i = 0; i < 3; i++) {
    if (t[i] < 0 || t[i] > 1.0) {
      t[i] = -1;
    }
  }

  return t.filter((t) => t !== -1);
}

function curveBounds<Point extends GlobalPoint | LocalPoint>(
  c: Curve<Point>,
): Bounds {
  const [P0, P1, P2, P3] = c;
  const x = [P0[0], P1[0], P2[0], P3[0]];
  const y = [P0[1], P1[1], P2[1], P3[1]];
  return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)];
}

function bezierCoeffs(P0: number, P1: number, P2: number, P3: number) {
  return [
    Math.max(-P0 + 3 * P1 + -3 * P2 + P3, 1e-4),
    3 * P0 - 6 * P1 + 3 * P2,
    -3 * P0 + 3 * P1,
    P0,
  ];
}
