import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
} from "./types";

export const isTextElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElement => {
  return element != null && element.type === "text";
};

export const isLinearElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawLinearElement => {
  return element != null && isLinearElementType(element.type);
};

export const isLinearElementType = (
  elementType: ExcalidrawElement["type"],
): boolean => {
  return (
    elementType === "arrow" || elementType === "line" || elementType === "draw"
  );
};

export const isBindableElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawBindableElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      element.type === "text")
  );
};

export const isExcalidrawElement = (element: any): boolean => {
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
