import {
  getSizeFromPoints,
  randomInteger,
  getUpdatedTimestamp,
} from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

import type { Mutable } from "@excalidraw/common/utility-types";

import { ShapeCache } from "./ShapeCache";

import {
  elbowArrowNeedsToGetNormalized,
  updateElbowArrowPoints,
} from "./elbowArrow";

import type {
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "./types";

export type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "version" | "versionNonce" | "updated"
>;

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this won't trigger the component to update, unlike `scene.mutate`.
export const mutateElementWith = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  elementsMap: Map<string, ExcalidrawElement>,
  updates: ElementUpdate<TElement>,
  options?: {
    isDragging?: boolean;
  },
) => {
  if (
    elbowArrowNeedsToGetNormalized(
      element,
      updates as ElementUpdate<ExcalidrawElbowArrowElement>,
    )
  ) {
    const normalizedUpdates = {
      ...updates,
      angle: 0 as Radians,
      ...updateElbowArrowPoints(
        element as ExcalidrawElbowArrowElement,
        elementsMap as NonDeletedSceneElementsMap,
        updates as ElementUpdate<ExcalidrawElbowArrowElement>,
        options,
      ),
    } as ElementUpdate<ExcalidrawElbowArrowElement>;

    return mutateElement(
      element as ExcalidrawElbowArrowElement,
      normalizedUpdates,
    );
  }

  return mutateElement(element, updates);
};

/**
 * This function tracks updates of text elements for the purposes for collaboration.
 * The version is used to compare updates when more than one user is working in
 * the same drawing.
 *
 * @deprecated Use `scene.mutate` as direct equivalent, or  `mutateElementWith` in case you don't need to trigger component update.
 */
export const mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
): TElement => {
  let didChange = false;

  // casting to any because can't use `in` operator
  // (see https://github.com/microsoft/TypeScript/issues/21732)
  const { points, fileId } = updates as any;

  if (typeof points !== "undefined") {
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
            continue;
          }
        }
      }

      (element as any)[key] = value;
      didChange = true;
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

  element.version++;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();

  return element;
};

export const newElementWith = <TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  /** pass `true` to always regenerate */
  force = false,
): TElement => {
  let didChange = false;
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
    }
  }

  if (!didChange && !force) {
    return element;
  }

  return {
    ...element,
    ...updates,
    updated: getUpdatedTimestamp(),
    version: element.version + 1,
    versionNonce: randomInteger(),
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
