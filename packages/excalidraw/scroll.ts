import { easeOut } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { zoomToFit } from "./actions/actionCanvas";
import { AnimationController } from "./renderer/animation";
import { calculateScrollCenter } from "./scene/scroll";

import type { AppState, NormalizedZoomValue, Offsets } from "./types";

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

/** Eases the viewport from its current position to `target` over `duration`,
 * driving the transition through the shared AnimationController so it doesn't
 * slow down other processes. */
const animateToViewport = (
  from: Pick<AppState, "scrollX" | "scrollY" | "zoom">,
  target: Viewport,
  duration: number,
  onFrame: (state: Pick<AppState, "scrollX" | "scrollY" | "zoom">) => void,
) => {
  AnimationController.start<{ elapsed: number }>(
    SCROLL_TO_CONTENT_ANIMATION_KEY,
    ({ deltaTime, state }) => {
      const elapsed = (state?.elapsed ?? 0) + deltaTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress >= 1) {
        return null;
      }

      const factor = easeOut(progress);

      onFrame({
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
