import {
  MutableExcalidrawElement,
  MutableExcalidrawTextElement,
} from "./types";

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing.
export function mutateElement(
  element: MutableExcalidrawElement,
  callback: (mutatableElement: MutableExcalidrawElement) => void,
): void {
  element.version++;
  callback(element);
}

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same document.
export function mutateTextElement(
  element: MutableExcalidrawTextElement,
  callback: (mutatableElement: MutableExcalidrawTextElement) => void,
): void {
  element.version++;
  callback(element);
}
