import { ExcalidrawElement } from "./types";
import { invalidateShapeForElement } from "../renderer/renderElement";

export function isInvisiblySmallElement(element: ExcalidrawElement): boolean {
  if (element.type === "arrow" || element.type === "line") {
    return element.points.length < 2;
  }
  return element.width === 0 && element.height === 0;
}

/**
 * Makes a perfect shape or diagonal/horizontal/vertical line
 */
export function getPerfectElementSize(
  elementType: string,
  width: number,
  height: number,
): { width: number; height: number } {
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

  return { width, height };
}

export function resizePerfectLineForNWHandler(
  element: ExcalidrawElement,
  x: number,
  y: number,
) {
  const anchorX = element.x + element.width;
  const anchorY = element.y + element.height;
  const distanceToAnchorX = x - anchorX;
  const distanceToAnchorY = y - anchorY;
  if (Math.abs(distanceToAnchorX) < Math.abs(distanceToAnchorY) / 2) {
    element.x = anchorX;
    element.width = 0;
    element.y = y;
    element.height = -distanceToAnchorY;
  } else if (Math.abs(distanceToAnchorY) < Math.abs(element.width) / 2) {
    element.y = anchorY;
    element.height = 0;
  } else {
    element.x = x;
    element.width = -distanceToAnchorX;
    element.height =
      Math.sign(distanceToAnchorY) *
      Math.sign(distanceToAnchorX) *
      element.width;
    element.y = anchorY - element.height;
  }
}

/**
 * @returns {boolean} whether element was normalized
 */
export function normalizeDimensions(
  element: ExcalidrawElement | null,
): element is ExcalidrawElement {
  if (
    !element ||
    (element.width >= 0 && element.height >= 0) ||
    element.type === "line" ||
    element.type === "arrow"
  ) {
    return false;
  }

  if (element.width < 0) {
    element.width = Math.abs(element.width);
    element.x -= element.width;
  }

  if (element.height < 0) {
    element.height = Math.abs(element.height);
    element.y -= element.height;
  }

  invalidateShapeForElement(element);

  return true;
}
