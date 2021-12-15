import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
  ExcalidrawGenericElement,
  ExcalidrawFreeDrawElement,
  InitializedExcalidrawImageElement,
  ExcalidrawImageElement,
  ExcalidrawRectangleElement,
  ExcalidrawTextElementWithContainer,
} from "./types";

export const isGenericElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawGenericElement => {
  return (
    element != null &&
    (element.type === "selection" ||
      element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse")
  );
};

export const isInitializedImageElement = (
  element: ExcalidrawElement | null,
): element is InitializedExcalidrawImageElement => {
  return !!element && element.type === "image" && !!element.fileId;
};

export const isImageElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawImageElement => {
  return !!element && element.type === "image";
};

export const isTextElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElement => {
  return element != null && element.type === "text";
};

export const isFreeDrawElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawFreeDrawElement => {
  return element != null && isFreeDrawElementType(element.type);
};

export const isFreeDrawElementType = (
  elementType: ExcalidrawElement["type"],
): boolean => {
  return elementType === "freedraw";
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
    elementType === "arrow" || elementType === "line" // || elementType === "freedraw"
  );
};

export const isBindingElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawLinearElement => {
  return element != null && isBindingElementType(element.type);
};

export const isBindingElementType = (
  elementType: ExcalidrawElement["type"],
): boolean => {
  return elementType === "arrow";
};

export const isBindableElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawBindableElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      element.type === "image" ||
      (element.type === "text" && !element.containerId))
  );
};

export const isExcalidrawElement = (element: any): boolean => {
  return (
    element?.type === "text" ||
    element?.type === "diamond" ||
    element?.type === "rectangle" ||
    element?.type === "ellipse" ||
    element?.type === "arrow" ||
    element?.type === "freedraw" ||
    element?.type === "line"
  );
};

export const isRectangleElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawRectangleElement => {
  return element != null && element.type === "rectangle";
};

export const hasBoundTextElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawBindableElement => {
  return (
    isBindableElement(element) &&
    !!element.boundElements?.filter(({ type }) => type === "text").length
  );
};

export const isBoundByContainer = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElementWithContainer => {
  return (
    element !== null && isTextElement(element) && element.containerId !== null
  );
};

export const getBoundTextElementId = (element: ExcalidrawBindableElement) => {
  return element.boundElements!.filter((ele) => ele.type === "text")[0].id;
};
