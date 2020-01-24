import { ExcalidrawElement } from "../element/types";
import { hitTest } from "../element/collision";
import { getElementAbsoluteCoords } from "../element";

export const hasBackground = (elements: readonly ExcalidrawElement[]) =>
  elements.some(
    element =>
      element.isSelected &&
      (element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond"),
  );

export const hasStroke = (elements: readonly ExcalidrawElement[]) =>
  elements.some(
    element =>
      element.isSelected &&
      (element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond" ||
        element.type === "arrow" ||
        element.type === "line"),
  );

export const hasText = (elements: readonly ExcalidrawElement[]) =>
  elements.some(element => element.isSelected && element.type === "text");

export function getElementAtPosition(
  elements: readonly ExcalidrawElement[],
  x: number,
  y: number,
) {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let index = elements.length - 1; index >= 0; --index) {
    if (hitTest(elements[index], x, y)) {
      hitElement = elements[index];
      break;
    }
  }

  return hitElement;
}

export function getElementContainingPosition(
  elements: readonly ExcalidrawElement[],
  x: number,
  y: number,
) {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let index = elements.length - 1; index >= 0; --index) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(elements[index]);
    if (x1 < x && x < x2 && y1 < y && y < y2) {
      hitElement = elements[index];
      break;
    }
  }
  return hitElement;
}
