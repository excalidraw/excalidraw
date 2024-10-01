import { pointFrom, pointRotateRads } from "./point";
import type { Curve, GlobalPoint, LocalPoint, Radians } from "./types";

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

export const curveRotate = <Point extends LocalPoint | GlobalPoint>(
  curve: Curve<Point>,
  angle: Radians,
  origin: Point,
) => {
  return curve.map((p) => pointRotateRads(p, origin, angle));
};

/**
 *
 * @param pointsIn
 * @param curveTightness
 * @returns
 */
export function curveToBezier<Point extends LocalPoint | GlobalPoint>(
  pointsIn: readonly Point[],
  curveTightness = 0,
): Point[] {
  const len = pointsIn.length;
  if (len < 3) {
    throw new Error("A curve must have at least three points.");
  }
  const out: Point[] = [];
  if (len === 3) {
    out.push(
      pointFrom(pointsIn[0][0], pointsIn[0][1]), // Points need to be cloned
      pointFrom(pointsIn[1][0], pointsIn[1][1]), // Points need to be cloned
      pointFrom(pointsIn[2][0], pointsIn[2][1]), // Points need to be cloned
      pointFrom(pointsIn[2][0], pointsIn[2][1]), // Points need to be cloned
    );
  } else {
    const points: Point[] = [];
    points.push(pointsIn[0], pointsIn[0]);
    for (let i = 1; i < pointsIn.length; i++) {
      points.push(pointsIn[i]);
      if (i === pointsIn.length - 1) {
        points.push(pointsIn[i]);
      }
    }
    const b: Point[] = [];
    const s = 1 - curveTightness;
    out.push(pointFrom(points[0][0], points[0][1]));
    for (let i = 1; i + 2 < points.length; i++) {
      const cachedVertArray = points[i];
      b[0] = pointFrom(cachedVertArray[0], cachedVertArray[1]);
      b[1] = pointFrom(
        cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6,
        cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6,
      );
      b[2] = pointFrom(
        points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6,
        points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6,
      );
      b[3] = pointFrom(points[i + 1][0], points[i + 1][1]);
      out.push(b[1], b[2], b[3]);
    }
  }
  return out;
}

/**
 *
 * @param t
 * @param controlPoints
 * @returns
 */
export const cubicBezierPoint = <Point extends LocalPoint | GlobalPoint>(
  t: number,
  controlPoints: Curve<Point>,
): Point => {
  const [p0, p1, p2, p3] = controlPoints;

  const x =
    Math.pow(1 - t, 3) * p0[0] +
    3 * Math.pow(1 - t, 2) * t * p1[0] +
    3 * (1 - t) * Math.pow(t, 2) * p2[0] +
    Math.pow(t, 3) * p3[0];

  const y =
    Math.pow(1 - t, 3) * p0[1] +
    3 * Math.pow(1 - t, 2) * t * p1[1] +
    3 * (1 - t) * Math.pow(t, 2) * p2[1] +
    Math.pow(t, 3) * p3[1];

  return pointFrom(x, y);
};

/**
 *
 * @param point
 * @param controlPoints
 * @returns
 */
export const cubicBezierDistance = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  controlPoints: Curve<Point>,
) => {
  // Calculate the closest point on the Bezier curve to the given point
  const t = findClosestParameter(point, controlPoints);

  // Calculate the coordinates of the closest point on the curve
  const [closestX, closestY] = cubicBezierPoint(t, controlPoints);

  // Calculate the distance between the given point and the closest point on the curve
  const distance = Math.sqrt(
    (point[0] - closestX) ** 2 + (point[1] - closestY) ** 2,
  );

  return distance;
};

const solveCubic = (a: number, b: number, c: number, d: number) => {
  // This function solves the cubic equation ax^3 + bx^2 + cx + d = 0
  const roots: number[] = [];

  const discriminant =
    18 * a * b * c * d -
    4 * Math.pow(b, 3) * d +
    Math.pow(b, 2) * Math.pow(c, 2) -
    4 * a * Math.pow(c, 3) -
    27 * Math.pow(a, 2) * Math.pow(d, 2);

  if (discriminant >= 0) {
    const C = Math.cbrt((discriminant + Math.sqrt(discriminant)) / 2);
    const D = Math.cbrt((discriminant - Math.sqrt(discriminant)) / 2);

    const root1 = (-b - C - D) / (3 * a);
    const root2 = (-b + (C + D) / 2) / (3 * a);
    const root3 = (-b + (C + D) / 2) / (3 * a);

    roots.push(root1, root2, root3);
  } else {
    const realPart = -b / (3 * a);

    const root1 =
      2 * Math.sqrt(-b / (3 * a)) * Math.cos(Math.acos(realPart) / 3);
    const root2 =
      2 *
      Math.sqrt(-b / (3 * a)) *
      Math.cos((Math.acos(realPart) + 2 * Math.PI) / 3);
    const root3 =
      2 *
      Math.sqrt(-b / (3 * a)) *
      Math.cos((Math.acos(realPart) + 4 * Math.PI) / 3);

    roots.push(root1, root2, root3);
  }

  return roots;
};

const findClosestParameter = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  controlPoints: Curve<Point>,
) => {
  // This function finds the parameter t that minimizes the distance between the point
  // and any point on the cubic Bezier curve.

  const [p0, p1, p2, p3] = controlPoints;

  // Use the direct formula to find the parameter t
  const a = p3[0] - 3 * p2[0] + 3 * p1[0] - p0[0];
  const b = 3 * p2[0] - 6 * p1[0] + 3 * p0[0];
  const c = 3 * p1[0] - 3 * p0[0];
  const d = p0[0] - point[0];

  const rootsX = solveCubic(a, b, c, d);

  // Do the same for the y-coordinate
  const e = p3[1] - 3 * p2[1] + 3 * p1[1] - p0[1];
  const f = 3 * p2[1] - 6 * p1[1] + 3 * p0[1];
  const g = 3 * p1[1] - 3 * p0[1];
  const h = p0[1] - point[1];

  const rootsY = solveCubic(e, f, g, h);

  // Select the real root that is between 0 and 1 (inclusive)
  const validRootsX = rootsX.filter((root) => root >= 0 && root <= 1);
  const validRootsY = rootsY.filter((root) => root >= 0 && root <= 1);

  if (validRootsX.length === 0 || validRootsY.length === 0) {
    // No valid roots found, use the midpoint as a fallback
    return 0.5;
  }

  // Choose the parameter t that minimizes the distance
  let minDistance = Infinity;
  let closestT = 0;

  for (const rootX of validRootsX) {
    for (const rootY of validRootsY) {
      const distance = Math.sqrt(
        (rootX - point[0]) ** 2 + (rootY - point[1]) ** 2,
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestT = (rootX + rootY) / 2; // Use the average for a smoother result
      }
    }
  }

  return closestT;
};
