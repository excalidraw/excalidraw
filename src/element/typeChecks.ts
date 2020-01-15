import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawArrowElement
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
