import { ExcalidrawElement } from "./types";

export function isInvisiblySmallElement(element: ExcalidrawElement): boolean {
  return element.width === 0 && element.height === 0;
}

/**
 * Makes a perfect shape or diagonal/horizontal/vertical line
 * when shift key is pressed.
 */
export function getDraggingElementSize(
  elementType: string,
  shiftKeyPressed: boolean,
  width: number,
  height: number
): { width: number; height: number } {
  if (shiftKeyPressed) {
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);

    if (elementType === "line" || elementType === "arrow") {
      if (absHeight < absWidth / 2) {
        height = 0;
      } else if (absWidth < absHeight / 2) {
        width = 0;
      } else {
        height = absWidth * Math.sign(height);
      }
    } else if (elementType !== "selection") {
      height = absWidth * Math.sign(height);
    }
  }
  return { width, height };
}
