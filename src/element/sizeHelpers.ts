import { ExcalidrawElement } from "./types";
import { mutateElement } from "./mutateElement";
import { isLinearElement } from "./typeChecks";
import { SHIFT_LOCKING_ANGLE } from "../constants";

export function isInvisiblySmallElement(element: ExcalidrawElement): boolean {
  if (isLinearElement(element)) {
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

  if (
    elementType === "line" ||
    elementType === "arrow" ||
    elementType === "draw"
  ) {
    const lockedAngle =
      Math.round(Math.atan(absHeight / absWidth) / SHIFT_LOCKING_ANGLE) *
      SHIFT_LOCKING_ANGLE;
    if (lockedAngle === 0) {
      height = 0;
    } else if (lockedAngle === Math.PI / 2) {
      width = 0;
    } else {
      height =
        Math.round(absWidth * Math.tan(lockedAngle)) * Math.sign(height) ||
        height;
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
    mutateElement(element, {
      x: anchorX,
      width: 0,
      y,
      height: -distanceToAnchorY,
    });
  } else if (Math.abs(distanceToAnchorY) < Math.abs(element.width) / 2) {
    mutateElement(element, {
      y: anchorY,
      height: 0,
    });
  } else {
    const nextHeight =
      Math.sign(distanceToAnchorY) *
      Math.sign(distanceToAnchorX) *
      element.width;
    mutateElement(element, {
      x,
      y: anchorY - nextHeight,
      width: -distanceToAnchorX,
      height: nextHeight,
    });
  }
}

/**
 * @returns {boolean} whether element was normalized
 */
export function normalizeDimensions(
  element: ExcalidrawElement | null,
): element is ExcalidrawElement {
  if (!element || (element.width >= 0 && element.height >= 0)) {
    return false;
  }

  if (element.width < 0) {
    const nextWidth = Math.abs(element.width);
    mutateElement(element, {
      width: nextWidth,
      x: element.x - nextWidth,
    });
  }

  if (element.height < 0) {
    const nextHeight = Math.abs(element.height);
    mutateElement(element, {
      height: nextHeight,
      y: element.y - nextHeight,
    });
  }

  return true;
}
