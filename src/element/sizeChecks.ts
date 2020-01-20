import { ExcalidrawElement } from "./types";

export function isInvisiblySmallElement(element: ExcalidrawElement): boolean {
  return element.width === 0 && element.height === 0;
}
