import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { getElementAbsoluteCoords, getElementBounds } from "../element";
import { AppState } from "../types";
import { isBoundToContainer } from "../element/typeChecks";

/**
 * Frames and their containing elements are not to be selected at the same time.
 * Given an array of selected elements, if there are frames and their containing elements
 * we only keep the frames.
 * @param selectedElements
 */
export const excludeElementsInFramesFromSelection = <
  T extends ExcalidrawElement,
>(
  selectedElements: readonly T[],
) => {
  const framesInSelection = new Set<T["id"]>();

  selectedElements.forEach((element) => {
    if (element.type === "frame") {
      framesInSelection.add(element.id);
    }
  });

  return selectedElements.filter((element) => {
    if (element.frameId && framesInSelection.has(element.frameId)) {
      return false;
    }
    return true;
  });
};

export const getElementsWithinSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement,
) => {
  const [selectionX1, selectionY1, selectionX2, selectionY2] =
    getElementAbsoluteCoords(selection);

  let elementsInSelection = elements.filter((element) => {
    const [elementX1, elementY1, elementX2, elementY2] =
      getElementBounds(element);

    return (
      element.locked === false &&
      element.type !== "selection" &&
      !isBoundToContainer(element) &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2
    );
  });

  elementsInSelection =
    excludeElementsInFramesFromSelection(elementsInSelection);

  return elementsInSelection;
};

export const isSomeElementSelected = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
): boolean =>
  elements.some((element) => appState.selectedElementIds[element.id]);

/**
 * Returns common attribute (picked by `getAttribute` callback) of selected
 *  elements. If elements don't share the same value, returns `null`.
 */
export const getCommonAttributeOfSelectedElements = <T>(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
): T | null => {
  const attributes = Array.from(
    new Set(
      getSelectedElements(elements, appState).map((element) =>
        getAttribute(element),
      ),
    ),
  );
  return attributes.length === 1 ? attributes[0] : null;
};

export const getSelectedElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  includeBoundTextElement: boolean = false,
) =>
  elements.filter((element) => {
    if (appState.selectedElementIds[element.id]) {
      return element;
    }
    if (
      includeBoundTextElement &&
      isBoundToContainer(element) &&
      appState.selectedElementIds[element?.containerId]
    ) {
      return element;
    }
    return null;
  });

export const getTargetElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) =>
  appState.editingElement
    ? [appState.editingElement]
    : getSelectedElements(elements, appState, true);
