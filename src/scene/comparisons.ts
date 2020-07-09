import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";

import { getElementAbsoluteCoords, hitTest } from "../element";
import { AppState } from "../types";

export const hasBackground = (type: string) =>
  type === "rectangle" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "draw" ||
  type === "line";

export const hasStroke = (type: string) =>
  type === "rectangle" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "arrow" ||
  type === "draw" ||
  type === "line";

export const hasText = (type: string) => type === "text";

export const getElementAtPosition = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  x: number,
  y: number,
  isAtPositionFn: (
    element: NonDeletedExcalidrawElement,
    appState: AppState,
    x: number,
    y: number,
  ) => boolean = hitTest,
) => {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let i = elements.length - 1; i >= 0; --i) {
    const element = elements[i];
    if (element.isDeleted) {
      continue;
    }
    if (isAtPositionFn(element, appState, x, y)) {
      hitElement = element;
      break;
    }
  }

  return hitElement;
};

export const getElementContainingPosition = (
  elements: readonly ExcalidrawElement[],
  x: number,
  y: number,
) => {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let i = elements.length - 1; i >= 0; --i) {
    if (elements[i].isDeleted) {
      continue;
    }
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(elements[i]);
    if (x1 < x && x < x2 && y1 < y && y < y2) {
      hitElement = elements[i];
      break;
    }
  }
  return hitElement;
};
