import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawGenericElement,
  NonDeleted,
  TextAlign,
  FontFamily,
  GroupId,
} from "../element/types";
import { measureText, getFontString } from "../utils";
import { randomInteger, randomId } from "../random";
import { newElementWith } from "./mutateElement";
import { getNewGroupIdsForDuplication } from "../groups";
import { AppState } from "../types";

type ElementConstructorOpts = MarkOptional<
  Omit<ExcalidrawGenericElement, "id" | "type" | "isDeleted">,
  | "width"
  | "height"
  | "angle"
  | "groupIds"
  | "seed"
  | "version"
  | "versionNonce"
>;

const _newElementBase = <T extends ExcalidrawElement>(
  type: T["type"],
  {
    x,
    y,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    strokeStyle,
    roughness,
    opacity,
    width = 0,
    height = 0,
    angle = 0,
    groupIds = [],
    ...rest
  }: ElementConstructorOpts & Omit<Partial<ExcalidrawGenericElement>, "type">,
) => ({
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
  strokeStyle,
  roughness,
  opacity,
  groupIds,
  seed: rest.seed ?? randomInteger(),
  version: rest.version || 1,
  versionNonce: rest.versionNonce ?? 0,
  isDeleted: false as false,
});

export const newElement = (
  opts: {
    type: ExcalidrawGenericElement["type"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawGenericElement> =>
  _newElementBase<ExcalidrawGenericElement>(opts.type, opts);

export const newTextElement = (
  opts: {
    text: string;
    fontSize: number;
    fontFamily: FontFamily;
    textAlign: TextAlign;
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawTextElement> => {
  const metrics = measureText(opts.text, getFontString(opts));
  const textElement = newElementWith(
    {
      ..._newElementBase<ExcalidrawTextElement>("text", opts),
      text: opts.text,
      fontSize: opts.fontSize,
      fontFamily: opts.fontFamily,
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
};

export const newLinearElement = (
  opts: {
    type: ExcalidrawLinearElement["type"];
    lastCommittedPoint?: ExcalidrawLinearElement["lastCommittedPoint"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawLinearElement> => {
  return {
    ..._newElementBase<ExcalidrawLinearElement>(opts.type, opts),
    points: [],
    lastCommittedPoint: opts.lastCommittedPoint || null,
  };
};

// Simplified deep clone for the purpose of cloning ExcalidrawElement only
//  (doesn't clone Date, RegExp, Map, Set, Typed arrays etc.)
//
// Adapted from https://github.com/lukeed/klona
export const deepCopyElement = (val: any, depth: number = 0) => {
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
        tmp[key] = deepCopyElement(val[key], depth + 1);
      }
    }
    return tmp;
  }

  if (Array.isArray(val)) {
    let k = val.length;
    const arr = new Array(k);
    while (k--) {
      arr[k] = deepCopyElement(val[k], depth + 1);
    }
    return arr;
  }

  return val;
};

/**
 * Duplicate an element, often used in the alt-drag operation.
 * Note that this method has gotten a bit complicated since the
 * introduction of gruoping/ungrouping elements.
 * @param editingGroupId The current group being edited. The new
 *                       element will inherit this group and its
 *                       parents.
 * @param groupIdMapForOperation A Map that maps old group IDs to
 *                               duplicated ones. If you are duplicating
 *                               multiple elements at once, share this map
 *                               amongst all of them
 * @param element Element to duplicate
 * @param overrides Any element properties to override
 */
export const duplicateElement = <TElement extends Mutable<ExcalidrawElement>>(
  editingGroupId: AppState["editingGroupId"],
  groupIdMapForOperation: Map<GroupId, GroupId>,
  element: TElement,
  overrides?: Partial<TElement>,
): TElement => {
  let copy: TElement = deepCopyElement(element);
  copy.id = randomId();
  copy.seed = randomInteger();
  copy.groupIds = getNewGroupIdsForDuplication(
    copy.groupIds,
    editingGroupId,
    (groupId) => {
      if (!groupIdMapForOperation.has(groupId)) {
        groupIdMapForOperation.set(groupId, randomId());
      }
      return groupIdMapForOperation.get(groupId)!;
    },
  );
  if (overrides) {
    copy = Object.assign(copy, overrides);
  }
  return copy;
};
