import { ExcalidrawElement, Versioned, NonDeleted } from "../element/types";
import { getElementAbsoluteCoords } from "../element";
import { AppState } from "../types";
import { newElementWithDeleted } from "../element/mutateElement";

export function getElementsWithinSelection(
  elements: readonly NonDeleted<ExcalidrawElement>[],
  selection: NonDeleted<ExcalidrawElement>,
) {
  const [
    selectionX1,
    selectionY1,
    selectionX2,
    selectionY2,
  ] = getElementAbsoluteCoords(selection);
  return elements.filter(element => {
    const [
      elementX1,
      elementY1,
      elementX2,
      elementY2,
    ] = getElementAbsoluteCoords(element);

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
  elements: readonly Versioned<ExcalidrawElement>[],
  appState: AppState,
) {
  return {
    elements: elements.map(el => {
      if (appState.selectedElementIds[el.id]) {
        return newElementWithDeleted(el, true);
      }
      return el as Versioned<typeof el>;
    }),
    appState: {
      ...appState,
      selectedElementIds: {},
    },
  };
}

export function getSelectedIndices(
  elements: readonly Versioned<ExcalidrawElement>[],
  appState: AppState,
) {
  const selectedIndices: number[] = [];
  elements.forEach((element, index) => {
    if (appState.selectedElementIds[element.id]) {
      selectedIndices.push(index);
    }
  });
  return selectedIndices;
}

export function isSomeElementSelected(
  elements: readonly NonDeleted<ExcalidrawElement>[],
  appState: AppState,
): boolean {
  return elements.some(element => appState.selectedElementIds[element.id]);
}

/**
 * Returns common attribute (picked by `getAttribute` callback) of selected
 *  elements. If elements don't share the same value, returns `null`.
 */
export function getCommonAttributeOfSelectedElements<T>(
  elements: readonly NonDeleted<ExcalidrawElement>[],
  appState: AppState,
  getAttribute: (element: ExcalidrawElement) => T,
): T | null {
  const attributes = Array.from(
    new Set(
      getSelectedElements(elements, appState).map(element =>
        getAttribute(element),
      ),
    ),
  );
  return attributes.length === 1 ? attributes[0] : null;
}

export function getSelectedElements(
  elements: readonly NonDeleted<ExcalidrawElement>[],
  appState: AppState,
): readonly NonDeleted<ExcalidrawElement>[] {
  return elements.filter(element => appState.selectedElementIds[element.id]);
}

export function getTargetElement(
  elements: readonly NonDeleted<ExcalidrawElement>[],
  appState: AppState,
) {
  return appState.editingElement
    ? [appState.editingElement]
    : getSelectedElements(elements, appState);
}
