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
