/**
 * This is a 2D Projective Geometric Algebra implementation.
 *
 * For wider context on geometric algebra visit see https://bivector.net.
 *
 * For this specific algebra see cheatsheet https://bivector.net/2DPGA.pdf.
 *
 * Converted from generator written by enki, with a ton of added on top.
 *
 * This library uses 8-vectors to represent points, directions and lines
 * in 2D space.
 *
 * An array `[a, b, c, d, e, f, g, h]` represents a n(8)vector:
 *   a + b*e0 + c*e1 + d*e2 + e*e01 + f*e20 + g*e12 + h*e012
 *
 * See GAPoint, GALine, GADirection and GATransform modules for common
 * operations.
 */

export type Point = NVector;
export type Direction = NVector;
export type Line = NVector;
export type Transform = NVector;

export const point = (x: number, y: number): Point => [0, 0, 0, 0, y, x, 1, 0];

export const origin = (): Point => [0, 0, 0, 0, 0, 0, 1, 0];

export const direction = (x: number, y: number): Direction => {
  const norm = Math.hypot(x, y); // same as `inorm(direction(x, y))`
  return [0, 0, 0, 0, y / norm, x / norm, 0, 0];
};

export const offset = (x: number, y: number): Direction => [
  0,
  0,
  0,
  0,
  y,
  x,
  0,
  0,
];

/// This is the "implementation" part of the library

type NVector = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

// These are labels for what each number in an nvector represents
const NVECTOR_BASE = ["1", "e0", "e1", "e2", "e01", "e20", "e12", "e012"];

// Used to represent points, lines and transformations
export const nvector = (value: number = 0, index: number = 0): NVector => {
  const result = [0, 0, 0, 0, 0, 0, 0, 0];
  if (index < 0 || index > 7) {
    throw new Error(`Expected \`index\` between 0 and 7, got \`${index}\``);
  }
  if (value !== 0) {
    result[index] = value;
  }
  return result as unknown as NVector;
};

const STRING_EPSILON = 0.000001;
export const toString = (nvector: NVector): string => {
  const result = nvector
    .map((value, index) =>
      Math.abs(value) > STRING_EPSILON
        ? value.toFixed(7).replace(/(\.|0+)$/, "") +
          (index > 0 ? NVECTOR_BASE[index] : "")
        : null,
    )
    .filter((representation) => representation != null)
    .join(" + ");
  return result === "" ? "0" : result;
};

// Reverse the order of the basis blades.
export const reverse = (nvector: NVector): NVector => [
  nvector[0],
  nvector[1],
  nvector[2],
  nvector[3],
  -nvector[4],
  -nvector[5],
  -nvector[6],
  -nvector[7],
];

// Poincare duality operator.
export const dual = (nvector: NVector): NVector => [
  nvector[7],
  nvector[6],
  nvector[5],
  nvector[4],
  nvector[3],
  nvector[2],
  nvector[1],
  nvector[0],
];

// Clifford Conjugation
export const conjugate = (nvector: NVector): NVector => [
  nvector[0],
  -nvector[1],
  -nvector[2],
  -nvector[3],
  -nvector[4],
  -nvector[5],
  -nvector[6],
  nvector[7],
];

// Main involution
export const involute = (nvector: NVector): NVector => [
  nvector[0],
  -nvector[1],
  -nvector[2],
  -nvector[3],
  nvector[4],
  nvector[5],
  nvector[6],
  -nvector[7],
];

// Multivector addition
export const add = (a: NVector, b: NVector | number): NVector => {
  if (isNumber(b)) {
    return [a[0] + b, a[1], a[2], a[3], a[4], a[5], a[6], a[7]];
  }
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
    a[3] + b[3],
    a[4] + b[4],
    a[5] + b[5],
    a[6] + b[6],
    a[7] + b[7],
  ];
};

// Multivector subtraction
export const sub = (a: NVector, b: NVector | number): NVector => {
  if (isNumber(b)) {
    return [a[0] - b, a[1], a[2], a[3], a[4], a[5], a[6], a[7]];
  }
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
    a[3] - b[3],
    a[4] - b[4],
    a[5] - b[5],
    a[6] - b[6],
    a[7] - b[7],
  ];
};

