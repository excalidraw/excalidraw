import type { Radians } from "@excalidraw/math";

import { getSizeFromPoints } from "../points";
import { randomInteger } from "../random";
import Scene from "../scene/Scene";
import { ShapeCache } from "../scene/ShapeCache";
import { getUpdatedTimestamp, toBrandedType } from "../utils";

import { updateElbowArrowPoints } from "./elbowArrow";
import { isElbowArrow } from "./typeChecks";

import type { ExcalidrawElement, NonDeletedSceneElementsMap } from "./types";
import type { Mutable } from "../utility-types";

export type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "version" | "versionNonce" | "updated"
>;

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export const mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  informMutation = true,
  options?: {
    // Currently only for elbow arrows.
    // If true, the elbow arrow tries to bind to the nearest element. If false
    // it tries to keep the same bound element, if any.
    isDragging?: boolean;
  },
): TElement => {
  let didChange = false;

  // casting to any because can't use `in` operator
  // (see https://github.com/microsoft/TypeScript/issues/21732)
  const { points, fixedSegments, fileId, startBinding, endBinding } =
    updates as any;

  if (
    isElbowArrow(element) &&
    (Object.keys(updates).length === 0 || // normalization case
      typeof points !== "undefined" || // repositioning
      typeof fixedSegments !== "undefined" || // segment fixing
      typeof startBinding !== "undefined" ||
      typeof endBinding !== "undefined") // manual binding to element
  ) {
    const elementsMap = toBrandedType<NonDeletedSceneElementsMap>(
      Scene.getScene(element)?.getNonDeletedElementsMap() ?? new Map(),
    );

    updates = {
      ...updates,
      angle: 0 as Radians,
      ...updateElbowArrowPoints(
        {
          ...element,
          x: updates.x || element.x,
          y: updates.y || element.y,
        },
        elementsMap,
        {
          fixedSegments,
          points,
          startBinding,
          endBinding,
        },
        {
          isDragging: options?.isDragging,
        },
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

  if (informMutation) {
    Scene.getScene(element)?.triggerUpdate();
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
