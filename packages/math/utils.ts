import { polygonIsClosed } from "./polygon";
import type { GlobalPoint, LocalPoint, Polygon } from "./types";

export const PRECISION = 10e-5;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, precision: number) {
  const multiplier = Math.pow(10, precision);

  return Math.round((value + PRECISION) * multiplier) / multiplier;
}

export const closePolygon = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
) => {
  return polygonIsClosed(polygon) ? polygon : [...polygon, polygon[0]];
};
