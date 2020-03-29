import { ExcalidrawElement, PointerType } from "./types";

import { getElementAbsoluteCoords } from "./bounds";

type Sides = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";

const handleSizes: { [k in PointerType]: number } = {
  mouse: 8,
  pen: 16,
  touch: 28,
};

export function handlerRectangles(
  element: ExcalidrawElement,
  zoom: number,
  pointerType: PointerType = "mouse",
) {
  const size = handleSizes[pointerType];
  const handlerWidth = size / zoom;
  const handlerHeight = size / zoom;

  const handlerMarginX = size / zoom;
  const handlerMarginY = size / zoom;

  const [elementX1, elementY1, elementX2, elementY2] = getElementAbsoluteCoords(
    element,
  );

  const elementWidth = elementX2 - elementX1;
  const elementHeight = elementY2 - elementY1;

  const dashedLineMargin = 4 / zoom;

  const centeringOffset = (size - 8) / (2 * zoom);

  const handlers = {
    nw: [
      elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
      elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
      handlerWidth,
      handlerHeight,
    ],
    ne: [
      elementX2 + dashedLineMargin - centeringOffset,
      elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
      handlerWidth,
      handlerHeight,
    ],
    sw: [
      elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
      elementY2 + dashedLineMargin - centeringOffset,
      handlerWidth,
      handlerHeight,
    ],
    se: [
      elementX2 + dashedLineMargin - centeringOffset,
      elementY2 + dashedLineMargin - centeringOffset,
      handlerWidth,
      handlerHeight,
    ],
  } as { [T in Sides]: number[] };

  // We only want to show height handlers (all cardinal directions)  above a certain size
  const minimumSizeForEightHandlers = (5 * size) / zoom;
  if (Math.abs(elementWidth) > minimumSizeForEightHandlers) {
    handlers["n"] = [
      elementX1 + elementWidth / 2 - handlerWidth / 2,
      elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
      handlerWidth,
      handlerHeight,
    ];
    handlers["s"] = [
      elementX1 + elementWidth / 2 - handlerWidth / 2,
      elementY2 + dashedLineMargin - centeringOffset,
      handlerWidth,
      handlerHeight,
    ];
  }
  if (Math.abs(elementHeight) > minimumSizeForEightHandlers) {
    handlers["w"] = [
      elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
      elementY1 + elementHeight / 2 - handlerHeight / 2,
      handlerWidth,
      handlerHeight,
    ];
    handlers["e"] = [
      elementX2 + dashedLineMargin - centeringOffset,
      elementY1 + elementHeight / 2 - handlerHeight / 2,
      handlerWidth,
      handlerHeight,
    ];
  }

  if (element.type === "arrow" || element.type === "line") {
    if (element.points.length === 2) {
      // only check the last point because starting point is always (0,0)
      const [, p1] = element.points;

      if (p1[0] === 0 || p1[1] === 0) {
        return {
          nw: handlers.nw,
          se: handlers.se,
        } as typeof handlers;
      }

      if (p1[0] > 0 && p1[1] < 0) {
        return {
          ne: handlers.ne,
          sw: handlers.sw,
        } as typeof handlers;
      }

      if (p1[0] > 0 && p1[1] > 0) {
        return {
          nw: handlers.nw,
          se: handlers.se,
        } as typeof handlers;
      }

      if (p1[0] < 0 && p1[1] > 0) {
        return {
          ne: handlers.ne,
          sw: handlers.sw,
        } as typeof handlers;
      }

      if (p1[0] < 0 && p1[1] < 0) {
        return {
          nw: handlers.nw,
          se: handlers.se,
        } as typeof handlers;
      }
    }
  }

  return handlers;
}
