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

function rotateHandlerCoords(
  [x, y, w, h]: [number, number, number, number],
  cx: number,
  cy: number,
  angle: number,
) {
  const [xx, yy] = rotate(x + w / 2, y + h / 2, cx, cy, angle);
  return [xx - w / 2, yy - h / 2, w, h] as [number, number, number, number];
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
    nw: rotateHandlerCoords(
      [
        elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
        elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    ),
    ne: rotateHandlerCoords(
      [
        elementX2 + dashedLineMargin - centeringOffset,
        elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    ),
    sw: rotateHandlerCoords(
      [
        elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
        elementY2 + dashedLineMargin - centeringOffset,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    ),
    se: rotateHandlerCoords(
      [
        elementX2 + dashedLineMargin - centeringOffset,
        elementY2 + dashedLineMargin - centeringOffset,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    ),
    rotation: rotateHandlerCoords(
      [
        elementX1 + elementWidth / 2 - handlerWidth / 2,
        elementY1 -
          dashedLineMargin -
          handlerMarginY +
          centeringOffset -
          ROTATION_HANDLER_GAP,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    ),
  } as { [T in Sides]: [number, number, number, number] };

  // We only want to show height handlers (all cardinal directions)  above a certain size
  const minimumSizeForEightHandlers = (5 * size) / zoom;
  if (Math.abs(elementWidth) > minimumSizeForEightHandlers) {
    handlers["n"] = rotateHandlerCoords(
      [
        elementX1 + elementWidth / 2 - handlerWidth / 2,
        elementY1 - dashedLineMargin - handlerMarginY + centeringOffset,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    );
    handlers["s"] = rotateHandlerCoords(
      [
        elementX1 + elementWidth / 2 - handlerWidth / 2,
        elementY2 + dashedLineMargin - centeringOffset,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    );
  }
  if (Math.abs(elementHeight) > minimumSizeForEightHandlers) {
    handlers["w"] = rotateHandlerCoords(
      [
        elementX1 - dashedLineMargin - handlerMarginX + centeringOffset,
        elementY1 + elementHeight / 2 - handlerHeight / 2,
        handlerWidth,
        handlerHeight,
      ],
      cx,
      cy,
      angle,
    );
    handlers["e"] = rotateHandlerCoords(
      [
        elementX2 + dashedLineMargin - centeringOffset,
        elementY1 + elementHeight / 2 - handlerHeight / 2,
        handlerWidth,
        handlerHeight,
      ],
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
