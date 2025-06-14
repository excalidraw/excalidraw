import { type Bounds } from "@excalidraw/element";

export const PRECISION = 10e-5;

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const round = (
  value: number,
  precision: number,
  func: "round" | "floor" | "ceil" = "round",
) => {
  const multiplier = Math.pow(10, precision);

  return Math[func]((value + Number.EPSILON) * multiplier) / multiplier;
};

export const roundToStep = (
  value: number,
  step: number,
  func: "round" | "floor" | "ceil" = "round",
): number => {
  const factor = 1 / step;
  return Math[func](value * factor) / factor;
};

export const average = (a: number, b: number) => (a + b) / 2;

export const isFiniteNumber = (value: any): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export const isCloseTo = (a: number, b: number, precision = PRECISION) =>
  Math.abs(a - b) < precision;

export const doBoundsIntersect = (
  bounds1: Bounds | null,
  bounds2: Bounds | null,
): boolean => {
  if (bounds1 == null || bounds2 == null) {
    return false;
  }

  const [minX1, minY1, maxX1, maxY1] = bounds1;
  const [minX2, minY2, maxX2, maxY2] = bounds2;

  return minX1 < maxX2 && maxX1 > minX2 && minY1 < maxY2 && maxY1 > minY2;
};
