import type {
  Degrees,
  GlobalPoint,
  LocalPoint,
  PolarCoords,
  Radians,
} from "./types";

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
 * Return the polar coordinates for the given carthesian point represented by
 * (x, y) for the center point 0,0 where the first number returned is the radius,
 * the second is the angle in radians.
 */
export const carthesian2Polar = <P extends GlobalPoint | LocalPoint>([
  x,
  y,
]: P): PolarCoords => [Math.hypot(x, y), Math.atan2(y, x)];

export function degreesToRadians(degrees: Degrees): Radians {
  return ((degrees * Math.PI) / 180) as Radians;
}

export function radiansToDegrees(degrees: Radians): Degrees {
  return ((degrees * 180) / Math.PI) as Degrees;
}
