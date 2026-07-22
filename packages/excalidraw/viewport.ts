// this file contains viewport-related utilities that are stateless or
// reused throughout the codebase not just directly by App.tsx or AppViewport
//
// for editor instance specific, see App.viewport.ts

import {
  arrayToMap,
  MAX_ZOOM,
  MIN_ZOOM,
  viewportCoordsToSceneCoords,
  ZOOM_STEP,
} from "@excalidraw/common";
import { clamp, pointDistance, pointFrom, roundToStep } from "@excalidraw/math";

import {
  CaptureUpdateAction,
  getCommonBounds,
  getElementBounds,
  getVisibleElements,
} from "@excalidraw/element";

import type { SceneBounds } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getNormalizedZoom } from "./scene";

import type {
  AppState,
  NormalizedZoomValue,
  Offsets,
  PointerCoords,
  ScrollConstraints,
  ViewportOffsets,
  Zoom,
} from "./types";

/** default rubberband overscroll give for scroll locks, in viewport px */
export const DEFAULT_OVERSCROLL = 150;

type ZoomOptions = {
  viewportX: number;
  viewportY: number;
  nextZoom: NormalizedZoomValue;
};

export type AnimationOptions = {
  duration?: number;
};

export type SetViewportRect = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type SetViewportOptions = {
  /**
   * what to show in the viewport: an explicit scene-coordinate box/rect,
   * element(s), or an element id / element-link URL.
   *
   * IMPORTANT: if supplying ExcalidrawElement(s), only non-deleted elements
   * that actually exist on the canvas are considered. If you want to navigate
   * to elements that's not on canvas yet, supply their bounds by using
   * `getCommonBounds` (see {@link getCommonBounds}).
   */
  target:
    | Bounds
    | SetViewportRect
    | ExcalidrawElement
    | readonly ExcalidrawElement[]
    | string;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit
   *
   * - `scale-down` - zoom out so the target fits the viewport, never zooming past 100%
   * - `contain` - zoom the target so it fills the viewport (may exceed 100%)
   * - `none` - keep the current zoom, only center the target in the viewport
   */
  fit?: "scale-down" | "contain" | "none";

  lock?: {
    /** constraints panning to the target box */
    scroll?: ScrollConstraints["lockScroll"];
    /** makes the resolved zoom the minimum zoom */
    zoom?: ScrollConstraints["lockZoom"];
    /**
     * Rubberband give past the lock, in viewport px (zoom-independent): how
     * far the user can pan beyond the constraint before snapping back.
     * `true` (default) uses {@link DEFAULT_OVERSCROLL}, `false` disables
     * (rigid lock), a number sets the give explicitly.
     */
    overscroll?: boolean | number;
  };

  animation?: AnimationOptions | boolean;

  /**
   * CSS-style per-side viewport insets, in viewport pixels
   * (zoom-independent) — static values, editor-UI-derived (`ui`), or a
   * combination. See {@link ViewportOffsets}.
   */
  offsets?: ViewportOffsets;
};

type Viewport = Pick<AppState, "scrollX" | "scrollY" | "zoom">;

/**
 * Clamps a single scroll axis so the visible scene span stays inside the box.
 * The visible span is `[-scroll, -scroll + visibleSize]`; we keep it within
 * `[boxStart, boxStart + boxSize]`, expanded by `offsetStart`/`offsetEnd` at
 * the low/high edge. When the box can't cover the viewport on this axis (the
 * viewport is larger than the box) the box rests centered instead.
 * `overscroll` is pure rubberband give: it widens the allowed range by that
 * much on both sides of the resting position, regardless of the geometry.
 */
const constrainScrollAxis = (
  scroll: number,
  boxStart: number,
  boxSize: number,
  visibleSize: number,
  offsetStart: number,
  offsetEnd: number,
  overscroll: number,
): number => {
  const max = -boxStart + offsetStart;
  const min = visibleSize - (boxStart + boxSize) - offsetEnd;
  if (min > max) {
    // box can't cover the viewport: rest at center, with rubberband give
    const center = (min + max) / 2;
    return clamp(scroll, center - overscroll, center + overscroll);
  }
  return clamp(scroll, min - overscroll, max + overscroll);
};

/**
 * Clamps a proposed scroll/zoom against the active lock (`scrollConstraints`).
 * Returns the input scroll/zoom unchanged when there is no lock.
 * `overscroll` (screen px, zoom-independent) is rubberband give past the
 * resting clamp — pass 0 for a hard clamp.
 */
