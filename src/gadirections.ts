import * as GA from "./ga";
import { Line, Direction, Point } from "./ga";

/**
 * A direction is stored as an array `[0, 0, 0, 0, y, x, 0, 0]` representing
 * vector `(x, y)`.
 */

export function from(point: Point): Point {
  return [0, 0, 0, 0, point[4], point[5], 0, 0];
}

export function orthogonal(direction: Direction): Direction {
  return [0, 0, 0, 0, -direction[5], direction[4], 0, 0];
}

export function orthogonalToLine(line: Line): Direction {
  return GA.mul(line, GA.I);
}
