// Lookups between text containers and their bound text. A leaf module so that
// modules needing only these lookups don't depend on text layout.

import { isNonDeletedElement } from "./sceneElements";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  NonDeleted,
} from "./types";

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.length
    ? container?.boundElements?.find((ele) => ele.type === "text")?.id || null
    : null;
};

export const getBoundTextElement = (
  element: ExcalidrawElement | null,
  elementsMap: ElementsMap,
): NonDeleted<ExcalidrawTextElementWithContainer> | null => {
  if (!element) {
    return null;
  }
  const boundTextElementId = getBoundTextElementId(element);

  if (boundTextElementId) {
    const boundTextElement = (elementsMap.get(boundTextElementId) ||
      null) as NonDeleted<ExcalidrawTextElementWithContainer> | null;

    // SAFETY: This should never happen, but log it just in case
    if (boundTextElement && !isNonDeletedElement(boundTextElement)) {
      console.error(
        "[NONDELETED][INVARIANT] Bound text element `isDeleted: true` which is not expected.",
      );
    }

    return boundTextElement;
  }
  return null;
};

export const getContainerElement = <
  T extends ExcalidrawTextElement,
  R extends ExcalidrawTextContainer,
>(
  element: T | null,
  elementsMap: ElementsMap,
): R | null => {
  if (!element) {
    return null;
  }
  if (element.containerId) {
    return (elementsMap.get(element.containerId) || null) as R | null;
  }
  return null;
};
