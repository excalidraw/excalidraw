import { ExcalidrawElement } from "./types";
import { invalidateShapeForElement } from "../renderer/renderElement";
import Scene from "../scene/Scene";
import { getSizeFromPoints } from "../points";
import { randomInteger } from "../random";
import { Point } from "../types";
import { getUpdatedTimestamp } from "../utils";
import { maybeGetCustom } from "./newElement";
import { getCustomMethods } from "../subtypes";

type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "version" | "versionNonce"
>;

const cleanUpdates = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
): ElementUpdate<TElement> => {
  const subtype = maybeGetCustom(element, element.type).subtype;
  const map = getCustomMethods(subtype);
  return map?.clean ? (map.clean(updates) as typeof updates) : updates;
};

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export const mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  informMutation = true,
): TElement => {
  let didChange = false;
  let increment = false;
  const oldUpdates = cleanUpdates(element, updates);

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
            const prevPoint: Point = prevPoints[index];
            const nextPoint: Point = nextPoints[index];
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
    invalidateShapeForElement(element);
  }

  if (increment) {
    element.version++;
    element.versionNonce = randomInteger();
    element.updated = getUpdatedTimestamp();
  }

  if (informMutation) {
    Scene.getScene(element)?.informMutation();
  }

  return element;
};

export const newElementWith = <TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
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

  if (!didChange) {
    return element;
  }

  if (!increment) {
    return { ...element, ...updates };
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
export const bumpVersion = (
  element: Mutable<ExcalidrawElement>,
  version?: ExcalidrawElement["version"],
) => {
  element.version = (version ?? element.version) + 1;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();
  return element;
};
