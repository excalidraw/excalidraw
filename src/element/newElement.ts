import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawGenericElement,
  NonDeleted,
  TextAlign,
} from "../element/types";
import { measureText } from "../utils";
import { randomInteger, randomId } from "../random";
import { newElementWith } from "./mutateElement";

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
  angle?: ExcalidrawGenericElement["angle"];
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
    angle = 0,
    ...rest
  }: ElementConstructorOpts & Partial<ExcalidrawGenericElement>,
) {
  return {
    id: rest.id || randomId(),
    type,
    x,
    y,
    width,
    height,
    angle,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    roughness,
    opacity,
    seed: rest.seed ?? randomInteger(),
    version: rest.version || 1,
    versionNonce: rest.versionNonce ?? 0,
    isDeleted: false as false,
  };
}

export function newElement(
  opts: {
    type: ExcalidrawGenericElement["type"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawGenericElement> {
  return _newElementBase<ExcalidrawGenericElement>(opts.type, opts);
}

export function newTextElement(
  opts: {
    text: string;
    font: string;
    textAlign: TextAlign;
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawTextElement> {
  const metrics = measureText(opts.text, opts.font);
  const textElement = newElementWith(
    {
      ..._newElementBase<ExcalidrawTextElement>("text", opts),
      text: opts.text,
      font: opts.font,
      textAlign: opts.textAlign,
      // Center the text
      x: opts.x - metrics.width / 2,
      y: opts.y - metrics.height / 2,
      width: metrics.width,
      height: metrics.height,
      baseline: metrics.baseline,
    },
    {},
  );

  return textElement;
}

export function newLinearElement(
  opts: {
    type: ExcalidrawLinearElement["type"];
    lastCommittedPoint?: ExcalidrawLinearElement["lastCommittedPoint"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawLinearElement> {
  return {
    ..._newElementBase<ExcalidrawLinearElement>(opts.type, opts),
    points: [],
    lastCommittedPoint: opts.lastCommittedPoint || null,
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
  copy.id = randomId();
  copy.seed = randomInteger();
  if (overrides) {
    copy = Object.assign(copy, overrides);
  }
  return copy;
}
