import * as GA from "./ga";
import * as GALine from "./galines";
import { Point, Line, join } from "./ga";

export const from = ([x, y]: readonly [number, number]): Point => [
  0,
  0,
  0,
  0,
  y,
  x,
  1,
  0,
];

export const toTuple = (point: Point): [number, number] => [point[5], point[4]];

export const abs = (point: Point): Point => [
  0,
  0,
  0,
  0,
  Math.abs(point[4]),
  Math.abs(point[5]),
  1,
  0,
];

export const intersect = (line1: Line, line2: Line): Point =>
  GA.normalized(GA.meet(line1, line2));

// Projects `point` onto the `line`.
// The returned point is the closest point on the `line` to the `point`.
export const project = (point: Point, line: Line): Point =>
  intersect(GALine.orthogonal(line, point), line);

export const distance = (point1: Point, point2: Point): number =>
  GA.norm(join(point1, point2));

export const distanceToLine = (point: Point, line: Line): number =>
  GA.joinScalar(point, line);
