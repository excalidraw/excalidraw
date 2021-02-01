import { ExcalidrawElement } from "../element/types";
import { getCommonBounds } from "../element";
import { Zoom } from "../types";
import { ScrollBars } from "./types";
import { getGlobalCSSVariable } from "../utils";
import { getLanguage } from "../i18n";

export const SCROLLBAR_MARGIN = 4;
export const SCROLLBAR_WIDTH = 6;
export const SCROLLBAR_COLOR = "rgba(0,0,0,0.3)";

export const getScrollBars = (
  elements: readonly ExcalidrawElement[],
  viewportWidth: number,
  viewportHeight: number,
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: number;
    scrollY: number;
    zoom: Zoom;
  },
): ScrollBars => {
  if (elements.length === 0) {
    return {
      horizontal: null,
      vertical: null,
    };
  }
  // This is the bounding box of all the elements
  const [
    elementsMinX,
    elementsMinY,
    elementsMaxX,
    elementsMaxY,
  ] = getCommonBounds(elements);

  // Apply zoom
  const viewportWidthWithZoom = viewportWidth / zoom.value;
  const viewportHeightWithZoom = viewportHeight / zoom.value;

  const viewportWidthDiff = viewportWidth - viewportWidthWithZoom;
  const viewportHeightDiff = viewportHeight - viewportHeightWithZoom;

  const safeArea = {
    top: parseInt(getGlobalCSSVariable("sat")),
    bottom: parseInt(getGlobalCSSVariable("sab")),
    left: parseInt(getGlobalCSSVariable("sal")),
    right: parseInt(getGlobalCSSVariable("sar")),
  };

  const isRTL = getLanguage().rtl;

  // The viewport is the rectangle currently visible for the user
  const viewportMinX = -scrollX + viewportWidthDiff / 2 + safeArea.left;
  const viewportMinY = -scrollY + viewportHeightDiff / 2 + safeArea.top;
  const viewportMaxX = viewportMinX + viewportWidthWithZoom - safeArea.right;
  const viewportMaxY = viewportMinY + viewportHeightWithZoom - safeArea.bottom;

  // The scene is the bounding box of both the elements and viewport
  const sceneMinX = Math.min(elementsMinX, viewportMinX);
  const sceneMinY = Math.min(elementsMinY, viewportMinY);
  const sceneMaxX = Math.max(elementsMaxX, viewportMaxX);
  const sceneMaxY = Math.max(elementsMaxY, viewportMaxY);

  // The scrollbar represents where the viewport is in relationship to the scene

  return {
    horizontal:
      viewportMinX === sceneMinX && viewportMaxX === sceneMaxX
        ? null
        : {
            x:
              Math.max(safeArea.left, SCROLLBAR_MARGIN) +
              ((viewportMinX - sceneMinX) / (sceneMaxX - sceneMinX)) *
                viewportWidth,
            y:
              viewportHeight -
              SCROLLBAR_WIDTH -
              Math.max(SCROLLBAR_MARGIN, safeArea.bottom),
            width:
              ((viewportMaxX - viewportMinX) / (sceneMaxX - sceneMinX)) *
                viewportWidth -
              Math.max(SCROLLBAR_MARGIN * 2, safeArea.left + safeArea.right),
            height: SCROLLBAR_WIDTH,
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
              ((viewportMinY - sceneMinY) / (sceneMaxY - sceneMinY)) *
                viewportHeight +
              Math.max(safeArea.top, SCROLLBAR_MARGIN),
            width: SCROLLBAR_WIDTH,
            height:
              ((viewportMaxY - viewportMinY) / (sceneMaxY - sceneMinY)) *
                viewportHeight -
              Math.max(SCROLLBAR_MARGIN * 2, safeArea.top + safeArea.bottom),
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
