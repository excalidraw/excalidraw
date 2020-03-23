import { ExcalidrawElement } from "./types";
import { invalidateShapeForElement } from "../renderer/renderElement";
import { globalSceneState } from "../scene";
import { getSizeFromPoints } from "../points";
import { randomInteger } from "../random";

type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "seed"
>;

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export function mutateElement<TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
) {
  // casting to any because can't use `in` operator
  // (see https://github.com/microsoft/TypeScript/issues/21732)
  const { points } = updates as any;

  if (typeof points !== "undefined") {
    updates = { ...getSizeFromPoints(points), ...updates };
  }

  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      // @ts-ignore
      element[key] = value;
    }
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
}

export function newElementWith<TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
): TElement {
  return {
    ...element,
    version: element.version + 1,
    versionNonce: randomInteger(),
    ...updates,
  };
}
