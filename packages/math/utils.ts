import { polygonIsClosed } from "./polygon";
import type {
  Degrees,
  GlobalPoint,
  LocalPoint,
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
