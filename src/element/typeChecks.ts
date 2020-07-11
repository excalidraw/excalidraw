import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawPathElement,
} from "./types";

export const isTextElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElement => {
  return element != null && element.type === "text";
};

export const isLinearElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawLinearElement => {
  return (
    element != null &&
    (element.type === "arrow" ||
      element.type === "line" ||
      element.type === "draw")
  );
};

<<<<<<< HEAD
export function isPathElement(
  element?: ExcalidrawElement | null,
): element is ExcalidrawPathElement {
  return element != null && element.type === "path";
}

export function isExcalidrawElement(element: any): boolean {
=======
export const isExcalidrawElement = (element: any): boolean => {
>>>>>>> master
  return (
    element?.type === "text" ||
    element?.type === "diamond" ||
    element?.type === "rectangle" ||
    element?.type === "ellipse" ||
    element?.type === "arrow" ||
    element?.type === "draw" ||
    element?.type === "line"
  );
};
