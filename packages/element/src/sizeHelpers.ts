import {
  SHIFT_LOCKING_ANGLE,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { pointsEqual } from "@excalidraw/math";

import type { AppState, Offsets, Zoom } from "@excalidraw/excalidraw/types";

import { getCommonBounds, getElementBounds } from "./bounds";
import { isElbowArrow, isFreeDrawElement, isLinearElement } from "./typeChecks";

import type { ElementsMap, ExcalidrawElement } from "./types";

// TODO:  remove invisible elements consistently actions, so that invisible elements are not recorded by the store, exported, broadcasted or persisted
//        - perhaps could be as part of a standalone 'cleanup' action, in addition to 'finalize'
//        - could also be part of `_clearElements`
export const isInvisiblySmallElement = (
  element: ExcalidrawElement,
): boolean => {
  if (isElbowArrow(element)) {
    return (
      element.points.length < 2 ||
      pointsEqual(element.points[0], element.points[element.points.length - 1])
    );
  }
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    return element.points.length < 2;
  }
  return element.width === 0 && element.height === 0;
};

export const isElementInViewport = (
  element: ExcalidrawElement,
  width: number,
  height: number,
  viewTransformations: {
    zoom: Zoom;
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  },
  elementsMap: ElementsMap,
) => {
  const [x1, y1, x2, y2] = getElementBounds(element, elementsMap); // scene coordinates
  const topLeftSceneCoords = viewportCoordsToSceneCoords(
    {
      clientX: viewTransformations.offsetLeft,
      clientY: viewTransformations.offsetTop,
    },
    viewTransformations,
  );
  const bottomRightSceneCoords = viewportCoordsToSceneCoords(
    {
      clientX: viewTransformations.offsetLeft + width,
      clientY: viewTransformations.offsetTop + height,
    },
    viewTransformations,
  );

  return (
    topLeftSceneCoords.x <= x2 &&
    topLeftSceneCoords.y <= y2 &&
    bottomRightSceneCoords.x >= x1 &&
    bottomRightSceneCoords.y >= y1
  );
};

export const isElementCompletelyInViewport = (
  elements: ExcalidrawElement[],
  width: number,
  height: number,
  viewTransformations: {
    zoom: Zoom;
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  },
  elementsMap: ElementsMap,
  padding?: Offsets,
) => {
  const [x1, y1, x2, y2] = getCommonBounds(elements, elementsMap); // scene coordinates
  const topLeftSceneCoords = viewportCoordsToSceneCoords(
    {
      clientX: viewTransformations.offsetLeft + (padding?.left || 0),
      clientY: viewTransformations.offsetTop + (padding?.top || 0),
    },
    viewTransformations,
  );
  const bottomRightSceneCoords = viewportCoordsToSceneCoords(
    {
      clientX: viewTransformations.offsetLeft + width - (padding?.right || 0),
      clientY: viewTransformations.offsetTop + height - (padding?.bottom || 0),
    },
    viewTransformations,
  );

  return (
    x1 >= topLeftSceneCoords.x &&
    y1 >= topLeftSceneCoords.y &&
    x2 <= bottomRightSceneCoords.x &&
    y2 <= bottomRightSceneCoords.y
  );
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
      height = absWidth * Math.tan(lockedAngle) * Math.sign(height) || height;
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
    const intersectX = (b1 * c2 - b2 * c1) / (a1 * b2 - a2 * b1);
    const intersectY = (c1 * a2 - c2 * a1) / (a1 * b2 - a2 * b1);

    // delta
    width = intersectX - originX;
    height = intersectY - originY;
  }

  return { width, height };
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
