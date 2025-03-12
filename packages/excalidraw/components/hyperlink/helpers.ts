import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { GlobalPoint, Radians } from "@excalidraw/math";

import { MIME_TYPES } from "../../constants";
import { getElementAbsoluteCoords } from "../../element/bounds";
import { hitElementBoundingBox } from "../../element/collision";
import { DEFAULT_LINK_SIZE } from "../../renderer/renderElement";

import type { Bounds } from "../../element/bounds";
import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "../../element/types";
import type { AppState, UIAppState } from "../../types";

export const EXTERNAL_LINK_IMG = document.createElement("img");
EXTERNAL_LINK_IMG.src = `data:${MIME_TYPES.svg}, ${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1971c2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
)}`;

export const ELEMENT_LINK_IMG = document.createElement("img");
ELEMENT_LINK_IMG.src = `data:${MIME_TYPES.svg}, ${encodeURIComponent(
  `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="#1971c2"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-big-right-line"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v-3.586a1 1 0 0 1 1.707 -.707l6.586 6.586a1 1 0 0 1 0 1.414l-6.586 6.586a1 1 0 0 1 -1.707 -.707v-3.586h-6v-6h6z" /><path d="M3 9v6" /></svg>`,
)}`;

export const getLinkHandleFromCoords = (
  [x1, y1, x2, y2]: Bounds,
  angle: Radians,
  appState: Pick<UIAppState, "zoom">,
): Bounds => {
  const size = DEFAULT_LINK_SIZE;
  const linkWidth = size / appState.zoom.value;
  const linkHeight = size / appState.zoom.value;
  const linkMarginY = size / appState.zoom.value;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const centeringOffset = (size - 8) / (2 * appState.zoom.value);
  const dashedLineMargin = 4 / appState.zoom.value;

  // Same as `ne` resize handle
  const x = x2 + dashedLineMargin - centeringOffset;
  const y = y1 - dashedLineMargin - linkMarginY + centeringOffset;

  const [rotatedX, rotatedY] = pointRotateRads(
    pointFrom(x + linkWidth / 2, y + linkHeight / 2),
    pointFrom(centerX, centerY),
    angle,
  );
  return [
    rotatedX - linkWidth / 2,
    rotatedY - linkHeight / 2,
    linkWidth,
    linkHeight,
  ];
};

export const isPointHittingLinkIcon = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  appState: AppState,
  [x, y]: GlobalPoint,
) => {
  const threshold = 4 / appState.zoom.value;
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const [linkX, linkY, linkWidth, linkHeight] = getLinkHandleFromCoords(
    [x1, y1, x2, y2],
    element.angle,
    appState,
  );
  const hitLink =
    x > linkX - threshold &&
    x < linkX + threshold + linkWidth &&
    y > linkY - threshold &&
    y < linkY + linkHeight + threshold;
  return hitLink;
};

export const isPointHittingLink = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  appState: AppState,
  [x, y]: GlobalPoint,
  isMobile: boolean,
) => {
  if (!element.link || appState.selectedElementIds[element.id]) {
    return false;
  }
  if (
    !isMobile &&
    appState.viewModeEnabled &&
    hitElementBoundingBox(x, y, element, elementsMap)
  ) {
    return true;
  }
  return isPointHittingLinkIcon(
    element,
    elementsMap,
    appState,
    pointFrom(x, y),
  );
};
