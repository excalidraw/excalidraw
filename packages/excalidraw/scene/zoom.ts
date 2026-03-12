import type { AppState, NormalizedZoomValue } from "../types";
import { constrainScrollState } from "./scrollConstraints";

/**
 * When zooming out with scroll constraints active, the cursor-anchored zoom may
 * produce a scroll position outside the valid bounds, causing a snap-back.
 *
 * This function adjusts the effective zoom anchor point so the resulting scroll
 * stays within bounds — silently, without any snap. When no adjustment is needed
 * (zoom-in, no constraints, or already within bounds) it returns the original
 * viewport position unchanged.
 */
export const getConstrainedZoomAnchor = (
  {
    viewportX,
    viewportY,
    nextZoom,
  }: { viewportX: number; viewportY: number; nextZoom: NormalizedZoomValue },
  state: AppState,
): { viewportX: number; viewportY: number } => {
  if (!state.scrollConstraints || nextZoom >= state.zoom.value) {
    return { viewportX, viewportY };
  }

  const appLayerX = viewportX - state.offsetLeft;
  const appLayerY = viewportY - state.offsetTop;
  const factor = 1 / nextZoom - 1 / state.zoom.value;

  const newScrollX = state.scrollX + appLayerX * factor;
  const newScrollY = state.scrollY + appLayerY * factor;

  const constrained = constrainScrollState(
    { ...state, scrollX: newScrollX, scrollY: newScrollY, zoom: { value: nextZoom } },
    "rigid",
  );

  if (constrained.scrollX === newScrollX && constrained.scrollY === newScrollY) {
    return { viewportX, viewportY };
  }

  const adjustedAppLayerX =
    constrained.scrollX !== newScrollX
      ? (constrained.scrollX - state.scrollX) / factor
      : appLayerX;
  const adjustedAppLayerY =
    constrained.scrollY !== newScrollY
      ? (constrained.scrollY - state.scrollY) / factor
      : appLayerY;

  return {
    viewportX: adjustedAppLayerX + state.offsetLeft,
    viewportY: adjustedAppLayerY + state.offsetTop,
  };
};

export const getStateForZoom = (
  {
    viewportX,
    viewportY,
    nextZoom,
  }: {
    viewportX: number;
    viewportY: number;
    nextZoom: NormalizedZoomValue;
  },
  appState: AppState,
) => {
  const appLayerX = viewportX - appState.offsetLeft;
  const appLayerY = viewportY - appState.offsetTop;

  const currentZoom = appState.zoom.value;

  // get original scroll position without zoom
  const baseScrollX = appState.scrollX + (appLayerX - appLayerX / currentZoom);
  const baseScrollY = appState.scrollY + (appLayerY - appLayerY / currentZoom);

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
