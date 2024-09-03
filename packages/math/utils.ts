export const PRECISION = 10e-5;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, precision: number) {
  const multiplier = Math.pow(10, precision);

  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

export const average = (a: number, b: number) => (a + b) / 2;

export const isFiniteNumber = (value: any): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};
