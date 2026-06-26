import { easeOut, MAX_ZOOM, MIN_ZOOM } from "@excalidraw/common";
import { clamp } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { zoomToFit } from "./actions/actionCanvas";
import { AnimationController } from "./renderer/animation";
import { getNormalizedZoom } from "./scene";
import { calculateScrollCenter } from "./scene/scroll";

import type {
  AppState,
  NormalizedZoomValue,
  Offsets,
  ScrollConstraints,
} from "./types";

export const SCROLL_TO_CONTENT_ANIMATION_KEY = "animateScrollToContent";

/** default duration of the scroll/zoom animation, in milliseconds */
const DEFAULT_ANIMATION_DURATION = 500;

export type ScrollToContentOptions = (
  | {
      fitToContent?: boolean;
      fitToViewport?: never;
      viewportZoomFactor?: number;
      animate?: boolean;
      duration?: number;
    }
  | {
      fitToContent?: never;
      fitToViewport?: boolean;
      /** when fitToViewport=true, how much screen should the content cover,
       * between 0.1 (10%) and 1 (100%) */
      viewportZoomFactor?: number;
      animate?: boolean;
      duration?: number;
    }
) & {
  minZoom?: number;
  maxZoom?: number;
  canvasOffsets?: Offsets;
};

type Viewport = Pick<AppState, "scrollX" | "scrollY" | "zoom">;

/**
 * The smallest zoom at which the constraint box still fully covers the viewport.
 * Below this, the viewport would extend past the box on its binding dimension,
 * so it becomes the enforced minimum zoom. When the box is smaller than the
 * viewport this is > 1, forcing a zoom-in (best-effort fit).
 */
export const getMinZoomForConstraints = (
  constraints: ScrollConstraints,
  viewport: { width: number; height: number },
): number =>
  clamp(
    Math.max(
      viewport.width / constraints.width,
      viewport.height / constraints.height,
    ),
    MIN_ZOOM,
    MAX_ZOOM,
  );

/**
 * Clamps a single scroll axis so the visible scene span stays inside the box.
 * The visible span is `[-scroll, -scroll + visibleSize]`; we keep it within
 * `[boxStart, boxStart + boxSize]`, expanded by `overscroll` on each side (for
 * rubberbanding). When the box can't cover the viewport on this axis (only at
 * the MAX_ZOOM cap for a tiny box) we center the box instead.
 */
const constrainScrollAxis = (
  scroll: number,
  boxStart: number,
  boxSize: number,
  visibleSize: number,
  overscroll: number,
): number => {
  const max = -boxStart + overscroll;
  const min = visibleSize - (boxStart + boxSize) - overscroll;
  return min > max ? (min + max) / 2 : clamp(scroll, min, max);
};

/**
 * Clamps a proposed scroll/zoom so that, when `scrollConstraints` is set, the
 * viewport cannot pan or zoom out of the box. Returns the input scroll/zoom
 * unchanged when there are no constraints. Because the whole viewport is kept
 * inside the box, any zoom anchor (which lives within the viewport) is also
 * guaranteed to stay inside the box.
 *
 * `tolerance` is the rubberband overscroll allowance, in screen pixels: the
 * viewport may pan past the box edges (and zoom out below the fit zoom) until
 * each edge has crossed the box by up to `tolerance` pixels on screen,
 * independent of the current zoom. Pass `0` (default) for a hard clamp.
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

  // relax the min zoom so the user can briefly zoom out past the fit zoom,
  // letting each viewport edge cross the box by up to `tolerance` screen px
  const relaxedMinZoom = getMinZoomForConstraints(scrollConstraints, {
    width: width - 2 * tolerance,
    height: height - 2 * tolerance,
  });
  const zoomValue = getNormalizedZoom(
    clamp(state.zoom.value, relaxedMinZoom, MAX_ZOOM),
  );

  // `tolerance` screen px expressed in scene coords at the current zoom
  const overscroll = tolerance / zoomValue;

  return {
    scrollX: constrainScrollAxis(
      state.scrollX,
      scrollConstraints.x,
      scrollConstraints.width,
      width / zoomValue,
      overscroll,
    ),
    scrollY: constrainScrollAxis(
      state.scrollY,
      scrollConstraints.y,
      scrollConstraints.height,
      height / zoomValue,
      overscroll,
    ),
    zoom: { value: zoomValue },
  };
};

/**
 * Rubberband snap-back: animates the viewport from its current (possibly
 * overscrolled) position back inside the constraint box via the shared
 * AnimationController. No-op when already within the hard bounds (or when there
 * are no constraints).
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
  duration = DEFAULT_ANIMATION_DURATION,
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
 * Scrolls (and optionally zooms) the viewport so that the given target is in
 * view, optionally animating the transition.
 */
export const scrollToElements = (
  state: AppState,
  target: readonly ExcalidrawElement[],
  onFrame: (
    state: Pick<
      AppState,
      "scrollX" | "scrollY" | "zoom" | "shouldCacheIgnoreZoom"
    >,
  ) => void,
  opts?: ScrollToContentOptions,
) => {
  AnimationController.cancel(SCROLL_TO_CONTENT_ANIMATION_KEY);

  const viewport = getTargetViewport(state, target, opts);

  if (opts?.animate) {
    animateToViewport(
      state,
      viewport,
      opts.duration ?? DEFAULT_ANIMATION_DURATION,
      onFrame,
    );
  } else {
    // no animation: jump straight to the target. Re-enable zoom caching in
    // case we just cancelled an in-flight animation that had suppressed it.
    onFrame({ ...viewport, shouldCacheIgnoreZoom: false });
  }
};

/** Computes the viewport (scroll + zoom) that brings the target elements into
 * view, based on the requested fit behavior. */
const getTargetViewport = (
  state: AppState,
  targetElements: readonly ExcalidrawElement[],
  opts?: ScrollToContentOptions,
): Viewport => {
  if (opts?.fitToContent || opts?.fitToViewport) {
    const { appState } = zoomToFit({
      canvasOffsets: opts.canvasOffsets,
      targetElements,
      appState: state,
      fitToViewport: !!opts.fitToViewport,
      viewportZoomFactor: opts.viewportZoomFactor,
      minZoom: opts.minZoom,
      maxZoom: opts.maxZoom,
    });

    return {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
    };
  }
  // keep the current zoom, only recenter the viewport on the target
  const { scrollX, scrollY } = calculateScrollCenter(targetElements, state);

  return { scrollX, scrollY, zoom: state.zoom };
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

      return progress < 1 ? { elapsed } : null;
    },
  );
};
