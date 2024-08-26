import { polygonIsClosed } from "./polygon";
import type {
  Degrees,
  GlobalPoint,
  LocalPoint,
  PolarCoords,
  Polygon,
  Radians,
} from "./types";

export const INVERSE_PRECISION = 100_000;
export const PRECISION = 1 / INVERSE_PRECISION;

export function degreesToRadians(degrees: Degrees): Radians {
  "inline";
  return ((degrees * Math.PI) / 180) as Radians;
}

export function radiansToDegrees(degrees: Radians): Degrees {
  "inline";
  return ((degrees * 180) / Math.PI) as Degrees;
}

export function clamp(value: number, min: number, max: number) {
  "inline";
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, precision: number) {
  "inline";
  const multiplier = Math.pow(10, precision);

  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

export const closePolygon = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
) => {
  return polygonIsClosed(polygon) ? polygon : [...polygon, polygon[0]];
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
