import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { MIME_TYPES } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";
import {
  getRenderEnvironment,
  onRenderEnvironmentChange,
} from "@excalidraw/element";
import { hitElementBoundingBox } from "@excalidraw/element";

import type { GlobalPoint, Radians } from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";
import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { AppState } from "../../types";

export const DEFAULT_LINK_SIZE = 12;

const EXTERNAL_LINK_SRC = `data:${MIME_TYPES.svg}, ${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1971c2" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="feather feather-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
)}`;

const ELEMENT_LINK_SRC = `data:${MIME_TYPES.svg}, ${encodeURIComponent(
  `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="#1971c2"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-big-right-line"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v-3.586a1 1 0 0 1 1.707 -.707l6.586 6.586a1 1 0 0 1 0 1.414l-6.586 6.586a1 1 0 0 1 -1.707 -.707v-3.586h-6v-6h6z" /><path d="M3 9v6" /></svg>`,
)}`;

export type LinkImg = {
  /** Only safe as a `drawImage` source once `drawReady` is true. */
  img: HTMLImageElement;
  /** true once `src` has finished loading (success or failure). */
  drawReady: boolean;
};

/**
 * Built lazily (and cached) so that importing this module never touches
 * `document` — the export pipeline pulls it in even in headless environments.
 *
 * Browsers decode `src` asynchronously, so a `drawImage` in the same task as
 * the `src` set silently draws nothing. Callers must check `drawReady` and
 * repaint once `onLinkImgSettle` fires.
 */
const linkImgCache = new Map<string, LinkImg>();
onRenderEnvironmentChange(() => linkImgCache.clear());

const settleListeners = new Set<() => void>();

/**
 * Invoked when a lazily-created image becomes draw-ready or its load fails.
 * Fired at most once per image per environment.
 */
export const onLinkImgSettle = (listener: () => void) => {
  settleListeners.add(listener);
  return () => settleListeners.delete(listener);
};

const settleLinkImg = (entry: LinkImg) => {
  if (entry.drawReady) {
    return;
  }
  entry.drawReady = true;
  settleListeners.forEach((listener) => listener());
};

const getLinkImg = (src: string): LinkImg => {
  const cached = linkImgCache.get(src);
  if (cached) {
    return cached;
  }
  const img = getRenderEnvironment().createImage();
  const entry: LinkImg = {
    img,
    drawReady: img.complete && img.naturalWidth > 0,
  };
  if (!entry.drawReady) {
    img.onload = () => settleLinkImg(entry);
    img.onerror = () => settleLinkImg(entry);
  }
  img.src = src;
  linkImgCache.set(src, entry);
  return entry;
};

export const getExternalLinkImg = () => getLinkImg(EXTERNAL_LINK_SRC);
export const getElementLinkImg = () => getLinkImg(ELEMENT_LINK_SRC);

export const getLinkHandleFromCoords = (
  [x1, y1, x2, y2]: Bounds,
  angle: Radians,
  appState: Pick<AppState, "zoom">,
): Bounds => {
  const size = DEFAULT_LINK_SIZE;
  const zoom = appState.zoom.value > 1 ? appState.zoom.value : 1;
  const linkWidth = size / zoom;
  const linkHeight = size / zoom;
  const linkMarginY = size / zoom;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const centeringOffset = (size - 8) / (2 * zoom);
  const dashedLineMargin = 4 / zoom;

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
    hitElementBoundingBox(pointFrom(x, y), element, elementsMap)
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
