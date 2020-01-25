import { randomSeed } from "roughjs/bin/math";
import nanoid from "nanoid";
import { Drawable } from "roughjs/bin/core";

import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { measureText } from "../utils";

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
  height = 0,
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
    shape: null as Drawable | Drawable[] | null,
  };
  return element;
}

export function newTextElement(
  element: ExcalidrawElement,
  text: string,
  font: string,
) {
  const metrics = measureText(text, font);
  const textElement: ExcalidrawTextElement = {
    ...element,
    type: "text",
    text: text,
    font: font,
    // Center the text
    x: element.x - metrics.width / 2,
    y: element.y - metrics.height / 2,
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  };

  return textElement;
}

export function duplicateElement(element: ReturnType<typeof newElement>) {
  const copy = { ...element };
  delete copy.shape;
  copy.id = nanoid();
  copy.seed = randomSeed();
  return copy;
}
