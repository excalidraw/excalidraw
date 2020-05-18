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

export const OMIT_SIDES_FOR_MULTIPLE_ELEMENTS = {
  e: true,
  s: true,
  n: true,
  w: true,
  rotation: true,
};

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

export function handlerRectanglesFromCoords(
  [x1, y1, x2, y2]: [number, number, number, number],
  angle: number,
  zoom: number,
  pointerType: PointerType = "mouse",
  omitSides: { [T in Sides]?: boolean } = {},
): Partial<{ [T in Sides]: [number, number, number, number] }> {
  const size = handleSizes[pointerType];
  const handlerWidth = size / zoom;
  const handlerHeight = size / zoom;

  const handlerMarginX = size / zoom;
  const handlerMarginY = size / zoom;

  const width = x2 - x1;
  const height = y2 - y1;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const dashedLineMargin = 4 / zoom;

  const centeringOffset = (size - 8) / (2 * zoom);

  const handlers: Partial<
    { [T in Sides]: [number, number, number, number] }
  > = {
    nw: omitSides["nw"]
      ? undefined
      : generateHandler(
          x1 - dashedLineMargin - handlerMarginX + centeringOffset,
          y1 - dashedLineMargin - handlerMarginY + centeringOffset,
          handlerWidth,
          handlerHeight,
          cx,
          cy,
          angle,
        ),
    ne: omitSides["ne"]
      ? undefined
      : generateHandler(
          x2 + dashedLineMargin - centeringOffset,
          y1 - dashedLineMargin - handlerMarginY + centeringOffset,
          handlerWidth,
          handlerHeight,
          cx,
          cy,
          angle,
        ),
    sw: omitSides["sw"]
      ? undefined
      : generateHandler(
          x1 - dashedLineMargin - handlerMarginX + centeringOffset,
          y2 + dashedLineMargin - centeringOffset,
          handlerWidth,
          handlerHeight,
          cx,
          cy,
          angle,
        ),
    se: omitSides["se"]
      ? undefined
      : generateHandler(
          x2 + dashedLineMargin - centeringOffset,
          y2 + dashedLineMargin - centeringOffset,
          handlerWidth,
          handlerHeight,
          cx,
          cy,
          angle,
        ),
    rotation: omitSides["rotation"]
      ? undefined
      : generateHandler(
          x1 + width / 2 - handlerWidth / 2,
          y1 -
            dashedLineMargin -
            handlerMarginY +
            centeringOffset -
            ROTATION_HANDLER_GAP / zoom,
          handlerWidth,
          handlerHeight,
          cx,
          cy,
          angle,
        ),
  };

  // We only want to show height handlers (all cardinal directions)  above a certain size
  const minimumSizeForEightHandlers = (5 * size) / zoom;
  if (Math.abs(width) > minimumSizeForEightHandlers) {
    if (!omitSides["n"]) {
      handlers["n"] = generateHandler(
        x1 + width / 2 - handlerWidth / 2,
        y1 - dashedLineMargin - handlerMarginY + centeringOffset,
        handlerWidth,
        handlerHeight,
        cx,
        cy,
        angle,
      );
    }
    if (!omitSides["s"]) {
      handlers["s"] = generateHandler(
        x1 + width / 2 - handlerWidth / 2,
        y2 + dashedLineMargin - centeringOffset,
        handlerWidth,
        handlerHeight,
        cx,
        cy,
        angle,
      );
    }
  }
  if (Math.abs(height) > minimumSizeForEightHandlers) {
    if (!omitSides["w"]) {
      handlers["w"] = generateHandler(
        x1 - dashedLineMargin - handlerMarginX + centeringOffset,
        y1 + height / 2 - handlerHeight / 2,
        handlerWidth,
        handlerHeight,
        cx,
        cy,
        angle,
      );
    }
    if (!omitSides["e"]) {
      handlers["e"] = generateHandler(
        x2 + dashedLineMargin - centeringOffset,
        y1 + height / 2 - handlerHeight / 2,
        handlerWidth,
        handlerHeight,
        cx,
        cy,
        angle,
      );
    }
  }

  return handlers;
}

export function handlerRectangles(
  element: ExcalidrawElement,
  zoom: number,
  pointerType: PointerType = "mouse",
) {
  const handlers = handlerRectanglesFromCoords(
    getElementAbsoluteCoords(element),
    element.angle,
    zoom,
    pointerType,
  );

  if (
    element.type === "arrow" ||
    element.type === "line" ||
    element.type === "draw"
  ) {
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
