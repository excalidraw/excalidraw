import { isPoint, pointDistance, pointFrom } from "./point";
import type { Curve, GlobalPoint, Line, LocalPoint } from "./types";

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

/**
 * Computes intersection between a cubic spline and a line segment
 *
 * @href https://www.particleincell.com/2013/cubic-line-intersection/
 */
export function curveIntersectLine<Point extends GlobalPoint | LocalPoint>(
  p: Curve<Point>,
  l: Line<Point>,
): Point[] {
  const A = l[1][1] - l[0][1]; //A=y2-y1
  const B = l[0][0] - l[1][0]; //B=x1-x2
  const C = l[0][0] * (l[0][1] - l[1][1]) + l[0][1] * (l[1][0] - l[0][0]); //C=x1*(y1-y2)+y1*(x2-x1)

  const bx = [
    -p[0][0] + 3 * p[1][0] + -3 * p[2][0] + p[3][0],
    3 * p[0][0] - 6 * p[1][0] + 3 * p[2][0],
    -3 * p[0][0] + 3 * p[1][0],
    p[0][0],
  ];
  const by = [
    -p[0][1] + 3 * p[1][1] + -3 * p[2][1] + p[3][1],
    3 * p[0][1] - 6 * p[1][1] + 3 * p[2][1],
    -3 * p[0][1] + 3 * p[1][1],
    p[0][1],
  ];

  const P: [number, number, number, number] = [
    A * bx[0] + B * by[0] /*t^3*/,
    A * bx[1] + B * by[1] /*t^2*/,
    A * bx[2] + B * by[2] /*t*/,
    A * bx[3] + B * by[3] + C /*1*/,
  ];

  const r = cubicRoots(P);

  /*verify the roots are in bounds of the linear segment*/
  return r
    .map((t) => {
      const x = pointFrom<Point>(
        bx[0] * t ** 3 + bx[1] * t ** 2 + bx[2] * t + bx[3],
        by[0] * t ** 3 + by[1] * t ** 2 + by[2] * t + by[3],
      );

      /*above is intersection point assuming infinitely long line segment,
          make sure we are also in bounds of the line*/
      let s;
      if (l[1][0] - l[0][0] !== 0) {
        /*if not vertical line*/
        s = (x[0] - l[0][0]) / (l[1][0] - l[0][0]);
      } else {
        s = (x[1] - l[0][1]) / (l[1][1] - l[0][1]);
      }

      /*in bounds?*/
      if (t < 0 || t > 1.0 || s < 0 || s > 1.0) {
        return null;
      }

      return x;
    })
    .filter((x): x is Point => x !== null);
}

/*
 * Based on http://mysite.verizon.net/res148h4j/javascript/script_exact_cubic.html#the%20source%20code
 */
function cubicRoots(P: [number, number, number, number]) {
  const a = P[0];
  const b = P[1];
  const c = P[2];
  const d = P[3];

  const A = b / a;
  const B = c / a;
  const C = d / a;

  let Im;

  const Q = (3 * B - Math.pow(A, 2)) / 9;
  const R = (9 * A * B - 27 * C - 2 * Math.pow(A, 3)) / 54;
  const D = Math.pow(Q, 3) + Math.pow(R, 2); // polynomial discriminant

  let t = [];

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

  // sort but place -1 at the end
  t = t.sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : a - b));

  return t;
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
export default function isCurve<P extends GlobalPoint | LocalPoint>(
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
