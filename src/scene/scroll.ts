import { FlooredNumber } from "../types";
import { ExcalidrawElement } from "../element/types";
import { getCommonBounds, getClosestElementBounds } from "../element";

export function normalizeScroll(pos: number) {
  return Math.floor(pos) as FlooredNumber;
}

export function calculateScrollCenter(
  elements: readonly ExcalidrawElement[],
  from?: { x: number; y: number },
): { scrollX: FlooredNumber; scrollY: FlooredNumber } {
  if (!elements.length) {
    return {
      scrollX: normalizeScroll(0),
      scrollY: normalizeScroll(0),
    };
  }

  let x1, y1, x2, y2;

  if (from) {
    [x1, y1, x2, y2] = getClosestElementBounds(elements, from);
  } else {
    [x1, y1, x2, y2] = getCommonBounds(elements);
  }

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return {
    scrollX: normalizeScroll(window.innerWidth / 2 - centerX),
    scrollY: normalizeScroll(window.innerHeight / 2 - centerY),
  };
}
