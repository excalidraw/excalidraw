import { ExcalidrawElement } from "../element/types";
import { getElementAbsoluteCoords } from "../element";

export function getElementsWithinSelection(
  elements: readonly ExcalidrawElement[],
  selection: ExcalidrawElement
) {
  const [
    selectionX1,
    selectionY1,
    selectionX2,
    selectionY2
  ] = getElementAbsoluteCoords(selection);
  return elements.filter(element => {
    const [
      elementX1,
      elementY1,
      elementX2,
      elementY2
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

export function clearSelection(elements: readonly ExcalidrawElement[]) {
  const newElements = [...elements];

  newElements.forEach(element => {
    element.isSelected = false;
  });

  return newElements;
}

export function deleteSelectedElements(elements: readonly ExcalidrawElement[]) {
  return elements.filter(el => !el.isSelected);
}

export function getSelectedIndices(elements: readonly ExcalidrawElement[]) {
  const selectedIndices: number[] = [];
  elements.forEach((element, index) => {
    if (element.isSelected) {
      selectedIndices.push(index);
    }
  });
  return selectedIndices;
}

export const someElementIsSelected = (elements: readonly ExcalidrawElement[]) =>
  elements.some(element => element.isSelected);

/**
 * Returns common attribute (picked by `getAttribute` callback) of selected
 *  elements. If elements don't share the same value, returns `null`.
 */
export function getCommonAttributeOfSelectedElements<T>(
  elements: readonly ExcalidrawElement[],
  getAttribute: (element: ExcalidrawElement) => T
): T | null {
  const attributes = Array.from(
    new Set(
      elements
        .filter(element => element.isSelected)
        .map(element => getAttribute(element))
    )
  );
  return attributes.length === 1 ? attributes[0] : null;
}
