// Stacking arrows above the elements they bind to.

import type { GlobalPoint } from "@excalidraw/math";

import { isTextElement } from "./typeChecks";
import { getBoundTextElement, getContainerElement } from "./boundText";

import type { Scene } from "./Scene";
import type {
  ExcalidrawArrowElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  OrderedExcalidrawElement,
} from "./types";

/**
 * Moves the arrow element above any bindable elements it intersects with or
 * hovers over.
 */
export const moveArrowAboveBindable = (
  point: GlobalPoint,
  arrow: ExcalidrawArrowElement,
  elements: readonly OrderedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  scene: Scene,
  hoveredElement: NonDeletedExcalidrawElement,
): readonly OrderedExcalidrawElement[] => {
  if (!hoveredElement) {
    return elements;
  }

  const boundTextElement = getBoundTextElement(hoveredElement, elementsMap);
  const containerElement = isTextElement(hoveredElement)
    ? getContainerElement(hoveredElement, elementsMap)
    : null;

  const bindableIds = [
    hoveredElement.id,
    boundTextElement?.id,
    containerElement?.id,
  ].filter((id): id is NonDeletedExcalidrawElement["id"] => !!id);
  const bindableIdx = elements.findIndex((el) => bindableIds.includes(el.id));
  const arrowIdx = elements.findIndex((el) => el.id === arrow.id);

  if (arrowIdx !== -1 && bindableIdx !== -1 && arrowIdx < bindableIdx) {
    const updatedElements = Array.from(elements);
    const arrow = updatedElements.splice(arrowIdx, 1)[0];
    updatedElements.splice(bindableIdx, 0, arrow);

    scene.replaceAllElements(updatedElements);
  }

  return elements;
};
