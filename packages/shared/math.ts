import type { Point } from "../excalidraw/types";

export const isValueInRange = (value: number, min: number, max: number) => {
  return value >= min && value <= max;
};

export const rotate = (
  // target point to rotate
  x: number,
  y: number,
  // point to rotate against
  cx: number,
  cy: number,
  angle: number,
): [number, number] =>
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  [
    (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx,
    (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy,
  ];

export const rotatePoint = (
  point: Point,
  center: Point,
  angle: number,
): [number, number] => rotate(point[0], point[1], center[0], center[1], angle);
