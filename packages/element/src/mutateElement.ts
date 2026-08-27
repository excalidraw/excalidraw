import {
  getSizeFromPoints,
  randomInteger,
  getUpdatedTimestamp,
} from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

import type { Mutable } from "@excalidraw/common/utility-types";

import { ShapeCache } from "./shape";
import { maybeGetSubtypeProps } from "./newElement";
import { getSubtypeMethods } from "./subtypes";

import { updateElbowArrowPoints } from "./elbowArrow";

import { isElbowArrow } from "./typeChecks";

import type {
  ElementsMap,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "./types";

export type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "updated"
>;

const cleanUpdates = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
): ElementUpdate<TElement> => {
  const subtype = maybeGetSubtypeProps(element, element.type).subtype;
  const map = getSubtypeMethods(subtype);
  return map?.clean ? (map.clean(updates) as typeof updates) : updates;
};

/**
 * This function tracks updates of text elements for the purposes for collaboration.
 * The version is used to compare updates when more than one user is working in
 * the same drawing.
 *
 * WARNING: this won't trigger the component to update, so if you need to trigger component update,
 * use `scene.mutateElement` or `ExcalidrawImperativeAPI.mutateElement` instead.
 */
export const mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  elementsMap: ElementsMap,
  updates: ElementUpdate<TElement>,
  options?: {
    isDragging?: boolean;
  },
) => {
  let didChange = false;
  let increment = false;
  const oldUpdates = cleanUpdates(element, updates);

  // casting to any because can't use `in` operator
  // (see https://github.com/microsoft/TypeScript/issues/21732)
  const { points, fixedSegments, startBinding, endBinding, fileId } =
    updates as any;

  if (
    isElbowArrow(element) &&
    (Object.keys(updates).length === 0 || // normalization case
      typeof points !== "undefined" || // repositioning
      typeof fixedSegments !== "undefined" || // segment fixing
      typeof startBinding !== "undefined" ||
      typeof endBinding !== "undefined") // manual binding to element
  ) {
    updates = {
      ...updates,
      angle: 0 as Radians,
      ...updateElbowArrowPoints(
        {
          ...element,
          x: updates.x || element.x,
          y: updates.y || element.y,
        },
        elementsMap as NonDeletedSceneElementsMap,
        updates as ElementUpdate<ExcalidrawElbowArrowElement>,
        options,
      ),
    };
  } else if (typeof points !== "undefined") {
    updates = { ...getSizeFromPoints(points), ...updates };
  }

  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      if (
        (element as any)[key] === value &&
        // if object, always update because its attrs could have changed
        // (except for specific keys we handle below)
        (typeof value !== "object" ||
          value === null ||
          key === "groupIds" ||
          key === "scale")
      ) {
        continue;
      }

      if (key === "scale") {
        const prevScale = (element as any)[key];
        const nextScale = value;
        if (prevScale[0] === nextScale[0] && prevScale[1] === nextScale[1]) {
          continue;
        }
      } else if (key === "points") {
        const prevPoints = (element as any)[key];
        const nextPoints = value;
        if (prevPoints.length === nextPoints.length) {
          let didChangePoints = false;
          let index = prevPoints.length;
          while (--index) {
            const prevPoint = prevPoints[index];
            const nextPoint = nextPoints[index];
            if (
              prevPoint[0] !== nextPoint[0] ||
              prevPoint[1] !== nextPoint[1]
            ) {
              didChangePoints = true;
              break;
            }
          }
          if (!didChangePoints) {
            key in oldUpdates && (increment = true);
            continue;
          }
        }
      }

      (element as any)[key] = value;
      didChange = true;
      key in oldUpdates && (increment = true);
    }
  }

  if (!didChange) {
    return element;
  }

  if (
    typeof updates.height !== "undefined" ||
    typeof updates.width !== "undefined" ||
    typeof fileId != "undefined" ||
    typeof points !== "undefined"
  ) {
    ShapeCache.delete(element);
  }

  if (increment) {
    element.version = updates.version ?? element.version + 1;
    element.versionNonce = updates.versionNonce ?? randomInteger();
    element.updated = getUpdatedTimestamp();
  }

  return element;
};

export const newElementWith = <TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  /** pass `true` to always regenerate */
  force = false,
): TElement => {
  let didChange = false;
  let increment = false;
  const oldUpdates = cleanUpdates(element, updates);
  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      if (
        (element as any)[key] === value &&
        // if object, always update because its attrs could have changed
        (typeof value !== "object" || value === null)
      ) {
        continue;
      }
      didChange = true;
      key in oldUpdates && (increment = true);
    }
  }

  if (!didChange && !force) {
    return element;
  }

  if (!increment) {
    return { ...element, ...updates };
  }
  return {
    ...element,
    ...updates,
    version: updates.version ?? element.version + 1,
    versionNonce: updates.versionNonce ?? randomInteger(),
    updated: getUpdatedTimestamp(),
  };
};

/**
 * Mutates element, bumping `version`, `versionNonce`, and `updated`.
 *
 * NOTE: does not trigger re-render.
 */
export const bumpVersion = <T extends Mutable<ExcalidrawElement>>(
  element: T,
  version?: ExcalidrawElement["version"],
) => {
  element.version = (version ?? element.version) + 1;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();
  return element;
};
