import { ExcalidrawElement } from "../element/types";
import { hitTest } from "../element/collision";
import { getElementAbsoluteCoords } from "../element";

export const hasBackground = (elements: ExcalidrawElement[]) =>
  elements.some(
    element =>
      element.isSelected &&
      (element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond")
  );

export const hasStroke = (elements: ExcalidrawElement[]) =>
  elements.some(
    element =>
      element.isSelected &&
      (element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond" ||
        element.type === "arrow")
  );

export const hasText = (elements: ExcalidrawElement[]) =>
  elements.some(element => element.isSelected && element.type === "text");

export function getElementAtPosition(
  elements: ExcalidrawElement[],
  x: number,
  y: number
) {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let i = elements.length - 1; i >= 0; --i) {
    if (hitTest(elements[i], x, y)) {
      hitElement = elements[i];
      break;
    }
  }

  return hitElement;
}

export function getElementContainingPosition(
  elements: ExcalidrawElement[],
  x: number,
  y: number
) {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let i = elements.length - 1; i >= 0; --i) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(elements[i]);
    if (x1 < x && x < x2 && y1 < y && y < y2) {
      hitElement = elements[i];
      break;
    }
  }
  return hitElement;
}
