import { randomSeed } from "roughjs/bin/math";
import nanoid from "nanoid";

import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawGenericElement,
} from "../element/types";
import { measureText } from "../utils";

type ElementConstructorOpts = {
  x: ExcalidrawGenericElement["x"];
  y: ExcalidrawGenericElement["y"];
  strokeColor: ExcalidrawGenericElement["strokeColor"];
  backgroundColor: ExcalidrawGenericElement["backgroundColor"];
  fillStyle: ExcalidrawGenericElement["fillStyle"];
  strokeWidth: ExcalidrawGenericElement["strokeWidth"];
  roughness: ExcalidrawGenericElement["roughness"];
  opacity: ExcalidrawGenericElement["opacity"];
  width?: ExcalidrawGenericElement["width"];
  height?: ExcalidrawGenericElement["height"];
};

function _newElementBase<T extends ExcalidrawElement>(
  type: T["type"],
  {
    x,
    y,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    roughness,
    opacity,
    width = 0,
    height = 0,
    ...rest
  }: ElementConstructorOpts & Partial<ExcalidrawGenericElement>,
) {
  return {
    id: rest.id || nanoid(),
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
    seed: rest.seed ?? randomSeed(),
    version: rest.version || 1,
    versionNonce: rest.versionNonce ?? 0,
    isDeleted: rest.isDeleted ?? false,
  };
}

export function newElement(
  opts: {
    type: ExcalidrawGenericElement["type"];
  } & ElementConstructorOpts,
): ExcalidrawGenericElement {
  return _newElementBase<ExcalidrawGenericElement>(opts.type, opts);
}

export function newTextElement(
  opts: {
    text: string;
    font: string;
  } & ElementConstructorOpts,
): ExcalidrawTextElement {
  const { text, font } = opts;
  const metrics = measureText(text, font);
  const textElement = {
    ..._newElementBase<ExcalidrawTextElement>("text", opts),
    text: text,
    font: font,
    // Center the text
    x: opts.x - metrics.width / 2,
    y: opts.y - metrics.height / 2,
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  };

  return textElement;
}

export function newLinearElement(
  opts: {
    type: "arrow" | "line";
  } & ElementConstructorOpts,
): ExcalidrawLinearElement {
  return {
    ..._newElementBase<ExcalidrawLinearElement>(opts.type, opts),
    points: [],
  };
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

export function duplicateElement<TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  overrides?: Partial<TElement>,
): TElement {
  let copy: TElement = _duplicateElement(element);
  copy.id = nanoid();
  copy.seed = randomSeed();
  if (overrides) {
    copy = Object.assign(copy, overrides);
  }
  return copy;
}
