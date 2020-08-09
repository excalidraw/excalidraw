import { ExcalidrawElement, PointerType } from "./types";

import { getElementAbsoluteCoords, Bounds } from "./bounds";
import { rotate } from "../math";

export type ResizeHandleSide =
  | "n"
  | "s"
  | "w"
  | "e"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "rotation";

export type ResizeHandle = [number, number, number, number];
export type ResizeHandles = Partial<{ [T in ResizeHandleSide]: ResizeHandle }>;
export type MaybeResizeHandleSide = ResizeHandleSide | false;

const resizeHandleSizes: { [k in PointerType]: number } = {
  mouse: 8,
  pen: 16,
  touch: 28,
};

const ROTATION_RESIZE_HANDLE_GAP = 16;

export const OMIT_SIDES_FOR_MULTIPLE_ELEMENTS = {
  e: true,
  s: true,
  n: true,
  w: true,
};

const OMIT_SIDES_FOR_TEXT_ELEMENT = {
  e: true,
  s: true,
  n: true,
  w: true,
};

const OMIT_SIDES_FOR_LINE_SLASH = {
  e: true,
  s: true,
  n: true,
  w: true,
  nw: true,
  se: true,
  rotation: true,
};

const OMIT_SIDES_FOR_LINE_BACKSLASH = {
  e: true,
  s: true,
  n: true,
  w: true,
  ne: true,
  sw: true,
  rotation: true,
};

const generateResizeHandle = (
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
): ResizeHandle => {
  const [xx, yy] = rotate(x + width / 2, y + height / 2, cx, cy, angle);
  return [xx - width / 2, yy - height / 2, width, height];
};

export const getResizeHandlesFromCoords = (
  [x1, y1, x2, y2]: Bounds,
  angle: number,
  zoom: number,
  pointerType: PointerType = "touch",
  omitSides: { [T in ResizeHandleSide]?: boolean } = {},
): ResizeHandles => {
  const size = resizeHandleSizes[pointerType];
  const handleWidth = size / zoom;
  const handleHeight = size / zoom;

  const handleMarginX = size / zoom;
  const handleMarginY = size / zoom;

  const width = x2 - x1;
  const height = y2 - y1;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const dashedLineMargin = 4 / zoom;

  const centeringOffset = 0;

  const resizeHandles: ResizeHandles = {
    nw: omitSides["nw"]
      ? undefined
      : generateResizeHandle(
          x1 - dashedLineMargin - handleMarginX + centeringOffset,
          y1 - dashedLineMargin - handleMarginY + centeringOffset,
          handleWidth,
          handleHeight,
          cx,
          cy,
          angle,
        ),
    ne: omitSides["ne"]
      ? undefined
      : generateResizeHandle(
          x2 + dashedLineMargin - centeringOffset,
          y1 - dashedLineMargin - handleMarginY + centeringOffset,
          handleWidth,
          handleHeight,
          cx,
          cy,
          angle,
        ),
    sw: omitSides["sw"]
      ? undefined
      : generateResizeHandle(
          x1 - dashedLineMargin - handleMarginX + centeringOffset,
          y2 + dashedLineMargin - centeringOffset,
          handleWidth,
          handleHeight,
          cx,
          cy,
          angle,
        ),
    se: omitSides["se"]
      ? undefined
      : generateResizeHandle(
          x2 + dashedLineMargin - centeringOffset,
          y2 + dashedLineMargin - centeringOffset,
          handleWidth,
          handleHeight,
          cx,
          cy,
          angle,
        ),
    rotation: omitSides["rotation"]
      ? undefined
      : generateResizeHandle(
          x1 + width / 2 - handleWidth / 2,
          y1 -
            dashedLineMargin -
            handleMarginY +
            centeringOffset -
            ROTATION_RESIZE_HANDLE_GAP / zoom,
          handleWidth,
          handleHeight,
          cx,
          cy,
          angle,
        ),
  };

  // We only want to show height handles (all cardinal directions)  above a certain size
  const minimumSizeForEightHandles = (5 * size) / zoom;
  if (Math.abs(width) > minimumSizeForEightHandles) {
    if (!omitSides["n"]) {
      resizeHandles["n"] = generateResizeHandle(
        x1 + width / 2 - handleWidth / 2,
        y1 - dashedLineMargin - handleMarginY + centeringOffset,
        handleWidth,
        handleHeight,
        cx,
        cy,
        angle,
      );
    }
    if (!omitSides["s"]) {
      resizeHandles["s"] = generateResizeHandle(
        x1 + width / 2 - handleWidth / 2,
        y2 + dashedLineMargin - centeringOffset,
        handleWidth,
        handleHeight,
        cx,
        cy,
        angle,
      );
    }
  }
  if (Math.abs(height) > minimumSizeForEightHandles) {
    if (!omitSides["w"]) {
      resizeHandles["w"] = generateResizeHandle(
        x1 - dashedLineMargin - handleMarginX + centeringOffset,
        y1 + height / 2 - handleHeight / 2,
        handleWidth,
        handleHeight,
        cx,
        cy,
        angle,
      );
    }
    if (!omitSides["e"]) {
      resizeHandles["e"] = generateResizeHandle(
        x2 + dashedLineMargin - centeringOffset,
        y1 + height / 2 - handleHeight / 2,
        handleWidth,
        handleHeight,
        cx,
        cy,
        angle,
      );
    }
  }

  return resizeHandles;
};

export const getResizeHandles = (
  element: ExcalidrawElement,
  zoom: number,
  pointerType: PointerType = "touch",
): ResizeHandles => {
  let omitSides: { [T in ResizeHandleSide]?: boolean } = {};
  if (
    element.type === "arrow" ||
    element.type === "line" ||
    element.type === "draw"
  ) {
    if (element.points.length === 2) {
      // only check the last point because starting point is always (0,0)
      const [, p1] = element.points;
      if (p1[0] === 0 || p1[1] === 0) {
        omitSides = OMIT_SIDES_FOR_LINE_BACKSLASH;
      } else if (p1[0] > 0 && p1[1] < 0) {
        omitSides = OMIT_SIDES_FOR_LINE_SLASH;
      } else if (p1[0] > 0 && p1[1] > 0) {
        omitSides = OMIT_SIDES_FOR_LINE_BACKSLASH;
      } else if (p1[0] < 0 && p1[1] > 0) {
        omitSides = OMIT_SIDES_FOR_LINE_SLASH;
      } else if (p1[0] < 0 && p1[1] < 0) {
        omitSides = OMIT_SIDES_FOR_LINE_BACKSLASH;
      }
    }
  } else if (element.type === "text") {
    omitSides = OMIT_SIDES_FOR_TEXT_ELEMENT;
  }

  return getResizeHandlesFromCoords(
    getElementAbsoluteCoords(element),
    element.angle,
    zoom,
    pointerType,
    omitSides,
  );
};
