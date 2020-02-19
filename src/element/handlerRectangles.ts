import { ExcalidrawElement } from "./types";

import { getElementAbsoluteCoords } from "./bounds";

type Sides = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";

export function handlerRectangles(element: ExcalidrawElement, zoom: number) {
  const handlerWidth = 8 / zoom;
  const handlerHeight = 8 / zoom;

  const handlerMarginX = 8 / zoom;
  const handlerMarginY = 8 / zoom;

  const [elementX1, elementY1, elementX2, elementY2] = getElementAbsoluteCoords(
    element,
  );

  const elementWidth = elementX2 - elementX1;
  const elementHeight = elementY2 - elementY1;

  const dashedLineMargin = 4 / zoom;

  const handlers = {
    nw: [
      elementX1 - dashedLineMargin - handlerMarginX,
      elementY1 - dashedLineMargin - handlerMarginY,
      handlerWidth,
      handlerHeight,
    ],
    ne: [
      elementX2 + dashedLineMargin,
      elementY1 - dashedLineMargin - handlerMarginY,
      handlerWidth,
      handlerHeight,
    ],
    sw: [
      elementX1 - dashedLineMargin - handlerMarginX,
      elementY2 + dashedLineMargin,
      handlerWidth,
      handlerHeight,
    ],
    se: [
      elementX2 + dashedLineMargin,
      elementY2 + dashedLineMargin,
      handlerWidth,
      handlerHeight,
    ],
  } as { [T in Sides]: number[] };

  // We only want to show height handlers (all cardinal directions)  above a certain size
  const minimumSizeForEightHandlers = 40 / zoom;
  if (Math.abs(elementWidth) > minimumSizeForEightHandlers) {
    handlers["n"] = [
      elementX1 + elementWidth / 2,
      elementY1 - dashedLineMargin - handlerMarginY,
      handlerWidth,
      handlerHeight,
    ];
    handlers["s"] = [
      elementX1 + elementWidth / 2,
      elementY2 + dashedLineMargin,
      handlerWidth,
      handlerHeight,
    ];
  }
  if (Math.abs(elementHeight) > minimumSizeForEightHandlers) {
    handlers["w"] = [
      elementX1 - dashedLineMargin - handlerMarginX,
      elementY1 + elementHeight / 2,
      handlerWidth,
      handlerHeight,
    ];
    handlers["e"] = [
      elementX2 + dashedLineMargin,
      elementY1 + elementHeight / 2,
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

    return {
      n: handlers.n,
      s: handlers.s,
      w: handlers.w,
      e: handlers.e,
    } as typeof handlers;
  }

  return handlers;
}
