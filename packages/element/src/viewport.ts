// Viewport visibility checks for elements (separate from sizeHelpers so that
// module doesn't depend on element bounds).

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import type { Zoom } from "@excalidraw/common";

import { getCommonBounds, getElementBounds } from "./bounds";

import type { ElementsMap, ExcalidrawElement } from "./types";
import type { Offsets } from "./types";

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
