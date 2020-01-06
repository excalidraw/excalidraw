import { ExcalidrawElement } from "../element/types";
import {
  getElementAbsoluteX1,
  getElementAbsoluteX2,
  getElementAbsoluteY1,
  getElementAbsoluteY2
} from "../element";

const SCROLLBAR_MIN_SIZE = 15;
const SCROLLBAR_MARGIN = 4;
export const SCROLLBAR_WIDTH = 6;
export const SCROLLBAR_COLOR = "rgba(0,0,0,0.3)";

export function getScrollBars(
  elements: ExcalidrawElement[],
  canvasWidth: number,
  canvasHeight: number,
  scrollX: number,
  scrollY: number
) {
  let minX = Infinity;
  let maxX = 0;
  let minY = Infinity;
  let maxY = 0;

  elements.forEach(element => {
    minX = Math.min(minX, getElementAbsoluteX1(element));
    maxX = Math.max(maxX, getElementAbsoluteX2(element));
    minY = Math.min(minY, getElementAbsoluteY1(element));
    maxY = Math.max(maxY, getElementAbsoluteY2(element));
  });

  minX += scrollX;
  maxX += scrollX;
  minY += scrollY;
  maxY += scrollY;
  const leftOverflow = Math.max(-minX, 0);
  const rightOverflow = Math.max(-(canvasWidth - maxX), 0);
  const topOverflow = Math.max(-minY, 0);
  const bottomOverflow = Math.max(-(canvasHeight - maxY), 0);

  // horizontal scrollbar
  let horizontalScrollBar = null;
  if (leftOverflow || rightOverflow) {
    horizontalScrollBar = {
      x: Math.min(
        leftOverflow + SCROLLBAR_MARGIN,
        canvasWidth - SCROLLBAR_MIN_SIZE - SCROLLBAR_MARGIN
      ),
      y: canvasHeight - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
      width: Math.max(
        canvasWidth - rightOverflow - leftOverflow - SCROLLBAR_MARGIN * 2,
        SCROLLBAR_MIN_SIZE
      ),
      height: SCROLLBAR_WIDTH
    };
  }

  // vertical scrollbar
  let verticalScrollBar = null;
  if (topOverflow || bottomOverflow) {
    verticalScrollBar = {
      x: canvasWidth - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
      y: Math.min(
        topOverflow + SCROLLBAR_MARGIN,
        canvasHeight - SCROLLBAR_MIN_SIZE - SCROLLBAR_MARGIN
      ),
      width: SCROLLBAR_WIDTH,
      height: Math.max(
        canvasHeight - bottomOverflow - topOverflow - SCROLLBAR_WIDTH * 2,
        SCROLLBAR_MIN_SIZE
      )
    };
  }

  return {
    horizontal: horizontalScrollBar,
    vertical: verticalScrollBar
  };
}

export function isOverScrollBars(
  elements: ExcalidrawElement[],
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  scrollX: number,
  scrollY: number
) {
  const scrollBars = getScrollBars(
    elements,
    canvasWidth,
    canvasHeight,
    scrollX,
    scrollY
  );

  const [isOverHorizontalScrollBar, isOverVerticalScrollBar] = [
    scrollBars.horizontal,
    scrollBars.vertical
  ].map(
    scrollBar =>
      scrollBar &&
      scrollBar.x <= x &&
      x <= scrollBar.x + scrollBar.width &&
      scrollBar.y <= y &&
      y <= scrollBar.y + scrollBar.height
  );

  return {
    isOverHorizontalScrollBar,
    isOverVerticalScrollBar
  };
}
