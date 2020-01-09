import { ExcalidrawElement } from "../element/types";
import { getElementAbsoluteCoords } from "../element";
import { testLineSegmentIntersect } from "../math";

export function setSelection(
  elements: ExcalidrawElement[],
  selection: ExcalidrawElement
) {
  const [
    selectionX1,
    selectionY1,
    selectionX2,
    selectionY2
  ] = getElementAbsoluteCoords(selection);
  elements.forEach(element => {
    const [
      elementX1,
      elementY1,
      elementX2,
      elementY2
    ] = getElementAbsoluteCoords(element);
    if (element.type === "selection") {
      element.isSelected = false;
    } else if (element.type === "arrow") {
      if (
        selectionX1 < elementX1 &&
        selectionX2 > elementX2 &&
        selectionY1 < elementY1 &&
        selectionY2 > elementY2
      ) {
        element.isSelected = true;
      } else {
        // lt -> lb
        const line1 = {
          x1: selectionX1,
          y1: selectionY1,
          x2: selectionX1,
          y2: selectionY2
        };

        // rt -> rb
        const line2 = {
          x1: selectionX2,
          y1: selectionY1,
          x2: selectionX2,
          y2: selectionY2
        };

        // lt -> rt
        const line3 = {
          x1: selectionX1,
          y1: selectionY1,
          x2: selectionX2,
          y2: selectionY1
        };

        // lb -> rb
        const line4 = {
          x1: selectionX1,
          y1: selectionY2,
          x2: selectionX2,
          y2: selectionY2
        };

        const target = {
          x1: elementX1,
          y1: elementY1,
          x2: elementX2,
          y2: elementY2
        };

        element.isSelected =
          testLineSegmentIntersect(line1, target) ||
          testLineSegmentIntersect(line2, target) ||
          testLineSegmentIntersect(line3, target) ||
          testLineSegmentIntersect(line4, target);
      }
    } else {
      element.isSelected = !(
        (selectionX1 < elementX1 && selectionX2 < elementX1) ||
        (selectionX1 > elementX2 && selectionX2 > elementX2) ||
        (selectionY1 < elementY1 && selectionY2 < elementY1) ||
        (selectionY1 > elementY2 && selectionY2 > elementY2)
      );
    }
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
