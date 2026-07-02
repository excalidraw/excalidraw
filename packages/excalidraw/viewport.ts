import {
  arrayToMap,
  easeOut,
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

import { AnimationController } from "./renderer/animation";
import { getNormalizedZoom } from "./scene";

import type {
  AppState,
  NormalizedZoomValue,
  Offsets,
  PointerCoords,
  ScrollConstraints,
  Zoom,
} from "./types";

export const SCROLL_TO_CONTENT_ANIMATION_KEY = "animateScrollToContent";

const DEFAULT_SCROLL_ANIMATION_DURATION = 250;

export type AnimationOptions = {
  duration?: number;
};

export type ScrollToRect = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export const isScrollToRect = (target: unknown): target is ScrollToRect => {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return false;
  }

  const rect = target as Partial<ScrollToRect>;
  return (
    typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    (rect.width == null || typeof rect.width === "number") &&
    (rect.height == null || typeof rect.height === "number")
  );
};

export type ScrollToOptions = {
  /** what to scroll to: an explicit scene-coordinate box/rect, element(s), or
   * an element id / element-link URL
   */
  target:
    | Bounds
    | ScrollToRect
    | ExcalidrawElement
    | readonly ExcalidrawElement[]
    | string;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit
   *
   * - `scale-down` - zoom out so the target fits the viewport, never zooming past 100%
   * - `contain` - zoom the target so it fills the viewport (may exceed 100%)
   */
  fit?: "scale-down" | "contain";

  lock?: {
    /** constraints panning to the target box */
    scroll?: ScrollConstraints["lockScroll"];
    /** makes the resolved zoom the minimum zoom */
    zoom?: ScrollConstraints["lockZoom"];
    /** rubberband overscroll allowance in viewport px */
    tolerance?: ScrollConstraints["tolerance"];
  };

  animation?: AnimationOptions | boolean;

  /** CSS-style padding in viewport pixels, zoom-independent. */
  offset?: ScrollConstraints["offset"];
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

/**
 * Clamps a single scroll axis so the visible scene span stays inside the box.
 * The visible span is `[-scroll, -scroll + visibleSize]`; we keep it within
 * `[boxStart, boxStart + boxSize]`, expanded by `startExpand` at the low edge
 * and `endExpand` at the high edge (rubberband overscroll plus any offset).
 * When the box can't cover the viewport on this axis (the viewport is larger
 * than the box) we center the box instead.
 */
const constrainScrollAxis = (
  scroll: number,
  boxStart: number,
  boxSize: number,
  visibleSize: number,
  startExpand: number,
  endExpand: number,
): number => {
  const max = -boxStart + startExpand;
  const min = visibleSize - (boxStart + boxSize) - endExpand;
  return min > max ? (min + max) / 2 : clamp(scroll, min, max);
};

/**
 * Clamps a proposed scroll/zoom against the active lock (`scrollConstraints`).
 * Returns the input scroll/zoom unchanged when there is no lock.
 */
export const constrainScrollState = (
  state: Pick<
    AppState,
    "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
  >,
  tolerance = 0,
): Viewport => {
  const { scrollConstraints, width, height } = state;

  if (!scrollConstraints) {
    return { scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom };
  }

  tolerance = Math.max(tolerance, 0);

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

  const overscroll = tolerance / zoomValue;
  const offset = scrollConstraints.offset;
  const offsetTop = (offset?.top ?? 0) / zoomValue;
  const offsetRight = (offset?.right ?? 0) / zoomValue;
  const offsetBottom = (offset?.bottom ?? 0) / zoomValue;
  const offsetLeft = (offset?.left ?? 0) / zoomValue;

  return {
    scrollX: constrainScrollAxis(
      state.scrollX,
      scrollConstraints.x,
      scrollConstraints.width,
      width / zoomValue,
      overscroll + offsetLeft,
      overscroll + offsetRight,
    ),
    scrollY: constrainScrollAxis(
      state.scrollY,
      scrollConstraints.y,
      scrollConstraints.height,
      height / zoomValue,
      overscroll + offsetTop,
      overscroll + offsetBottom,
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

  const target = constrainScrollState(state); // hard clamp (tolerance 0)

  return (
    target.scrollX !== state.scrollX ||
    target.scrollY !== state.scrollY ||
    target.zoom.value !== state.zoom.value
  );
};

/**
 * Rubberband snap-back: animates the viewport from its current (possibly
 * overscrolled) position back inside the lock box via the shared
 * AnimationController. No-op when already within the hard bounds (or when there
 * is no lock).
 */
export const animateToConstraints = (
  state: Pick<
    AppState,
    "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
  >,
  onFrame: (
    viewport: Pick<
      AppState,
      "scrollX" | "scrollY" | "zoom" | "shouldCacheIgnoreZoom"
    >,
  ) => void,
  duration = DEFAULT_SCROLL_ANIMATION_DURATION,
) => {
  const target = constrainScrollState(state); // hard clamp (tolerance 0)

  if (
    target.scrollX === state.scrollX &&
    target.scrollY === state.scrollY &&
    target.zoom.value === state.zoom.value
  ) {
    return;
  }

  animateToViewport(state, target, duration, onFrame);
};

/**
 * Scrolls (and, per `fit`, zooms) the viewport so the given target box is
 * in view, optionally animating the transition. `onComplete` runs once the
 * viewport has settled on the target.
 */
export const scrollToBounds = (
  state: AppState,
  bounds: Bounds,
  opts: Pick<ScrollToOptions, "fit" | "animation" | "offset">,
  onFrame: (
    state: Pick<
      AppState,
      "scrollX" | "scrollY" | "zoom" | "shouldCacheIgnoreZoom"
    >,
  ) => void,
  onComplete?: () => void,
) => {
  AnimationController.cancel(SCROLL_TO_CONTENT_ANIMATION_KEY);

  const viewport = getTargetViewport(state, bounds, opts.fit, opts.offset);

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
  steppedZoom = true,
}: {
  bounds: SceneBounds;
  canvasOffsets?: Offsets;
  appState: Readonly<AppState>;
  fit?: ScrollToOptions["fit"];
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

  if (fit === "contain") {
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

  const targetZoomValue = steppedZoom
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
  fit: ScrollToOptions["fit"] = "scale-down",
  offset?: Offsets,
): Viewport => {
  const { appState } = zoomToFitBounds({
    bounds,
    appState: state,
    fit,
    canvasOffsets: offset,
    steppedZoom: false,
  });

  return {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
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
