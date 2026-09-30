import { DEFAULT_ZOOM } from "@excalidraw/common";

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
 * The `authoringScale` a new element made in this view carries, spread into
 * its constructor options. Omitted at 1, so scene authoring writes the same
 * elements as upstream.
 */
export const getAuthoringScaleField = (
  view: AuthoringView,
): Pick<ExcalidrawElement, "authoringScale"> => {
  const authoringScale = getAuthoringScale(view);
  return authoringScale === 1 ? {} : { authoringScale };
};

/**
 * How the fixed details drawn or laid out around an element (arrowheads,
 * dash patterns, rough.js wobble, label padding, binding gaps, sticky note
 * chrome) scale with it: the authoring scale it was made at, so they look on
 * screen as they do at 1x at any stroke width.
 */
export const getElementDetailScale = (
  element: Pick<ExcalidrawElement, "authoringScale">,
) => element.authoringScale ?? 1;
