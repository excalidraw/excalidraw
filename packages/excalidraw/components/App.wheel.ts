import { CLASSES, KEYS, MIN_ZOOM, ZOOM_STEP } from "@excalidraw/common";

import { withBatchedUpdates } from "../reactUtils";
import { getNormalizedZoom } from "../scene";
import { getViewportForZoomWithScrollConstraints } from "../viewport";

import type React from "react";

import type App from "./App";

type EditorWheelEvent =
  | WheelEvent
  | React.WheelEvent<HTMLDivElement | HTMLCanvasElement>;

/**
 * Wheel input over the editor: pans the canvas, or zooms it around the
 * pointer (`viewport.lastPosition`) on ctrl/cmd+wheel — which is also how
 * a trackpad pinch is delivered.
 */
export class AppWheel {
  constructor(
    private app: App,
    private dependencies: {
      /** whether a drag-pan (wheel button, space+drag, hand tool) is in
       * progress — wheel input is ignored meanwhile */
      isPanning: () => boolean;
    },
  ) {}

  /** the editor surfaces whose wheel input the editor consumes; everywhere
   * else (menus, sidebars, …) the DOM keeps scrolling */
  private isOverEditorSurface = (event: EditorWheelEvent) => {
    const { ownerWindow } = this.app;
    return (
      event.target instanceof ownerWindow.HTMLCanvasElement ||
      event.target instanceof ownerWindow.HTMLTextAreaElement ||
      event.target instanceof ownerWindow.HTMLIFrameElement ||
      (event.target instanceof ownerWindow.HTMLElement &&
        event.target.classList.contains(CLASSES.FRAME_NAME))
    );
  };

  handle = withBatchedUpdates((event: EditorWheelEvent) => {
    // NOTE no preventDefault so the page can scroll over the editor
    if (!this.app.isNavigationEnabled()) {
      return;
    }
    if (!this.isOverEditorSurface(event)) {
      // prevent zooming the browser (but allow scrolling DOM)
      if (event[KEYS.CTRL_OR_CMD]) {
        event.preventDefault();
      }

      return;
    }

    event.preventDefault();

    if (this.dependencies.isPanning()) {
      return;
    }

    const { deltaX, deltaY } = event;
    // note that event.ctrlKey is necessary to handle pinch zooming
    if (event.metaKey || event.ctrlKey) {
      this.zoomBy(deltaY);
      return;
    }

    // scroll horizontally when shift pressed
    if (event.shiftKey) {
      this.app.viewport.translate(({ zoom, scrollX }) => ({
        // on Mac, shift+wheel tends to result in deltaX
        scrollX: scrollX - (deltaY || deltaX) / zoom.value,
      }));
      return;
    }

    this.app.viewport.translate(({ zoom, scrollX, scrollY }) => ({
      scrollX: scrollX - deltaX / zoom.value,
      scrollY: scrollY - deltaY / zoom.value,
    }));
  });

  /**
   * Prevents the browser's own zoom over the non-interactive editor while
   * letting regular scroll through (trackpad pinch is delivered as
   * ctrl+wheel).
   */
  preventBrowserZoom = (event: WheelEvent) => {
    if (event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
    }
  };

  /** zooms around the pointer by a wheel delta (positive = zoom out) */
  private zoomBy = (deltaY: number) => {
    const { state, viewport } = this.app;

    const sign = Math.sign(deltaY);
    const MAX_STEP = ZOOM_STEP * 100;
    const absDelta = Math.abs(deltaY);
    let delta = deltaY;
    if (absDelta > MAX_STEP) {
      delta = MAX_STEP * sign;
    }

    let newZoom = state.zoom.value - delta / 100;
    // increase zoom steps the more zoomed-in we are (applies to >100% only)
    newZoom +=
      Math.log10(Math.max(1, state.zoom.value)) *
      -sign *
      // reduced amplification for small deltas (small movements on a trackpad)
      Math.min(1, absDelta / 20);

    const minZoom = state.scrollConstraints?.lockZoom
      ? state.scrollConstraints.zoom
      : MIN_ZOOM;
    newZoom = Math.max(newZoom, minZoom);

    const didTranslate = viewport.translate(
      (state) => ({
        ...getViewportForZoomWithScrollConstraints(
          {
            viewportX: viewport.lastPosition.x,
            viewportY: viewport.lastPosition.y,
            nextZoom: getNormalizedZoom(newZoom),
          },
          state,
        ),
        shouldCacheIgnoreZoom: true,
      }),
      {
        zoomPreConstrained: true,
        preserveScrollConstraintsSnapBack: true,
      },
    );
    if (didTranslate) {
      this.app.resetShouldCacheIgnoreZoomDebounced();
    }
  };
}
