import * as GA from "./ga";
import { Line, Direction, Point, Transform } from "./ga";

/**
 * TODO: docs
 */

export function rotation(pivot: Point, angle: number): Transform {
  return GA.add(GA.mul(pivot, Math.sin(angle / 2)), Math.cos(angle / 2));
}

export function translation(direction: Direction): Transform {
  return [1, 0, 0, 0, -(0.5 * direction[5]), 0.5 * direction[4], 0, 0];
}

export function compose(motor1: Transform, motor2: Transform): Transform {
  return GA.mul(motor1, motor2);
}

export function apply(
  motor: Transform,
  nvector: Point | Direction | Line,
): Point | Direction | Line {
  return GA.normalized(GA.mul(GA.mul(motor, nvector), GA.reverse(motor)));
}
