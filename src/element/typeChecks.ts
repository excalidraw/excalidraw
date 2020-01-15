import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawArrowElement,
  ExcalidrawLineElement
} from "./types";

export function isTextElement(
  element: ExcalidrawElement
): element is ExcalidrawTextElement {
  return element.type === "text";
}

export function isArrowElement(
  element: ExcalidrawElement
): element is ExcalidrawArrowElement {
  return element.type === "arrow";
}

export function isLineElement(
  element: ExcalidrawElement
): element is ExcalidrawLineElement {
  return element.type === "line";
}
