import {
  MutableExcalidrawElement,
  MutableExcalidrawTextElement,
} from "./types";

export function mutateElement(
  element: MutableExcalidrawElement,
  callback: (mutatableElement: MutableExcalidrawElement) => void,
): void {
  element.version++;
  callback(element);
}

export function mutateTextElement(
  element: MutableExcalidrawTextElement,
  callback: (mutatableElement: MutableExcalidrawTextElement) => void,
): void {
  element.version++;
  callback(element);
}
