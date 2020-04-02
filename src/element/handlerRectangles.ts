import { ExcalidrawElement, PointerType } from "./types";

import { getElementAbsoluteCoords } from "./bounds";
import { rotate } from "../math";

type Sides = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se" | "rotation";

const handleSizes: { [k in PointerType]: number } = {
  mouse: 8,
  pen: 16,
  touch: 28,
};

const ROTATION_HANDLER_GAP = 16;

function generateHandler(
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
): [number, number, number, number] {
  const [xx, yy] = rotate(x + width / 2, y + height / 2, cx, cy, angle);
  return [xx - width / 2, yy - height / 2, width, height];
}

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
  const cx = (elementX1 + elementX2) / 2;
  const cy = (elementY1 + elementY2) / 2;
  const angle = element.angle;

  const dashedLineMargin = 4 / zoom;

  const centeringOffset = (size - 8) / (2 * zoom);

  const handlers = {
    nw: generateHandler(
      elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
      elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    ),
    ne: generateHandler(
      elementX2 + dashedLineMargin - centeringOffset,
      elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    ),
    sw: generateHandler(
      elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
      elementY2 + dashedLineMargin - centeringOffset,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    ),
    se: generateHandler(
      elementX2 + dashedLineMargin - centeringOffset,
      elementY2 + dashedLineMargin - centeringOffset,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    ),
    rotation: generateHandler(
      elementX1 + elementWidth / 2 - handlerWidth / 2,
      elementY1 -
        dashedLineMargin -
        handlerMarginY +
        centeringOffset -
        ROTATION_HANDLER_GAP,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    ),
  } as { [T in Sides]: [number, number, number, number] };

  // We only want to show height handlers (all cardinal directions)  above a certain size
  const minimumSizeForEightHandlers = (5 * size) / zoom;
  if (Math.abs(elementWidth) > minimumSizeForEightHandlers) {
    handlers["n"] = generateHandler(
      elementX1 + elementWidth / 2 - handlerWidth / 2,
      elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    );
    handlers["s"] = generateHandler(
      elementX1 + elementWidth / 2 - handlerWidth / 2,
      elementY2 + dashedLineMargin - centeringOffset,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    );
  }
  if (Math.abs(elementHeight) > minimumSizeForEightHandlers) {
    handlers["w"] = generateHandler(
      elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
      elementY1 + elementHeight / 2 - handlerHeight / 2,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    );
    handlers["e"] = generateHandler(
      elementX2 + dashedLineMargin - centeringOffset,
      elementY1 + elementHeight / 2 - handlerHeight / 2,
      handlerWidth,
      handlerHeight,
      cx,
      cy,
      angle,
    );
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
