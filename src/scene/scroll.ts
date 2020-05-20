import { FlooredNumber } from "../types";
import { ExcalidrawElement } from "../element/types";
import { getCommonBounds } from "../element";

export const normalizeScroll = (pos: number) =>
  Math.floor(pos) as FlooredNumber;

export const calculateScrollCenter = (
  elements: readonly ExcalidrawElement[],
): { scrollX: FlooredNumber; scrollY: FlooredNumber } => {
  if (!elements.length) {
    return {
      scrollX: normalizeScroll(0),
      scrollY: normalizeScroll(0),
    };
  }

  const [x1, y1, x2, y2] = getCommonBounds(elements);

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return {
    scrollX: normalizeScroll(window.innerWidth / 2 - centerX),
    scrollY: normalizeScroll(window.innerHeight / 2 - centerY),
  };
};
