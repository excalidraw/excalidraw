import { ExcalidrawElement, ExcalidrawTextElement } from "./types";

export function isTextElement(
  element: ExcalidrawElement,
): element is ExcalidrawTextElement {
  return element.type === "text";
}

export function isExcalidrawElement(element: any): boolean {
  return (
    element?.type === "text" ||
    element?.type === "diamond" ||
    element?.type === "rectangle" ||
    element?.type === "ellipse" ||
    element?.type === "arrow" ||
    element?.type === "line"
  );
}
