import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
} from "./types";

export const isTextElement = (
  element: ExcalidrawElement,
): element is ExcalidrawTextElement => element.type === "text";

export const isLinearElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawLinearElement =>
  element != null && (element.type === "arrow" || element.type === "line");

export const isExcalidrawElement = (element: any): boolean =>
  element?.type === "text" ||
  element?.type === "diamond" ||
  element?.type === "rectangle" ||
  element?.type === "ellipse" ||
  element?.type === "arrow" ||
  element?.type === "line";
