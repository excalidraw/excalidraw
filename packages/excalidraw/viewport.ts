import { easeOut, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "@excalidraw/common";
import { clamp, roundToStep } from "@excalidraw/math";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { SceneBounds } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { AnimationController } from "./renderer/animation";
import { getNormalizedZoom } from "./scene";

import { centerScrollOn } from "./scene/scroll";

import type { AppState, NormalizedZoomValue, Offsets } from "./types";

export const SCROLL_TO_CONTENT_ANIMATION_KEY = "animateScrollToContent";

const DEFAULT_SCROLL_ANIMATION_DURATION = 250;

export type AnimationOptions = {
  duration?: number;
};

export type ScrollToOptions = {
  /** what to scroll to: an explicit scene-coordinate box, element(s), or an
   * element id / element-link URL
   */
  target: Bounds | ExcalidrawElement | readonly ExcalidrawElement[] | string;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit
   *
   * - `scale-down` - zoom out so the target fits the viewport, never zooming past 100%
   * - `contain` - zoom the target so it fills the viewport (may exceed 100%)
   */
  fit?: "scale-down" | "contain";

  lock?: {
    /** constraints panning to the target box */
    scroll?: boolean;
    /** makes the resolved zoom the minimum zoom */
    zoom?: boolean;
    /** rubberband overscroll allowance in viewport px */
    tolerance?: number;
  };

  animation?: AnimationOptions | boolean;

  /** CSS-style padding in viewport pixels, zoom-independent. */
  offset?: Offsets;
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
 * viewport has settled on the target. `elements` (when the target was resolved
 * from elements) is used only by `panOnly` to preserve the closest-element
 * overflow fallback.
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
  elements?: readonly ExcalidrawElement[],
) => {
  AnimationController.cancel(SCROLL_TO_CONTENT_ANIMATION_KEY);

  const viewport = getTargetViewport(
    state,
    bounds,
    opts.fit,
    opts.offset,
    elements,
  );

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
  elements?: readonly ExcalidrawElement[],
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
 * Zoom is interpolated geometrically (so it feels uniform), and rather than
 * tweening scrollX/scrollY directly we tween the *focal point* — the scene
 * point under the viewport center — and derive scroll from it. Mixing a linear
 * scroll with a geometric zoom makes the focal point swoop sideways
 * mid-animation (most visible when zooming out); gliding the focal point keeps
 * it steady. `width/2/zoom - scroll` is the inverse of `centerScrollOn` without
 * offsets, so factor 0/1 land exactly on `from`/`target`.
 */
export const interpolateViewport = ({
  from,
  target,
  factor,
}: {
  from: Pick<AppState, "scrollX" | "scrollY" | "zoom" | "width" | "height">;
  target: Viewport;
  factor: number;
}): Viewport => {
  const zoom = (from.zoom.value *
    Math.pow(
      target.zoom.value / from.zoom.value,
      factor,
    )) as NormalizedZoomValue;

  const fromCenterX = from.width / 2 / from.zoom.value - from.scrollX;
  const fromCenterY = from.height / 2 / from.zoom.value - from.scrollY;
  const toCenterX = from.width / 2 / target.zoom.value - target.scrollX;
  const toCenterY = from.height / 2 / target.zoom.value - target.scrollY;

  const centerX = fromCenterX + (toCenterX - fromCenterX) * factor;
  const centerY = fromCenterY + (toCenterY - fromCenterY) * factor;

  return {
    scrollX: from.width / 2 / zoom - centerX,
    scrollY: from.height / 2 / zoom - centerY,
    zoom: { value: zoom },
  };
};

/** Eases the viewport from its current position to `target` over `duration`,
 * driving the transition through the shared AnimationController so it doesn't
 * slow down other processes. */
const animateToViewport = (
  from: Pick<AppState, "scrollX" | "scrollY" | "zoom" | "width" | "height">,
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
