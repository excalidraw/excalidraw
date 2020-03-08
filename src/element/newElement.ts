import { randomSeed } from "roughjs/bin/math";
import nanoid from "nanoid";
import { Point } from "roughjs/bin/geometry";

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
    seed: randomSeed(),
    points: [] as Point[],
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

// Simplified deep clone for the purpose of cloning ExcalidrawElement only
//  (doesn't clone Date, RegExp, Map, Set, Typed arrays etc.)
//
// Adapted from https://github.com/lukeed/klona
function _duplicateElement(val: any, depth: number = 0) {
  if (val == null || typeof val !== "object") {
    return val;
  }

  if (Object.prototype.toString.call(val) === "[object Object]") {
    const tmp =
      typeof val.constructor === "function"
        ? Object.create(Object.getPrototypeOf(val))
        : {};
    for (const key in val) {
      if (val.hasOwnProperty(key)) {
        // don't copy top-level shape property, which we want to regenerate
        if (depth === 0 && (key === "shape" || key === "canvas")) {
          continue;
        }
        tmp[key] = _duplicateElement(val[key], depth + 1);
      }
    }
    return tmp;
  }

  if (Array.isArray(val)) {
    let k = val.length;
    const arr = new Array(k);
    while (k--) {
      arr[k] = _duplicateElement(val[k], depth + 1);
    }
    return arr;
  }

  return val;
}

export function duplicateElement(element: ReturnType<typeof newElement>) {
  const copy = _duplicateElement(element);
  copy.id = nanoid();
  copy.seed = randomSeed();
  return copy;
}
