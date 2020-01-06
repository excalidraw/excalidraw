import { ExcalidrawElement } from "../element/types";
import {
  getElementAbsoluteX1,
  getElementAbsoluteX2,
  getElementAbsoluteY1,
  getElementAbsoluteY2
} from "../element";

export function setSelection(
  elements: ExcalidrawElement[],
  selection: ExcalidrawElement
) {
  const selectionX1 = getElementAbsoluteX1(selection);
  const selectionX2 = getElementAbsoluteX2(selection);
  const selectionY1 = getElementAbsoluteY1(selection);
  const selectionY2 = getElementAbsoluteY2(selection);
  elements.forEach(element => {
    const elementX1 = getElementAbsoluteX1(element);
    const elementX2 = getElementAbsoluteX2(element);
    const elementY1 = getElementAbsoluteY1(element);
    const elementY2 = getElementAbsoluteY2(element);
    element.isSelected =
      element.type !== "selection" &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2;
  });
}

export function clearSelection(elements: ExcalidrawElement[]) {
  elements.forEach(element => {
    element.isSelected = false;
  });
}

export function deleteSelectedElements(elements: ExcalidrawElement[]) {
  for (let i = elements.length - 1; i >= 0; --i) {
    if (elements[i].isSelected) {
      elements.splice(i, 1);
    }
  }
}

export function getSelectedIndices(elements: ExcalidrawElement[]) {
  const selectedIndices: number[] = [];
  elements.forEach((element, index) => {
    if (element.isSelected) {
      selectedIndices.push(index);
    }
  });
  return selectedIndices;
}

export const someElementIsSelected = (elements: ExcalidrawElement[]) =>
  elements.some(element => element.isSelected);

export function getSelectedAttribute<T>(
  elements: ExcalidrawElement[],
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
