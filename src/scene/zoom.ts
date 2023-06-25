import { MIN_ZOOM } from "../constants";
import { AppState, NormalizedZoomValue } from "../types";

export const getNormalizedZoom = (zoom: number): NormalizedZoomValue => {
  return Math.max(MIN_ZOOM, Math.min(zoom, 30)) as NormalizedZoomValue;
};

/**
 * Calculates the new scroll position and zoom level based on the viewport size and the target zoom level. When no scroll position is provided, the current scroll position is used.
 *
 * @param {{
 *    viewportX: number;
 *    viewportY: number;
 *    nextZoom: NormalizedZoomValue;
 *    nextScrollX?: number;
 *    nextScrollY?: number;
 * }} {
 *    viewportX: the X-coordinate of the center of the viewport
 *    viewportY: the Y-coordinate of the center of the viewport
 *    nextZoom: the next zoom level
 *    nextScrollX: the desired X-coordinate of the upper-left corner of the canvas after zooming (optional)
 *    nextScrollY: the desired Y-coordinate of the upper-left corner of the canvas after zooming (optional)
 * }
 *
 * @param {AppState} appState: the current application state, which includes the current scroll position and zoom level
 */
export const getStateForZoom = (
  {
    viewportX,
    viewportY,
    nextZoom,
    nextScrollX,
    nextScrollY,
  }: {
    viewportX: number;
    viewportY: number;
    nextZoom: NormalizedZoomValue;
    nextScrollX?: number;
    nextScrollY?: number;
  },
  appState: AppState,
) => {
  // set scroll position to current scroll position if no scroll position is provided
  const scrollX = nextScrollX ?? appState.scrollX;
  const scrollY = nextScrollY ?? appState.scrollY;

  const appLayerX = viewportX - appState.offsetLeft;
  const appLayerY = viewportY - appState.offsetTop;

  const currentZoom = appState.zoom.value;

  // get original scroll position without zoom
  const baseScrollX = scrollX + (appLayerX - appLayerX / currentZoom);
  const baseScrollY = scrollY + (appLayerY - appLayerY / currentZoom);

  // get scroll offsets for target zoom level
  const zoomOffsetScrollX = -(appLayerX - appLayerX / nextZoom);
  const zoomOffsetScrollY = -(appLayerY - appLayerY / nextZoom);

  return {
    scrollX: baseScrollX + zoomOffsetScrollX,
    scrollY: baseScrollY + zoomOffsetScrollY,
    zoom: {
      value: nextZoom,
    },
  };
};
