import type { Degrees, GenericPoint, PolarCoords, Radians } from "./types";
import { PRECISION } from "./utils";

/**
 * Construct an angle value in radians
 *
 * @param angle The number to mark as radians
 * @returns The radians typed value
 */
export function radians(angle: number): Radians {
  return angle as Radians;
}

/**
 * Construct an angle value in degrees
 *
 * @param angle The number to mark as degrees
 * @returns The degrees typed value
 */
export function degrees(angle: number): Degrees {
  return angle as Degrees;
}

/**
 * Construct a polar coordinate
 *
 * @param radius The radius of the circle to address with this coordinate
 * @param angle The angle from the "northest" point of the cirle to address
 * @returns The polar coordinate value
 */
export function polar(radius: number, angle: Radians): PolarCoords {
  return [radius, angle] as PolarCoords;
}

/**
 * Convert an angle in radians into it's smallest octave
 *
 * @param angle The angle to normalie
 * @returns The normalized angle in radians
 */
// TODO: Simplify with modulo and fix for angles beyond 4*Math.PI and - 4*Math.PI
export const normalizeRadians = (angle: Radians): Radians => {
  if (angle < 0) {
    return (angle + 2 * Math.PI) as Radians;
  }
  if (angle >= 2 * Math.PI) {
    return (angle - 2 * Math.PI) as Radians;
  }
  return angle;
};

/**
 * Return the polar coordinates for the given cartesian point represented by
 * (x, y) for the center point 0,0 where the first number returned is the radius,
 * the second is the angle in radians.
 *
 * @param param0
 * @returns
 */
export const cartesian2Polar = <P extends GenericPoint>([
  x,
  y,
]: P): PolarCoords =>
  polar(Math.hypot(x, y), normalizeRadians(radians(Math.atan2(y, x))));

/**
 * Convert an angle in degrees into randians
 *
 * @param degrees The angle to convert
 * @returns The angle in radians
 */
export function degreesToRadians(degrees: Degrees): Radians {
  return ((degrees * Math.PI) / 180) as Radians;
}

/**
 * Convert an angle in radians into degrees
 *
 * @param degrees The angle to convert
 * @returns The angle in degrees
 */
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
