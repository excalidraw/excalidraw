import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { getElementAbsoluteCoords, getElementBounds } from "../element";
import { AppState } from "../types";
import { isLinearElement } from "../element/typeChecks";

export const getElementsWithinSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement,
) => {
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
) => elements.filter((element) => appState.selectedElementIds[element.id]);

export const getTargetElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) =>
  appState.editingElement
    ? [appState.editingElement]
    : getSelectedElements(elements, appState);

export const getSelectedPoint = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  if (appState.editingLinearElement?.activePointIndex != null) {
    const selectedElements = getSelectedElements(elements, appState);

    if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
      return selectedElements[0].points[
        appState.editingLinearElement.activePointIndex
      ];
    }
  }

  return null;
};
