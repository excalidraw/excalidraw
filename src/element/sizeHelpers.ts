import { ExcalidrawElement } from "./types";
import { mutateElement } from "./mutateElement";
import { isFreeDrawElement, isLinearElement } from "./typeChecks";
import { SHIFT_LOCKING_ANGLE } from "../constants";

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
  activeTool: string,
  width: number,
  height: number,
): { width: number; height: number } => {
  const absWidth = Math.abs(width);
  const absHeight = Math.abs(height);

  if (
    activeTool === "line" ||
    activeTool === "arrow" ||
    activeTool === "freedraw"
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
  } else if (activeTool !== "selection") {
    height = absWidth * Math.sign(height);
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