// The geometric product.
export const mul = (a: NVector, b: NVector | number): NVector => {
  if (isNumber(b)) {
    return [
      a[0] * b,
      a[1] * b,
      a[2] * b,
      a[3] * b,
      a[4] * b,
      a[5] * b,
      a[6] * b,
      a[7] * b,
    ];
  }
  return [
    mulScalar(a, b),
    b[1] * a[0] +
      b[0] * a[1] -
      b[4] * a[2] +
      b[5] * a[3] +
      b[2] * a[4] -
      b[3] * a[5] -
      b[7] * a[6] -
      b[6] * a[7],
    b[2] * a[0] + b[0] * a[2] - b[6] * a[3] + b[3] * a[6],
    b[3] * a[0] + b[6] * a[2] + b[0] * a[3] - b[2] * a[6],
    b[4] * a[0] +
      b[2] * a[1] -
      b[1] * a[2] +
      b[7] * a[3] +
      b[0] * a[4] +
      b[6] * a[5] -
      b[5] * a[6] +
      b[3] * a[7],
    b[5] * a[0] -
      b[3] * a[1] +
      b[7] * a[2] +
      b[1] * a[3] -
      b[6] * a[4] +
      b[0] * a[5] +
      b[4] * a[6] +
      b[2] * a[7],
    b[6] * a[0] + b[3] * a[2] - b[2] * a[3] + b[0] * a[6],
    b[7] * a[0] +
      b[6] * a[1] +
      b[5] * a[2] +
      b[4] * a[3] +
      b[3] * a[4] +
      b[2] * a[5] +
      b[1] * a[6] +
      b[0] * a[7],
  ];
};

export const mulScalar = (a: NVector, b: NVector): number =>
  b[0] * a[0] + b[2] * a[2] + b[3] * a[3] - b[6] * a[6];

// The outer/exterior/wedge product.
export const meet = (a: NVector, b: NVector): NVector => [
  b[0] * a[0],
  b[1] * a[0] + b[0] * a[1],
  b[2] * a[0] + b[0] * a[2],
  b[3] * a[0] + b[0] * a[3],
  b[4] * a[0] + b[2] * a[1] - b[1] * a[2] + b[0] * a[4],
  b[5] * a[0] - b[3] * a[1] + b[1] * a[3] + b[0] * a[5],
  b[6] * a[0] + b[3] * a[2] - b[2] * a[3] + b[0] * a[6],
  b[7] * a[0] +
    b[6] * a[1] +
    b[5] * a[2] +
    b[4] * a[3] +
    b[3] * a[4] +
    b[2] * a[5] +
    b[1] * a[6],
];

// The regressive product.
export const join = (a: NVector, b: NVector): NVector => [
  joinScalar(a, b),
  a[1] * b[7] + a[4] * b[5] - a[5] * b[4] + a[7] * b[1],
  a[2] * b[7] - a[4] * b[6] + a[6] * b[4] + a[7] * b[2],
  a[3] * b[7] + a[5] * b[6] - a[6] * b[5] + a[7] * b[3],
  a[4] * b[7] + a[7] * b[4],
  a[5] * b[7] + a[7] * b[5],
  a[6] * b[7] + a[7] * b[6],
  a[7] * b[7],
];

export const joinScalar = (a: NVector, b: NVector): number =>
  a[0] * b[7] +
  a[1] * b[6] +
  a[2] * b[5] +
  a[3] * b[4] +
  a[4] * b[3] +
  a[5] * b[2] +
  a[6] * b[1] +
  a[7] * b[0];

// The inner product.
export const dot = (a: NVector, b: NVector): NVector => [
  b[0] * a[0] + b[2] * a[2] + b[3] * a[3] - b[6] * a[6],
  b[1] * a[0] +
    b[0] * a[1] -
    b[4] * a[2] +
    b[5] * a[3] +
    b[2] * a[4] -
    b[3] * a[5] -
    b[7] * a[6] -
    b[6] * a[7],
  b[2] * a[0] + b[0] * a[2] - b[6] * a[3] + b[3] * a[6],
  b[3] * a[0] + b[6] * a[2] + b[0] * a[3] - b[2] * a[6],
  b[4] * a[0] + b[7] * a[3] + b[0] * a[4] + b[3] * a[7],
  b[5] * a[0] + b[7] * a[2] + b[0] * a[5] + b[2] * a[7],
  b[6] * a[0] + b[0] * a[6],
  b[7] * a[0] + b[0] * a[7],
];

export const norm = (a: NVector): number =>
  Math.sqrt(Math.abs(a[0] * a[0] - a[2] * a[2] - a[3] * a[3] + a[6] * a[6]));

export const inorm = (a: NVector): number =>
  Math.sqrt(Math.abs(a[7] * a[7] - a[5] * a[5] - a[4] * a[4] + a[1] * a[1]));

export const normalized = (a: NVector): NVector => {
  const n = norm(a);
  if (n === 0 || n === 1) {
    return a;
  }
  const sign = a[6] < 0 ? -1 : 1;
  return mul(a, sign / n);
};

export const inormalized = (a: NVector): NVector => {
  const n = inorm(a);
  if (n === 0 || n === 1) {
    return a;
  }
  return mul(a, 1 / n);
};

const isNumber = (a: any): a is number => typeof a === "number";

export const E0: NVector = nvector(1, 1);
export const E1: NVector = nvector(1, 2);
export const E2: NVector = nvector(1, 3);
export const E01: NVector = nvector(1, 4);
export const E20: NVector = nvector(1, 5);
export const E12: NVector = nvector(1, 6);
export const E012: NVector = nvector(1, 7);
export const I = E012;
