import { PRECISION } from "./utils";

import { vectorFromPoint, vectorDot } from "./vector";

import type {
  Degrees,
  GlobalPoint,
  LocalPoint,
  PolarCoords,
  Radians,
} from "./types";

export const normalizeRadians = (angle: Radians): Radians =>
  angle < 0
    ? (((angle % (2 * Math.PI)) + 2 * Math.PI) as Radians)
    : ((angle % (2 * Math.PI)) as Radians);

/**
 * Return the polar coordinates for the given cartesian point represented by
 * (x, y) for the center point 0,0 where the first number returned is the radius,
 * the second is the angle in radians.
 */
export const cartesian2Polar = <P extends GlobalPoint | LocalPoint>([
  x,
  y,
]: P): PolarCoords => [
  Math.hypot(x, y),
  normalizeRadians(Math.atan2(y, x) as Radians),
];

export function degreesToRadians(degrees: Degrees): Radians {
  return ((degrees * Math.PI) / 180) as Radians;
}

export function radiansToDegrees(degrees: Radians): Degrees {
  return ((degrees * 180) / Math.PI) as Degrees;
}

/**
 * Determines if the provided angle is a right angle.
 *
 * @param rads The angle to measure
 * @returns TRUE if the provided angle is a right angle
 */
export function isRightAngleRads(rads: Radians): boolean {
  return Math.abs(Math.sin(2 * rads)) < PRECISION;
}

export function radiansBetweenAngles(
  a: Radians,
  min: Radians,
  max: Radians,
): boolean {
  a = normalizeRadians(a);
  min = normalizeRadians(min);
  max = normalizeRadians(max);

  if (min < max) {
    return a >= min && a <= max;
  }

  // The range wraps around the 0 angle
  return a >= min || a <= max;
}

export function radiansDifference(a: Radians, b: Radians): Radians {
  a = normalizeRadians(a);
  b = normalizeRadians(b);

  let diff = a - b;

  if (diff < -Math.PI) {
    diff = (diff + 2 * Math.PI) as Radians;
  } else if (diff > Math.PI) {
    diff = (diff - 2 * Math.PI) as Radians;
  }

  return Math.abs(diff) as Radians;
}
/** * Calculates the angle between three points in radians.
 * The angle is calculated at the first point (p0) using the second (p1) and third (p2) points.
 * The angle is measured in radians and is always positive.
 * The function uses the dot product and the arccosine function to calculate the angle. * The result is clamped to the range [-1, 1] to avoid precision errors.
 * @param p0 The first point used to form the angle.
 * @param p1 The vertex point where the angle is calculated.
 * @param p2 The second point used to form the angle.
 * @returns The angle in radians between the three points.
 **/

export const angleBetween = <P extends GlobalPoint | LocalPoint>(
  p0: P,
  p1: P,
  p2: P,
): Radians => {
  const v1 = vectorFromPoint(p0, p1);
  const v2 = vectorFromPoint(p1, p2);

  // dot and cross product
  const magnitude1 = Math.hypot(v1[0], v1[1]);
  const magnitude2 = Math.hypot(v2[0], v2[1]);
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0 as Radians;
  }

  const dot = vectorDot(v1, v2);

  let cos = dot / (magnitude1 * magnitude2);
  // Clamp cos to [-1,1] to avoid precision errors
  cos = Math.max(-1, Math.min(1, cos));
  return Math.acos(cos) as Radians;
};
