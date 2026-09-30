import { DEFAULT_ZOOM, getStrokeWidthByKey } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { ExcalidrawElement } from "./types";

/** what measuring a tolerance or a new element's size on screen needs */
export type AuthoringView = Pick<AppState, "zoom" | "authoringUnits">;

/** zoom 1 in scene units, for work that has no view (restore, conversion) */
export const DEFAULT_AUTHORING_VIEW: AuthoringView = {
  zoom: DEFAULT_ZOOM,
  authoringUnits: "scene",
};

/**
 * Scene units per authoring unit: what a named stroke width, a font size, a
 * default element size or a tool tolerance is multiplied by to size it in the
 * scene. 1 with `authoringUnits: "scene"`; with `"screen"`, one screen pixel
 * at the current zoom.
 */
export const getAuthoringScale = (view: AuthoringView) =>
  view.authoringUnits === "screen" ? 1 / view.zoom.value : 1;

/**
 * How the fixed details drawn or laid out around an element (arrowheads,
 * dash patterns, rough.js wobble, label padding, binding gaps, sticky note
 * chrome) scale with it. They are sized for strokes at least as wide as the
 * thinnest named width, which is every element the UI makes at 1x, so this is
 * 1 for those; thinner strokes, which screen authoring makes when zoomed in,
 * shrink the details in proportion.
 */
export const getElementDetailScale = (
  element: Pick<ExcalidrawElement, "type" | "strokeWidth">,
) => {
  const thin = getStrokeWidthByKey(element.type, "thin");
  return element.strokeWidth > 0 && element.strokeWidth < thin
    ? element.strokeWidth / thin
    : 1;
};
