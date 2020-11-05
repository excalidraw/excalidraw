import * as GA from "./ga";
import { Line, Direction, Point, Transform } from "./ga";
import * as GADirection from "./gadirections";

/**
 * TODO: docs
 */

export const rotation = (pivot: Point, angle: number): Transform =>
  GA.add(GA.mul(pivot, Math.sin(angle / 2)), Math.cos(angle / 2));

export const translation = (direction: Direction): Transform => [
  1,
  0,
  0,
  0,
  -(0.5 * direction[5]),
  0.5 * direction[4],
  0,
  0,
];

export const translationOrthogonal = (
  direction: Direction,
  distance: number,
): Transform => {
  const scale = 0.5 * distance;
  return [1, 0, 0, 0, scale * direction[4], scale * direction[5], 0, 0];
};

export const translationAlong = (line: Line, distance: number): Transform =>
  GA.add(GA.mul(GADirection.orthogonalToLine(line), 0.5 * distance), 1);

export const compose = (motor1: Transform, motor2: Transform): Transform =>
  GA.mul(motor2, motor1);

export const apply = (
  motor: Transform,
  nvector: Point | Direction | Line,
): Point | Direction | Line =>
  GA.normalized(GA.mul(GA.mul(motor, nvector), GA.reverse(motor)));