export const constrainScrollState = (
  state: Pick<
    AppState,
    "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
  >,
  overscroll = 0,
): Viewport => {
  const { scrollConstraints, width, height } = state;

  if (!scrollConstraints) {
    return { scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom };
  }

  const minZoom = scrollConstraints.lockZoom
    ? scrollConstraints.zoom
    : MIN_ZOOM;
  const zoomValue = getNormalizedZoom(
    clamp(state.zoom.value, minZoom, MAX_ZOOM),
  );

  if (!scrollConstraints.lockScroll) {
    return {
      scrollX: state.scrollX,
      scrollY: state.scrollY,
      zoom: { value: zoomValue },
    };
  }

  const give = Math.max(overscroll, 0) / zoomValue;
  const offsets = scrollConstraints.offsets;
  const offsetTop = (offsets?.top ?? 0) / zoomValue;
  const offsetRight = (offsets?.right ?? 0) / zoomValue;
  const offsetBottom = (offsets?.bottom ?? 0) / zoomValue;
  const offsetLeft = (offsets?.left ?? 0) / zoomValue;

  return {
    scrollX: constrainScrollAxis(
      state.scrollX,
      scrollConstraints.x,
      scrollConstraints.width,
      width / zoomValue,
      offsetLeft,
      offsetRight,
      give,
    ),
    scrollY: constrainScrollAxis(
      state.scrollY,
      scrollConstraints.y,
      scrollConstraints.height,
      height / zoomValue,
      offsetTop,
      offsetBottom,
      give,
    ),
    zoom: { value: zoomValue },
  };
};

