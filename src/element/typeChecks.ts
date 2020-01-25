import { ExcalidrawElement, ExcalidrawTextElement } from "./types";

export function isTextElement(
  element: ExcalidrawElement,
): element is ExcalidrawTextElement {
  return element.type === "text";
}
