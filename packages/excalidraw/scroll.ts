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
 * `[boxStart, boxStart + boxSize]`. When the box can't cover the viewport on
 * this axis (only at the MAX_ZOOM cap for a tiny box) we center the box instead.
 */
const constrainScrollAxis = (
  scroll: number,
  boxStart: number,
  boxSize: number,
  visibleSize: number,
): number => {
  const max = -boxStart;
  const min = visibleSize - (boxStart + boxSize);
  return min > max ? (min + max) / 2 : clamp(scroll, min, max);
};

/**
 * Clamps a proposed scroll/zoom so that, when `scrollConstraints` is set, the
 * viewport cannot pan or zoom out of the box. Returns the input scroll/zoom
 * unchanged when there are no constraints. Because the whole viewport is kept
 * inside the box, any zoom anchor (which lives within the viewport) is also
 * guaranteed to stay inside the box.
 */
export const constrainScrollState = (
  state: Pick<
    AppState,
    "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
  >,
): Viewport => {
  const { scrollConstraints, width, height } = state;

  if (!scrollConstraints) {
    return { scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom };
  }

  const minZoom = getMinZoomForConstraints(scrollConstraints, {
    width,
    height,
  });
  const zoomValue = getNormalizedZoom(
    clamp(state.zoom.value, minZoom, MAX_ZOOM),
  );

  return {
    scrollX: constrainScrollAxis(
      state.scrollX,
      scrollConstraints.x,
      scrollConstraints.width,
      width / zoomValue,
    ),
    scrollY: constrainScrollAxis(
      state.scrollY,
      scrollConstraints.y,
      scrollConstraints.height,
      height / zoomValue,
    ),
    zoom: { value: zoomValue },
  };
};

/**
 * Scrolls (and optionally zooms) the viewport so that the given target is in
 * view, optionally animating the transition.
 */
export const scrollToElements = (
  state: AppState,
  target: readonly ExcalidrawElement[],
  onFrame: (state: Pick<AppState, "scrollX" | "scrollY" | "zoom">) => void,
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
    onFrame(viewport);
  }
};

/** Computes the viewport (scroll + zoom) that brings the target elements into
 * view, based on the requested fit behavior. */
const getTargetViewport = (
  state: AppState,
  targetElements: readonly ExcalidrawElement[],
  opts?: ScrollToContentOptions,
): Viewport => {
  let viewport: Viewport;

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

    viewport = {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
    };
  } else {
    // keep the current zoom, only recenter the viewport on the target
    const { scrollX, scrollY } = calculateScrollCenter(targetElements, state);
    viewport = { scrollX, scrollY, zoom: state.zoom };
  }

  // keep programmatic scrolling within the constraint box, if any
  return constrainScrollState({ ...state, ...viewport });
};

/** Eases the viewport from its current position to `target` over `duration`,
 * driving the transition through the shared AnimationController so it doesn't
 * slow down other processes. */
const animateToViewport = (
  from: Pick<AppState, "scrollX" | "scrollY" | "zoom">,
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
        shouldCacheIgnoreZoom: progress < 1, // ignore zoom caching while animating
        scrollX: from.scrollX + (target.scrollX - from.scrollX) * factor,
        scrollY: from.scrollY + (target.scrollY - from.scrollY) * factor,
        // zoom interpolates geometrically so the transition feels natural
        zoom: {
          value: (from.zoom.value *
            Math.pow(
              target.zoom.value / from.zoom.value,
              factor,
            )) as NormalizedZoomValue,
        },
      });

      return { elapsed };
    },
  );
};
