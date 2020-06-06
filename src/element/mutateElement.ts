import { ExcalidrawElement } from "./types";
import { invalidateShapeForElement } from "../renderer/renderElement";
import { globalSceneState } from "../scene";
import { getSizeFromPoints } from "../points";
import { randomInteger } from "../random";
import { Point } from "../types";

type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "seed" | "version" | "versionNonce"
>;

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export const mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
) => {
  let didChange = false;

  // casting to any because can't use `in` operator
  // (see https://github.com/microsoft/TypeScript/issues/21732)
  const { points } = updates as any;

  if (typeof points !== "undefined") {
    updates = { ...getSizeFromPoints(points), ...updates };
  }

  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      if (
        (element as any)[key] === value &&
        // if object, always update in case its deep prop was mutated
        (typeof value !== "object" || value === null || key === "groupIds")
      ) {
        continue;
      }

      if (key === "points") {
        const prevPoints = (element as any)[key];
        const nextPoints = value;
        if (prevPoints.length === nextPoints.length) {
          let didChangePoints = false;
          let i = prevPoints.length;
          while (--i) {
            const prevPoint: Point = prevPoints[i];
            const nextPoint: Point = nextPoints[i];
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
    return;
  }

  if (
    typeof updates.height !== "undefined" ||
    typeof updates.width !== "undefined" ||
    typeof points !== "undefined"
  ) {
    invalidateShapeForElement(element);
  }

  element.version++;
  element.versionNonce = randomInteger();

  globalSceneState.informMutation();
};

export const newElementWith = <TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
): TElement => ({
  ...element,
  ...updates,
  version: element.version + 1,
  versionNonce: randomInteger(),
});
