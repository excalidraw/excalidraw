import { getGlobalCSSVariable } from "@excalidraw/common";

import { getCommonBounds } from "@excalidraw/element";

import { getLanguage } from "../i18n";

import type { InteractiveCanvasAppState } from "../types";
import type { RenderableElementsMap, ScrollBars } from "./types";

export const SCROLLBAR_MARGIN = 4;
export const SCROLLBAR_WIDTH = 6;
export const SCROLLBAR_COLOR = "rgba(0,0,0,0.3)";

// The scrollbar represents where the viewport is in relationship to the scene
export const getScrollBars = (
  elements: RenderableElementsMap,
  viewportWidth: number,
  viewportHeight: number,
  appState: InteractiveCanvasAppState,
): ScrollBars => {
  if (!elements.size) {
    return {
      horizontal: null,
      vertical: null,
    };
  }
  // This is the bounding box of all the elements
  const [elementsMinX, elementsMinY, elementsMaxX, elementsMaxY] =
    getCommonBounds(elements);

  // Apply zoom
  const viewportWidthWithZoom = viewportWidth / appState.zoom.value;
  const viewportHeightWithZoom = viewportHeight / appState.zoom.value;

  const safeArea = {
    top: parseInt(getGlobalCSSVariable("sat")) || 0,
    bottom: parseInt(getGlobalCSSVariable("sab")) || 0,
    left: parseInt(getGlobalCSSVariable("sal")) || 0,
    right: parseInt(getGlobalCSSVariable("sar")) || 0,
  };

  const isRTL = getLanguage().rtl;

  // The viewport is the rectangle currently visible for the user
  const viewportMinX = -appState.scrollX + safeArea.left;
  const viewportMinY = -appState.scrollY + safeArea.top;
  const viewportMaxX = viewportMinX + viewportWidthWithZoom - safeArea.right;
  const viewportMaxY = viewportMinY + viewportHeightWithZoom - safeArea.bottom;

  // The scene is the bounding box of both the elements and viewport
  const sceneMinX = Math.min(elementsMinX, viewportMinX);
  const sceneMinY = Math.min(elementsMinY, viewportMinY);
  const sceneMaxX = Math.max(elementsMaxX, viewportMaxX);
  const sceneMaxY = Math.max(elementsMaxY, viewportMaxY);

  // the elements-only bbox
  const sceneWidth = elementsMaxX - elementsMinX;
  const sceneHeight = elementsMaxY - elementsMinY;

  // scene (elements) bbox + the viewport bbox that extends outside of it
  const extendedSceneWidth = sceneMaxX - sceneMinX;
  const extendedSceneHeight = sceneMaxY - sceneMinY;

  const scrollWidthOffset =
    Math.max(SCROLLBAR_MARGIN * 2, safeArea.left + safeArea.right) +
    SCROLLBAR_WIDTH * 2;

  const scrollbarWidth =
    viewportWidth * (viewportWidthWithZoom / extendedSceneWidth) -
    scrollWidthOffset;

  const scrollbarHeightOffset =
    Math.max(SCROLLBAR_MARGIN * 2, safeArea.top + safeArea.bottom) +
    SCROLLBAR_WIDTH * 2;

  const scrollbarHeight =
    viewportHeight * (viewportHeightWithZoom / extendedSceneHeight) -
    scrollbarHeightOffset;
  // NOTE the delta multiplier calculation isn't quite correct when viewport
  // is extended outside the scene (elements) bbox as there's some small
  // accumulation error. I'll let this be an exercise for others to fix. ^^
  const horizontalDeltaMultiplier =
    extendedSceneWidth > sceneWidth
      ? (extendedSceneWidth * appState.zoom.value) /
        (scrollbarWidth + scrollWidthOffset)
      : viewportWidth / (scrollbarWidth + scrollWidthOffset);

  const verticalDeltaMultiplier =
    extendedSceneHeight > sceneHeight
      ? (extendedSceneHeight * appState.zoom.value) /
        (scrollbarHeight + scrollbarHeightOffset)
      : viewportHeight / (scrollbarHeight + scrollbarHeightOffset);
  return {
    horizontal:
      viewportMinX === sceneMinX && viewportMaxX === sceneMaxX
        ? null
        : {
            x:
              Math.max(safeArea.left, SCROLLBAR_MARGIN) +
              SCROLLBAR_WIDTH +
              ((viewportMinX - sceneMinX) / extendedSceneWidth) * viewportWidth,
            y:
              viewportHeight -
              SCROLLBAR_WIDTH -
              Math.max(SCROLLBAR_MARGIN, safeArea.bottom),
            width: scrollbarWidth,
            height: SCROLLBAR_WIDTH,
            deltaMultiplier: horizontalDeltaMultiplier,
          },

    vertical:
      viewportMinY === sceneMinY && viewportMaxY === sceneMaxY
        ? null
        : {
            x: isRTL
              ? Math.max(safeArea.left, SCROLLBAR_MARGIN)
              : viewportWidth -
                SCROLLBAR_WIDTH -
                Math.max(safeArea.right, SCROLLBAR_MARGIN),
            y:
              Math.max(safeArea.top, SCROLLBAR_MARGIN) +
              SCROLLBAR_WIDTH +
              ((viewportMinY - sceneMinY) / extendedSceneHeight) *
                viewportHeight,
            width: SCROLLBAR_WIDTH,
            height: scrollbarHeight,
            deltaMultiplier: verticalDeltaMultiplier,
          },
  };
};

export const isOverScrollBars = (
  scrollBars: ScrollBars,
  x: number,
  y: number,
): {
  isOverEither: boolean;
  isOverHorizontal: boolean;
  isOverVertical: boolean;
} => {
  const [isOverHorizontal, isOverVertical] = [
    scrollBars.horizontal,
    scrollBars.vertical,
  ].map((scrollBar) => {
    return (
      scrollBar != null &&
      scrollBar.x <= x &&
      x <= scrollBar.x + scrollBar.width &&
      scrollBar.y <= y &&
      y <= scrollBar.y + scrollBar.height
    );
  });
  const isOverEither = isOverHorizontal || isOverVertical;
  return { isOverEither, isOverHorizontal, isOverVertical };
};
