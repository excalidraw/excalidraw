import * as GA from "./ga";
import { Line, Point } from "./ga";

/**
 * A line is stored as an array `[0, c, a, b, 0, 0, 0, 0]` representing:
 *   c * e0 + a * e1 + b*e2
 *
 * This maps to a standard formula `a * x + b * y + c`.
 *
 * `(-b, a)` correponds to a 2D vector parallel to the line. The lines
 * have a natural orientation, corresponding to that vector.
 *
 * The magnitude ("norm") of the line is `sqrt(a ^ 2 + b ^ 2)`.
 * `c / norm(line)` is the oriented distance from line to origin.
 */

// Returns line with direction (x, y) through origin
export function vector(x: number, y: number): Line {
  return GA.normalized([0, 0, -y, x, 0, 0, 0, 0]);
}

// For equation ax + by + c = 0.
export function equation(a: number, b: number, c: number): Line {
  return GA.normalized([0, c, a, b, 0, 0, 0, 0]);
}

export function through(from: Point, to: Point): Line {
  return GA.normalized(GA.join(to, from));
}

export function orthogonal(line: Line, point: Point): Line {
  return GA.dot(line, point);
}

// Returns a line perpendicular to the line through `against` and `intersection`
// going through `intersection`.
export function orthogonalThrough(against: Point, intersection: Point): Line {
  return orthogonal(through(against, intersection), intersection);
}

export function parallel(line: Line, distance: number): Line {
  const result = line.slice();
  result[1] += distance;
  return (result as unknown) as Line;
}

export function parallelThrough(line: Line, point: Point): Line {
  return orthogonal(orthogonal(point, line), point);
}

export function distance(line1: Line, line2: Line): number {
  return GA.inorm(GA.meet(line1, line2));
}

export function angle(line1: Line, line2: Line): number {
  return Math.acos(GA.dot(line1, line2)[0]);
}
