import type { Radians } from "./types";

export const normalizeRadians = (angle: Radians): Radians => {
  if (angle < 0) {
    return (angle + 2 * Math.PI) as Radians;
  }
  if (angle >= 2 * Math.PI) {
    return (angle - 2 * Math.PI) as Radians;
  }
  return angle;
};
