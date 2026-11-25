import { pointFrom } from "./point";
import { vector, vectorNormal, vectorNormalize, vectorScale } from "./vector";

import type { GlobalPoint, LocalPoint, Vector } from "./types";

/**
 * The principal axes of a point set, i.e. the eigen decomposition of its
 * 2x2 covariance matrix.
 *
 * The axes are orthonormal and ordered by variance, so `major` is the
 * direction along which the points spread the most. Together with `centroid`
 * they define a canonical frame: expressing the points in it removes
 * translation and rotation, and dividing by `sqrt(majorVariance)` removes
 * scale.
 */
export type PrincipalAxes<Point extends GlobalPoint | LocalPoint> = {
  centroid: Point;
  /** Unit vector along the direction of largest variance. */
  major: Vector;
  /** Unit vector along the direction of smallest variance, normal to major. */
  minor: Vector;
  /** Variance along `major` (the larger eigenvalue, λ₁). */
  majorVariance: number;
  /** Variance along `minor` (the smaller eigenvalue, λ₂). */
  minorVariance: number;
};

/**
 * A point expressed in a principal axes frame: `u` along the major axis,
 * `v` along the minor axis, both relative to the centroid.
 */
export type PrincipalCoords = [u: number, v: number];

/**
 * Compute the centroid of a point set.
 */
export function centroid<Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
): Point {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  return pointFrom<Point>(cx / points.length, cy / points.length);
}

/**
 * Principal component analysis of a 2D point set.
 *
 * Computes the centroid and the eigen decomposition of the covariance matrix
 * [[μ20, μ11], [μ11, μ02]].
 *
 * @param points At least two points; fewer leaves the axes degenerate.
 * @returns The centroid, the orthonormal axes and their variances.
 */
export function principalAxes<Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
): PrincipalAxes<Point> {
  if (points.length < 2) {
    console.error("Degenerate point set: at least two points are required");
  }

  const c = centroid(points);

  let m20 = 0;
  let m02 = 0;
  let m11 = 0;
  for (const [x, y] of points) {
    const dx = x - c[0];
    const dy = y - c[1];
    m20 += dx * dx;
    m02 += dy * dy;
    m11 += dx * dy;
  }
  m20 /= points.length;
  m02 /= points.length;
  m11 /= points.length;

  // Eigenvalues of [[m20, m11], [m11, m02]].
  const trace = m20 + m02;
  const diff = Math.hypot(m20 - m02, 2 * m11);
  const majorVariance = (trace + diff) / 2;
  const minorVariance = (trace - diff) / 2;

  // Eigenvector for the larger eigenvalue. When m11 is 0 the covariance is
  // already diagonal and the axes are the coordinate axes.
  let major: Vector;
  if (Math.abs(m11) > Number.EPSILON) {
    major = vectorNormalize(vector(majorVariance - m02, m11));
  } else {
    major = m20 >= m02 ? vector(1, 0) : vector(0, 1);
  }

  return {
    centroid: c,
    major,
    minor: vectorNormal(major),
    majorVariance,
    minorVariance,
  };
}

/**
 * Express points in the frame of the given principal axes, making the point
 * cloud rotation, scale and translation invariant.
 */
export function principalCoords<Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
  axes: PrincipalAxes<Point>,
  scale: number = 1,
): PrincipalCoords[] {
  const { centroid: c, major, minor } = axes;
  return points.map(([x, y]) => {
    const dx = x - c[0];
    const dy = y - c[1];
    return [
      (dx * major[0] + dy * major[1]) * scale,
      (dx * minor[0] + dy * minor[1]) * scale,
    ] as PrincipalCoords;
  });
}

/**
 * Flip the major axis so that it points toward the denser end of the point
 * cloud, resolving the 180° sign ambiguity of the eigenvector.
 *
 * @returns The axes with `major`/`minor` flipped if needed. Variances are
 * unchanged, as they are invariant to axis sign.
 */
export function orientPrincipalAxes<Point extends GlobalPoint | LocalPoint>(
  points: readonly Point[],
  axes: PrincipalAxes<Point>,
): PrincipalAxes<Point> {
  const u = principalCoords(points, axes).map(([uu]) => uu);
  if (skewness(u) <= 0) {
    return axes;
  }
  const major = vectorScale(axes.major, -1);
  return { ...axes, major, minor: vectorNormal(major) };
}

/**
 * Ratio of the minor to the major variance in [0, 1]
 *
 * @returns 0 is a perfectly straight stroke, 1 is a stroke with no preferred
 * direction.
 */
export function elongation<Point extends GlobalPoint | LocalPoint>(
  axes: PrincipalAxes<Point>,
): number {
  return axes.majorVariance > 0 ? axes.minorVariance / axes.majorVariance : 1;
}

/**
 * The `order`-th standardized moment of a sample in a rotation and scale
 * invariant way (sandardizing by sigma).
 *
 * @returns 0 for a degenerate (zero variance) sample.
 */
export function standardizedMoment(
  values: readonly number[],
  order: number,
): number {
  const n = values.length;
  let mean = 0;
  for (const v of values) {
    mean += v;
  }
  mean /= n;

  let variance = 0;
  let moment = 0;
  for (const v of values) {
    const d = v - mean;
    variance += d * d;
    moment += d ** order;
  }
  variance /= n;
  moment /= n;

  const sigma = Math.sqrt(variance);
  return sigma > Number.EPSILON ? moment / sigma ** order : 0;
}

/**
 * Third standardized moment: how lopsided a sample is.
 *
 */
export function skewness(values: readonly number[]): number {
  return standardizedMoment(values, 3);
}

/**
 * Fourth standardized moment: how the mass is split between the tails and the
 * middle of a sample. Not excess kurtosis, a normal sample gives 3.
 *
 */
export function kurtosis(values: readonly number[]): number {
  return standardizedMoment(values, 4);
}
