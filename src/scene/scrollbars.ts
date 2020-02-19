import { ExcalidrawElement } from "../element/types";
import { getCommonBounds } from "../element";
import { FlooredNumber } from "../types";

const SCROLLBAR_MARGIN = 4;
export const SCROLLBAR_WIDTH = 6;
export const SCROLLBAR_COLOR = "rgba(0,0,0,0.3)";

export function getScrollBars(
  elements: readonly ExcalidrawElement[],
  viewportWidth: number,
  viewportHeight: number,
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
    zoom: number;
  },
) {
  // This is the bounding box of all the elements
  const [
    elementsMinX,
    elementsMinY,
    elementsMaxX,
    elementsMaxY,
  ] = getCommonBounds(elements);

  // Apply zoom
  const viewportWidthWithZoom = viewportWidth / zoom;
  const viewportHeightWithZoom = viewportHeight / zoom;

  const viewportWidthDiff = viewportWidth - viewportWidthWithZoom;
  const viewportHeightDiff = viewportHeight - viewportHeightWithZoom;

  // The viewport is the rectangle currently visible for the user
  const viewportMinX = -scrollX + viewportWidthDiff / 2;
  const viewportMinY = -scrollY + viewportHeightDiff / 2;
  const viewportMaxX = viewportMinX + viewportWidthWithZoom;
  const viewportMaxY = viewportMinY + viewportHeightWithZoom;

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
              ((viewportMinX - sceneMinX) / (sceneMaxX - sceneMinX)) *
                viewportWidth +
              SCROLLBAR_MARGIN,
            y: viewportHeight - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
            width:
              ((viewportMaxX - viewportMinX) / (sceneMaxX - sceneMinX)) *
                viewportWidth -
              SCROLLBAR_MARGIN * 2,
            height: SCROLLBAR_WIDTH,
          },
    vertical:
      viewportMinY === sceneMinY && viewportMaxY === sceneMaxY
        ? null
        : {
            x: viewportWidth - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
            y:
              ((viewportMinY - sceneMinY) / (sceneMaxY - sceneMinY)) *
                viewportHeight +
              SCROLLBAR_MARGIN,
            width: SCROLLBAR_WIDTH,
            height:
              ((viewportMaxY - viewportMinY) / (sceneMaxY - sceneMinY)) *
                viewportHeight -
              SCROLLBAR_MARGIN * 2,
          },
  };
}

export function isOverScrollBars(
  elements: readonly ExcalidrawElement[],
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
    zoom: number;
  },
) {
  const scrollBars = getScrollBars(elements, viewportWidth, viewportHeight, {
    scrollX,
    scrollY,
    zoom,
  });

  const [isOverHorizontalScrollBar, isOverVerticalScrollBar] = [
    scrollBars.horizontal,
    scrollBars.vertical,
  ].map(scrollBar => {
    return (
      scrollBar &&
      scrollBar.x <= x &&
      x <= scrollBar.x + scrollBar.width &&
      scrollBar.y <= y &&
      y <= scrollBar.y + scrollBar.height
    );
  });

  return {
    isOverHorizontalScrollBar,
    isOverVerticalScrollBar,
  };
}
