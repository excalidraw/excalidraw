import { randomSeed } from "../random";
import nanoid from "nanoid";
import { Drawable } from "roughjs/bin/core";

export function newElement(
  type: string,
  x: number,
  y: number,
  strokeColor: string,
  backgroundColor: string,
  fillStyle: string,
  strokeWidth: number,
  roughness: number,
  opacity: number,
  width = 0,
  height = 0
) {
  const element = {
    id: nanoid(),
    type,
    x,
    y,
    width,
    height,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    roughness,
    opacity,
    isSelected: false,
    seed: randomSeed(),
    shape: null as Drawable | Drawable[] | null
  };
  return element;
}

export function duplicateElement(element: ReturnType<typeof newElement>) {
  const copy = { ...element };
  copy.id = nanoid();
  copy.seed = randomSeed();
  return copy;
}
