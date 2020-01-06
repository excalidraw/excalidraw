import { ExcalidrawElement } from "../element/types";
import { hitTest } from "../element/collision";

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