/** private helper. Use {@link getViewportForZoomWithScrollConstraints} instead */
const getViewportForZoom = (
  { viewportX, viewportY, nextZoom }: ZoomOptions,
  appState: AppState,
): Viewport => {
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

/**
 * Resolves a focal-point zoom against the active scroll constraints while
 * preserving the current rubberband displacement in screen pixels. This lets
 * zoom and scroll-constraint snap-back compose without either visually
 * cancelling the other.
 */
export const getViewportForZoomWithScrollConstraints = (
  opts: ZoomOptions,
  state: AppState,
): Viewport => {
  const restingViewport = constrainScrollState(state);
  const overscrollX =
    (state.scrollX - restingViewport.scrollX) * state.zoom.value;
  const overscrollY =
    (state.scrollY - restingViewport.scrollY) * state.zoom.value;

  const zoomedViewport = constrainScrollState({
    ...state,
    ...getViewportForZoom(opts, state),
  });

  if (!state.scrollConstraints?.lockScroll || (!overscrollX && !overscrollY)) {
    return zoomedViewport;
  }

  const zoom = zoomedViewport.zoom.value;
  return constrainScrollState(
    {
      ...state,
      ...zoomedViewport,
      scrollX: zoomedViewport.scrollX + overscrollX / zoom,
      scrollY: zoomedViewport.scrollY + overscrollY / zoom,
    },
    state.scrollConstraints.overscroll,
  );
};

const zoomValueToFitBoundsOnViewport = (
  bounds: SceneBounds,
  viewportDimensions: { width: number; height: number },
) => {
  const [x1, y1, x2, y2] = bounds;
  const commonBoundsWidth = x2 - x1;
  const zoomValueForWidth = viewportDimensions.width / commonBoundsWidth;
  const commonBoundsHeight = y2 - y1;
  const zoomValueForHeight = viewportDimensions.height / commonBoundsHeight;
  const smallestZoomValue = Math.min(zoomValueForWidth, zoomValueForHeight);

  return Math.min(smallestZoomValue, 1);
};

export const zoomToFitBounds = ({
  bounds,
  appState,
  canvasOffsets,
  fit = "scale-down",
  minZoom = -Infinity,
  maxZoom = Infinity,
  steppedZoom = false,
}: {
  bounds: SceneBounds;
  canvasOffsets?: Offsets;
  appState: Readonly<AppState>;
  fit?: SetViewportOptions["fit"];
  minZoom?: number;
  maxZoom?: number;
  steppedZoom?: boolean;
}) => {
  const [x1, y1, x2, y2] = bounds;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  const canvasOffsetLeft = canvasOffsets?.left ?? 0;
  const canvasOffsetTop = canvasOffsets?.top ?? 0;
  const canvasOffsetRight = canvasOffsets?.right ?? 0;
  const canvasOffsetBottom = canvasOffsets?.bottom ?? 0;

  const effectiveCanvasWidth =
    appState.width - canvasOffsetLeft - canvasOffsetRight;
  const effectiveCanvasHeight =
    appState.height - canvasOffsetTop - canvasOffsetBottom;

  let adjustedZoomValue;

  if (fit === "none") {
    // pan-only: keep the current zoom, just center the target
    adjustedZoomValue = appState.zoom.value;
  } else if (fit === "contain") {
    const commonBoundsWidth = x2 - x1;
    const commonBoundsHeight = y2 - y1;

    adjustedZoomValue = Math.min(
      effectiveCanvasWidth / commonBoundsWidth,
      effectiveCanvasHeight / commonBoundsHeight,
    );
  } else {
    adjustedZoomValue = zoomValueToFitBoundsOnViewport(bounds, {
      width: effectiveCanvasWidth,
      height: effectiveCanvasHeight,
    });
  }

  const targetZoomValue =
    steppedZoom && fit !== "none"
      ? roundToStep(adjustedZoomValue, ZOOM_STEP, "floor")
      : adjustedZoomValue;

  const newZoomValue = getNormalizedZoom(
    clamp(targetZoomValue, minZoom, maxZoom),
  );

  const centerScroll = centerScrollOn({
    scenePoint: { x: centerX, y: centerY },
    viewportDimensions: {
      width: appState.width,
      height: appState.height,
    },
    offsets: canvasOffsets,
    zoom: { value: newZoomValue },
  });

  return {
    appState: {
      ...appState,
      scrollX: centerScroll.scrollX,
      scrollY: centerScroll.scrollY,
      zoom: { value: newZoomValue },
    },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  };
};

const doBoundsExceedViewport = (appState: AppState, bounds: Bounds) => {
  const [x1, y1, x2, y2] = bounds;
  return (
    (x2 - x1) * appState.zoom.value > appState.width ||
    (y2 - y1) * appState.zoom.value > appState.height
  );
};

export const getClosestElementBounds = (
  elements: readonly ExcalidrawElement[],
  from: { x: number; y: number },
): Bounds => {
  if (!elements.length) {
    return [0, 0, 0, 0];
  }

  let minDistance = Infinity;
  let closestElement = elements[0];
  const elementsMap = arrayToMap(elements);
  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
    const distance = pointDistance(
      pointFrom((x1 + x2) / 2, (y1 + y2) / 2),
      pointFrom(from.x, from.y),
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestElement = element;
    }
  });

  return getElementBounds(closestElement, elementsMap);
};

export const centerScrollOn = ({
  scenePoint,
  viewportDimensions,
  zoom,
  offsets,
}: {
  scenePoint: PointerCoords;
  viewportDimensions: { height: number; width: number };
  zoom: Zoom;
  offsets?: Offsets;
}) => {
  let scrollX =
    (viewportDimensions.width - (offsets?.right ?? 0)) / 2 / zoom.value -
    scenePoint.x;

  scrollX += (offsets?.left ?? 0) / 2 / zoom.value;

  let scrollY =
    (viewportDimensions.height - (offsets?.bottom ?? 0)) / 2 / zoom.value -
    scenePoint.y;

  scrollY += (offsets?.top ?? 0) / 2 / zoom.value;

  return {
    scrollX,
    scrollY,
  };
};

export const getScrollToContentState = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): { scrollX: number; scrollY: number } => {
  elements = getVisibleElements(elements);

  if (!elements.length) {
    return {
      scrollX: 0,
      scrollY: 0,
    };
  }
  let [x1, y1, x2, y2] = getCommonBounds(elements);

  if (doBoundsExceedViewport(appState, [x1, y1, x2, y2])) {
    [x1, y1, x2, y2] = getClosestElementBounds(
      elements,
      viewportCoordsToSceneCoords(
        {
          clientX: appState.offsetLeft + appState.width / 2,
          clientY: appState.offsetTop + appState.height / 2,
        },
        appState,
      ),
    );
  }

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return centerScrollOn({
    scenePoint: { x: centerX, y: centerY },
    viewportDimensions: { width: appState.width, height: appState.height },
    zoom: appState.zoom,
  });
};
