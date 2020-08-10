import * as GA from "./ga";
import { Line, Direction, Point, Transform } from "./ga";
import * as GADirection from "./gadirections";

/**
 * TODO: docs
 */

export function rotation(pivot: Point, angle: number): Transform {
  return GA.add(GA.mul(pivot, Math.sin(angle / 2)), Math.cos(angle / 2));
}

export function translation(direction: Direction): Transform {
  return [1, 0, 0, 0, -(0.5 * direction[5]), 0.5 * direction[4], 0, 0];
}

export function translationOrthogonal(
  direction: Direction,
  distance: number,
): Transform {
  const scale = 0.5 * distance;
  return [1, 0, 0, 0, scale * direction[4], scale * direction[5], 0, 0];
}

export function translationAlong(line: Line, distance: number): Transform {
  return GA.add(GA.mul(GADirection.orthogonalToLine(line), 0.5 * distance), 1);
}

export function compose(motor1: Transform, motor2: Transform): Transform {
  return GA.mul(motor2, motor1);
}

export function apply(
  motor: Transform,
  nvector: Point | Direction | Line,
): Point | Direction | Line {
  return GA.normalized(GA.mul(GA.mul(motor, nvector), GA.reverse(motor)));
}
