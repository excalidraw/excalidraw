import { ExcalidrawElement, ExcalidrawTextElement } from "./types";

type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "seed"
>;

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing.
export function mutateElement(
  element: ExcalidrawElement,
  updates: ElementUpdate<ExcalidrawElement>,
) {
  Object.assign(element, updates);
  (element as any).version++;
}

export function newElementWith(
  element: ExcalidrawElement,
  updates: ElementUpdate<ExcalidrawElement>,
): ExcalidrawElement {
  return { ...element, ...updates, version: element.version + 1 };
}

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same document.
export function mutateTextElement(
  element: ExcalidrawTextElement,
  updates: ElementUpdate<ExcalidrawTextElement>,
): void {
  Object.assign(element, updates);
  (element as any).version++;
}

export function newTextElementWith(
  element: ExcalidrawTextElement,
  updates: ElementUpdate<ExcalidrawTextElement>,
): ExcalidrawTextElement {
  return { ...element, ...updates, version: element.version + 1 };
}
