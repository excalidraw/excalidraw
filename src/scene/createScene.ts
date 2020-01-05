import { ExcalidrawElement, ExcalidrawGroupElement } from "../element/types";

export const createScene = () => {
  const elements: readonly ExcalidrawElement[] = [];
  const groups: readonly ExcalidrawGroupElement[] = [];
  return { elements, groups };
};
