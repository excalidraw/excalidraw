import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { MIME_TYPES } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";

import { hitElementBoundingBox } from "@excalidraw/element";

import type { RenderEnvironment } from "@excalidraw/element/renderEnvironment";

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

type LinkImgSlot = "external" | "element";

export type LinkImgStatus = "decoding" | "decoded" | "failed";

export type LinkImg = {
  /** Only safe as a `drawImage` source while `status` is `decoded`. */
  img: HTMLImageElement;
  status: LinkImgStatus;
};

/**
 * Built lazily so that importing this module never touches `document`. The
 * export pipeline pulls it in even in headless environments.
 *
 * Browsers decode `src` asynchronously, so a `drawImage` in the same task as
 * the `src` set silently draws nothing. Callers must check `status` and skip
 * the icon until the decode lands; `startLinkImgDecoding` kicks the decode off
 * on mount so it is settled long before a link icon is drawn.
 */
const linkImgs = new WeakMap<
  RenderEnvironment,
  Partial<Record<LinkImgSlot, LinkImg>>
>();

const settleLinkImg = (
  entry: LinkImg,
  status: Exclude<LinkImgStatus, "decoding">,
) => {
  // a host `createImage` may fire both handlers; the first settle wins, so a
  // late `onerror` can't undo a successful decode
  if (entry.status !== "decoding") {
    return;
  }
  entry.status = status;
};

const getLinkImg = (
  slot: LinkImgSlot,
  src: string,
  env: RenderEnvironment,
): LinkImg => {
  let slots = linkImgs.get(env);
  const existing = slots?.[slot];
  if (existing) {
    return existing;
  }
  const img = env.createImage();
  const entry: LinkImg = {
    img,
    status: img.complete && img.naturalWidth > 0 ? "decoded" : "decoding",
  };
  if (entry.status === "decoding") {
    img.onload = () => settleLinkImg(entry, "decoded");
    img.onerror = () => settleLinkImg(entry, "failed");
  }
  if (!slots) {
    slots = {};
    linkImgs.set(env, slots);
  }
  // registered before `src` so that a host firing `onload` synchronously
  // re-enters into the slot rather than starting another image
  slots[slot] = entry;
  img.src = src;
  return entry;
};

export const getExternalLinkImg = (renderEnvironment: RenderEnvironment) =>
  getLinkImg("external", EXTERNAL_LINK_SRC, renderEnvironment);
export const getElementLinkImg = (renderEnvironment: RenderEnvironment) =>
  getLinkImg("element", ELEMENT_LINK_SRC, renderEnvironment);

export const startLinkImgDecoding = (renderEnvironment: RenderEnvironment) => {
  getExternalLinkImg(renderEnvironment);
  getElementLinkImg(renderEnvironment);
};

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
