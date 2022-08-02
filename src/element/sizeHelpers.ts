import { ExcalidrawElement } from "./types";
import { mutateElement } from "./mutateElement";
import { isFreeDrawElement, isLinearElement } from "./typeChecks";
import { SHIFT_LOCKING_ANGLE } from "../constants";
import { AppState } from "../types";

export const isInvisiblySmallElement = (
  element: ExcalidrawElement,
): boolean => {
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    return element.points.length < 2;
  }
  return element.width === 0 && element.height === 0;
};

/**
 * Makes a perfect shape or diagonal/horizontal/vertical line
 */
export const getPerfectElementSize = (
  elementType: AppState["activeTool"]["type"],
  width: number,
  height: number,
): { width: number; height: number } => {
  const absWidth = Math.abs(width);
  const absHeight = Math.abs(height);

  if (
    elementType === "line" ||
    elementType === "arrow" ||
    elementType === "freedraw"
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
};

export const getLockedLinearCursorAlignSize = (
  originX: number,
  originY: number,
  x: number,
  y: number,
) => {
  let width = x - originX;
  let height = y - originY;

  const lockedAngle =
    Math.round(Math.atan(height / width) / SHIFT_LOCKING_ANGLE) *
    SHIFT_LOCKING_ANGLE;

  if (lockedAngle === 0) {
    height = 0;
  } else if (lockedAngle === Math.PI / 2) {
    width = 0;
  } else {
    // locked angle line, y = mx + b => mx - y + b = 0
    const a1 = Math.tan(lockedAngle);
    const b1 = -1;
    const c1 = originY - a1 * originX;

    // line through cursor, perpendicular to locked angle line
    const a2 = -1 / a1;
    const b2 = -1;
    const c2 = y - a2 * x;

    // intersection of the two lines above
    const intersectX = Math.round((b1 * c2 - b2 * c1) / (a1 * b2 - a2 * b1));
    const intersectY = Math.round((c1 * a2 - c2 * a1) / (a1 * b2 - a2 * b1));

    // delta
    width = intersectX - originX;
    height = intersectY - originY;
  }

  return { width, height };
};

export const resizePerfectLineForNWHandler = (
  element: ExcalidrawElement,
  x: number,
  y: number,
) => {
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
};

export const getNormalizedDimensions = (
  element: Pick<ExcalidrawElement, "width" | "height" | "x" | "y">,
): {
  width: ExcalidrawElement["width"];
  height: ExcalidrawElement["height"];
  x: ExcalidrawElement["x"];
  y: ExcalidrawElement["y"];
} => {
  const ret = {
    width: element.width,
    height: element.height,
    x: element.x,
    y: element.y,
  };

  if (element.width < 0) {
    const nextWidth = Math.abs(element.width);
    ret.width = nextWidth;
    ret.x = element.x - nextWidth;
  }

  if (element.height < 0) {
    const nextHeight = Math.abs(element.height);
    ret.height = nextHeight;
    ret.y = element.y - nextHeight;
  }

  return ret;
};
