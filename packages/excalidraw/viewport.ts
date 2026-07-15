import {
  arrayToMap,
  easeOut,
  isBounds,
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
  getElementsInGroup,
  getVisibleElements,
  isElementLink,
  isExcalidrawElement,
  parseElementLinkFromURL,
} from "@excalidraw/element";

import type { SceneBounds } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";
import type {
  ExcalidrawElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { AnimationController } from "./renderer/animation";
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

export const SCROLL_TO_CONTENT_ANIMATION_KEY = "animateScrollToContent";
export const SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY =
  "animateScrollConstraintsSnapBack";

const DEFAULT_SCROLL_ANIMATION_DURATION = 500;

/** rubberband snap-back animation duration, in ms — kept snappier than the
 * default scroll animation so releasing an overscroll feels responsive */
const SNAP_BACK_ANIMATION_DURATION = 250;

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

export const isSetViewportRect = (
  target: unknown,
): target is SetViewportRect => {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return false;
  }

  const rect = target as Partial<SetViewportRect>;
  return (
    typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    (rect.width == null || typeof rect.width === "number") &&
    (rect.height == null || typeof rect.height === "number")
  );
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

const resolveAnimationDuration = (
  animation: AnimationOptions | boolean | undefined,
): number | null => {
  if (animation === false) {
    return null;
  }
  if (animation === true || animation == null) {
    return DEFAULT_SCROLL_ANIMATION_DURATION;
  }
  return animation.duration ?? DEFAULT_SCROLL_ANIMATION_DURATION;
};

const resolveOverscroll = (
  overscroll: boolean | number | undefined,
): number => {
  if (overscroll === false) {
    return 0;
  }
  if (overscroll === true || overscroll == null) {
    return DEFAULT_OVERSCROLL;
  }
  return Math.max(overscroll, 0);
};

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

export const isViewportOverscrolled = (
  state: Pick<
    AppState,
    "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
  >,
): boolean => {
  if (!state.scrollConstraints) {
    return false;
  }

  const target = constrainScrollState(state); // hard clamp (no overscroll give)

  return (
    target.scrollX !== state.scrollX ||
    target.scrollY !== state.scrollY ||
    target.zoom.value !== state.zoom.value
  );
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

/**
 * Rubberband snap-back: animates the viewport from its current (possibly
 * overscrolled) position back inside the lock box via the shared
 * AnimationController. No-op when already within the hard bounds (or when there
 * is no lock).
 */
export const snapBackToConstraints = (
  state: Pick<
    AppState,
    "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
  >,
  onFrame: (
    updater: (
      state: Pick<
        AppState,
        | "scrollX"
        | "scrollY"
        | "zoom"
        | "width"
        | "height"
        | "scrollConstraints"
      >,
    ) => Viewport | null,
  ) => void,
  duration = SNAP_BACK_ANIMATION_DURATION,
) => {
  const target = constrainScrollState(state); // hard clamp (no overscroll give)

  if (
    target.scrollX === state.scrollX &&
    target.scrollY === state.scrollY &&
    target.zoom.value === state.zoom.value
  ) {
    return;
  }

  // A programmatic navigation owns the viewport until it settles. A stale
  // rubberband debounce must not supersede it.
  if (AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)) {
    return;
  }

  // Keep the displacement zoom-independent. Each animation frame resolves
  // the resting viewport from the latest state, allowing zoom to update the
  // underlying viewport while the same on-screen rubberband distance decays.
  const overscrollX = (state.scrollX - target.scrollX) * state.zoom.value;
  const overscrollY = (state.scrollY - target.scrollY) * state.zoom.value;

  AnimationController.start<{ elapsed: number }>(
    SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY,
    ({ deltaTime, state: animationState }) => {
      const elapsed = (animationState?.elapsed ?? 0) + deltaTime;
      const progress = Math.min(elapsed / duration, 1);
      const remaining = 1 - easeOut(clamp(progress, 0, 1));

      onFrame((currentState) => {
        if (!currentState.scrollConstraints) {
          return null;
        }

        const restingViewport = constrainScrollState(currentState);
        const zoom = restingViewport.zoom.value;
        return {
          scrollX: restingViewport.scrollX + (overscrollX * remaining) / zoom,
          scrollY: restingViewport.scrollY + (overscrollY * remaining) / zoom,
          zoom: restingViewport.zoom,
        };
      });

      return progress < 1 ? { elapsed } : null;
    },
  );
};

/**
 * Scrolls (and, per `fit`, zooms) the viewport so the given target box is in
 * view, optionally animating the transition. `onComplete` runs once the
 * viewport has settled on the target.
 */
export const setViewportToBounds = (
  state: AppState,
  bounds: Bounds,
  // NOTE offsets must be resolved (see `App.resolveViewportOffsets`)
  opts: Pick<SetViewportOptions, "fit" | "animation"> & { offsets?: Offsets },
  onFrame: (
    state: Pick<
      AppState,
      "scrollX" | "scrollY" | "zoom" | "shouldCacheIgnoreZoom"
    >,
  ) => void,
  onComplete?: () => void,
) => {
  AnimationController.cancel(SCROLL_TO_CONTENT_ANIMATION_KEY);
  AnimationController.cancel(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);

  const viewport = getTargetViewport(state, bounds, opts.fit, opts.offsets);

  const duration = resolveAnimationDuration(opts.animation);

  if (duration === null) {
    // no animation: jump straight to the target. Re-enable zoom caching in
    // case we just cancelled an in-flight animation that had suppressed it.
    onFrame({ ...viewport, shouldCacheIgnoreZoom: false });
    onComplete?.();
  } else {
    animateToViewport(state, viewport, duration, onFrame, onComplete);
  }
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

/** Computes the viewport (scroll + zoom) that brings the target box into view,
 * based on the requested fit behavior. */
export const getTargetViewport = (
  state: AppState,
  bounds: Bounds,
  fit: SetViewportOptions["fit"] = "scale-down",
  offsets?: Offsets,
): Viewport => {
  const { appState } = zoomToFitBounds({
    bounds,
    appState: state,
    fit,
    canvasOffsets: offsets,
    steppedZoom: false,
  });

  return {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
  };
};

const getElementsFromId = (
  id: string,
  elementsMap: NonDeletedSceneElementsMap,
) => {
  const element = elementsMap.get(id);
  if (element) {
    return [element];
  }

  return getElementsInGroup(elementsMap, id);
};

export type ResolvedViewportTarget = {
  /** null when the target couldn't be resolved (unknown id/link, or all
   * supplied elements deleted) */
  bounds: Bounds | null;
  /** how the target was specified, so callers can react to unresolved
   * targets themselves (e.g. toast on a broken element link) */
  type: "element" | "area" | "link";
};

/** Resolves a `setViewport` target to a scene-coordinate box. */
export const resolveViewportTarget = (
  target: SetViewportOptions["target"],
  elementsMap: NonDeletedSceneElementsMap,
  appState: Pick<AppState, "width" | "height">,
): ResolvedViewportTarget => {
  if (typeof target === "string") {
    const isLink = isElementLink(target);
    const type = isLink ? ("link" as const) : ("element" as const);
    const id = isLink ? parseElementLinkFromURL(target) : target;
    const resolved = id ? getElementsFromId(id, elementsMap) : [];

    if (!resolved.length) {
      return { bounds: null, type };
    }

    return { bounds: getCommonBounds(resolved, elementsMap), type };
  }

  if (isBounds(target)) {
    return { bounds: target, type: "area" };
  }

  if (isSetViewportRect(target) && !isExcalidrawElement(target)) {
    const width = target.width ?? appState.width;
    const height = target.height ?? appState.height;
    return {
      bounds: [target.x, target.y, target.x + width, target.y + height],
      type: "area",
    };
  }

  // widening to null values in case the host app doesn't have
  // noUncheckedIndexedAccess enabled
  const targetElements: (ExcalidrawElement | undefined | null)[] =
    Array.isArray(target) ? target : [target];
  const elements = targetElements.reduce<NonDeleted<ExcalidrawElement>[]>(
    (acc, element) => {
      if (element && !element.isDeleted) {
        const sceneElement = elementsMap.get(element.id);
        if (sceneElement) {
          acc.push(sceneElement);
        }
      }
      return acc;
    },
    [],
  );

  const hasNoElements = !elements.length;
  if (elements.length !== targetElements.length || hasNoElements) {
    console.warn(
      "supplied element target(s) for setViewport contain deleted or non-existent elements which have been filtered out",
    );
  }

  if (hasNoElements) {
    return { bounds: null, type: "element" };
  }

  return { bounds: getCommonBounds(elements, elementsMap), type: "element" };
};

/** Computes the viewport patch for landing on `bounds`: the target
 * scroll/zoom, plus the scroll lock to install — or `scrollConstraints: null`
 * to clear a previous lock when none is requested. */
export const getConstrainedTargetViewport = (
  appState: AppState,
  bounds: Bounds,
  // NOTE offsets must be resolved (see `App.resolveViewportOffsets`)
  {
    fit,
    offsets,
    lock,
  }: Pick<SetViewportOptions, "fit" | "lock"> & { offsets?: Offsets },
): Viewport & { scrollConstraints: ScrollConstraints | null } => {
  const viewport = getTargetViewport(appState, bounds, fit, offsets);

  if (!lock?.scroll && !lock?.zoom) {
    return { ...viewport, scrollConstraints: null };
  }

  const [x1, y1, x2, y2] = bounds;
  const scrollConstraints: ScrollConstraints = {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    lockScroll: !!lock.scroll,
    lockZoom: !!lock.zoom,
    zoom: viewport.zoom.value,
    overscroll: resolveOverscroll(lock.overscroll),
    offsets,
  };

  return {
    ...constrainScrollState({ ...appState, ...viewport, scrollConstraints }),
    scrollConstraints,
  };
};

/**
 * Interpolates the viewport from `from` to `target` at the (already-eased)
 * blend amount `factor` (0 = `from`, 1 = `target`).
 *
 * Zoom is interpolated geometrically (so it feels uniform), but the pan can't
 * simply lerp alongside it: pairing a geometric zoom with a linear scroll (or
 * a linearly-tweened focal point) makes scene points swoop along curved,
 * non-monotone screen paths once the zoom ratio exceeds ~e (the destination
 * visibly drifts away before converging). Instead we interpolate the view
 * transform affinely — a scene point maps to screen as
 * `(scenePt + scroll) * zoom`, and requiring every point to travel a straight
 * screen line forces `zoom` to be a convex blend `(1-m)*z0 + m*z1` with
 * `scroll * zoom` lerped by that same weight. Deriving `m` from the geometric
 * zoom keeps its pacing while making all screen trajectories straight and
 * monotone.
 */
export const interpolateViewport = ({
  from,
  target,
  factor,
}: {
  from: Viewport;
  target: Viewport;
  factor: number;
}): Viewport => {
  if (factor >= 1) {
    // land bit-exactly on the target (`z0 * (z1/z0)^1` can be off by an ulp)
    return { ...target };
  }

  const zoom = (from.zoom.value *
    Math.pow(
      target.zoom.value / from.zoom.value,
      factor,
    )) as NormalizedZoomValue;

  // pan blend weight derived from the zoom blend (0/0 for pure pans, hence
  // the `factor` fallback; near-equal zooms are fine — the ratio limits to
  // `factor` smoothly)
  const m =
    target.zoom.value === from.zoom.value
      ? factor
      : (zoom - from.zoom.value) / (target.zoom.value - from.zoom.value);

  return {
    scrollX:
      ((1 - m) * from.scrollX * from.zoom.value +
        m * target.scrollX * target.zoom.value) /
      zoom,
    scrollY:
      ((1 - m) * from.scrollY * from.zoom.value +
        m * target.scrollY * target.zoom.value) /
      zoom,
    zoom: { value: zoom },
  };
};

/** Eases the viewport from its current position to `target` over `duration`,
 * driving the transition through the shared AnimationController so it doesn't
 * slow down other processes. */
const animateToViewport = (
  from: Viewport,
  target: Viewport,
  duration: number,
  onFrame: (
    state: Pick<
      AppState,
      "scrollX" | "scrollY" | "zoom" | "shouldCacheIgnoreZoom"
    >,
  ) => void,
  onComplete?: () => void,
) => {
  AnimationController.start<{ elapsed: number }>(
    SCROLL_TO_CONTENT_ANIMATION_KEY,
    ({ deltaTime, state }) => {
      const elapsed = (state?.elapsed ?? 0) + deltaTime;
      const progress = Math.min(elapsed / duration, 1);
      const factor = easeOut(clamp(progress, 0, 1));

      onFrame({
        ...interpolateViewport({ from, target, factor }),
        shouldCacheIgnoreZoom: progress < 1, // ignore zoom caching while animating
      });

      if (progress < 1) {
        return { elapsed };
      }

      onComplete?.();

      return null;
    },
  );
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
