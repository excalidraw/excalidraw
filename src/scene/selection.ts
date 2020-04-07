import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { getElementAbsoluteCoords, getElementBounds } from "../element";
import { AppState } from "../types";
import { newElementWith } from "../element/mutateElement";

export function getElementsWithinSelection(
  elements: readonly NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement,
) {
  const [
    selectionX1,
    selectionY1,
    selectionX2,
    selectionY2,
  ] = getElementAbsoluteCoords(selection);
  return elements.filter((element) => {
    const [elementX1, elementY1, elementX2, elementY2] = getElementBounds(
      element,
    );

    return (
      element.type !== "selection" &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2
    );
  });
}

export function deleteSelectedElements(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  return {
    elements: elements.map((el) => {
      if (appState.selectedElementIds[el.id]) {
        return newElementWith(el, { isDeleted: true });
      }
      return el;
    }),
    appState: {
      ...appState,
      selectedElementIds: {},
    },
  };
}

export function isSomeElementSelected(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
): boolean {
  return elements.some((element) => appState.selectedElementIds[element.id]);
}

/**
 * Returns common attribute (picked by `getAttribute` callback) of selected
 *  elements. If elements don't share the same value, returns `null`.
 */
export function getCommonAttributeOfSelectedElements<T>(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
): T | null {
  const attributes = Array.from(
    new Set(
      getSelectedElements(elements, appState).map((element) =>
        getAttribute(element),
      ),
    ),
  );
  return attributes.length === 1 ? attributes[0] : null;
}

export function getSelectedElements(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) {
  return elements.filter((element) => appState.selectedElementIds[element.id]);
}

export function getTargetElement(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) {
  return appState.editingElement
    ? [appState.editingElement]
    : getSelectedElements(elements, appState);
}
