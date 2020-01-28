import { ExcalidrawElement } from "../element/types";
import { hitTest } from "../element/collision";
import { getElementAbsoluteCoords } from "../element";

export const hasBackground = (type: string) =>
  type === "rectangle" || type === "ellipse" || type === "diamond";

export const hasStroke = (type: string) =>
  type === "rectangle" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "arrow" ||
  type === "line";

export const hasText = (type: string) => type === "text";

export function getElementAtPosition(
  elements: readonly ExcalidrawElement[],
  x: number,
  y: number,
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
  elements: readonly ExcalidrawElement[],
  x: number,
  y: number,
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
