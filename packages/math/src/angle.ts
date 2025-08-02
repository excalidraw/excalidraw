import { PRECISION } from "./utils";

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
