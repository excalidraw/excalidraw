import { CLASSES, KEYS, MIN_ZOOM, ZOOM_STEP } from "@excalidraw/common";

import { resolveInputDevice } from "../appState";
import { withBatchedUpdates } from "../reactUtils";
import { getNormalizedZoom } from "../scene";
import { getViewportForZoomWithScrollConstraints } from "../viewport";

import type App from "./App";

/** `MouseEvent.buttons` bit of the wheel (middle) button */
const WHEEL_BUTTON_MASK = 4;

/**
 * Wheel input over the editor: pans the canvas, or zooms it around the
 * pointer (`viewport.lastPosition`) — on ctrl/cmd+wheel (which is also how
 * a trackpad pinch is delivered), while the wheel button itself is held
 * down, or on a plain wheel when the input device is a mouse
 * (`appState.inputDevice`; ctrl/cmd+wheel pans instead then).
 */
export class AppWheel {
  constructor(
    private app: App,
    private dependencies: {
      /** whether a drag-pan (wheel button, space+drag, hand tool) is in
       * progress — wheel input is ignored meanwhile */
      isPanning: () => boolean;
      /** applies the pointer movement the drag-pan is holding back for its
       * next frame, if any */
      flushPanMove: () => void;
    },
  ) {}

  /** the editor surfaces whose wheel input the editor consumes; everywhere
   * else (menus, sidebars, …) the DOM keeps scrolling. The frame-name labels
   * are DOM, but sit inside the container this listener is attached to */
  private isOverEditorSurface = (event: WheelEvent) => {
    const { ownerWindow } = this.app;
    return (
      event.target instanceof ownerWindow.HTMLCanvasElement ||
      event.target instanceof ownerWindow.HTMLTextAreaElement ||
      event.target instanceof ownerWindow.HTMLIFrameElement ||
      (event.target instanceof ownerWindow.HTMLElement &&
        event.target.classList.contains(CLASSES.FRAME_NAME))
    );
  };

  handle = withBatchedUpdates((event: WheelEvent) => {
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

    // scrolling with the wheel button held down zooms: the wheel sits under
    // the same finger, so a wheel-button pan can be zoomed without reaching
    // for a modifier — hence it wins over any modifier, and over the
    // drag-pan the button itself started
    const isWheelButtonHeld = !!(event.buttons & WHEEL_BUTTON_MASK);

    if (this.dependencies.isPanning()) {
      if (!isWheelButtonHeld) {
        return;
      }
      // the drag-pan applies pointer movement once per frame; a move still
      // waiting for its frame has to land before the zoom, or it lands after
      // it — at the new zoom, on a viewport the zoom anchored without it —
      // and the point grabbed by the pan drifts from under the cursor a
      // little on every tick
      this.dependencies.flushPanMove();
    }

    const { deltaX, deltaY } = event;
    if (!deltaX && !deltaY) {
      return;
    }
    // note that event.ctrlKey is necessary to handle pinch zooming
    const hasZoomModifier = event.metaKey || event.ctrlKey;
    const shouldZoom =
      // a horizontal-only wheel (tilt wheel, sideways two-finger scroll)
      // has nothing to zoom by; it pans sideways below instead
      deltaY !== 0 &&
      (isWheelButtonHeld ||
        (resolveInputDevice(this.app.state.inputDevice) === "mouse"
          ? // a mouse has no pinch: a plain wheel zooms, and any modifier
            // pans instead (ctrl/cmd vertically, shift horizontally)
            !hasZoomModifier && !event.shiftKey
          : hasZoomModifier));
    if (shouldZoom) {
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
    const { viewport } = this.app;

    const sign = Math.sign(deltaY);
    const MAX_STEP = ZOOM_STEP * 100;
    const absDelta = Math.abs(deltaY);
    let delta = deltaY;
    if (absDelta > MAX_STEP) {
      delta = MAX_STEP * sign;
    }

    // where the pointer is now — the updater below runs when React flushes,
    // by which time the pointer may have moved on (`lastPosition` is live)
    const { x: viewportX, y: viewportY } = viewport.lastPosition;

    const didTranslate = viewport.translate(
      // computed from the state the zoom applies to, not `app.state`: wheel
      // ticks arriving before React has flushed the previous one would
      // otherwise all start from the same zoom and collapse into one step
      (state) => {
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
        const nextZoom = getNormalizedZoom(Math.max(newZoom, minZoom));
        if (nextZoom === state.zoom.value) {
          // at a zoom limit there is nothing to do; flipping the bitmap-cache
          // flag would only redraw the scene on every tick
          return null;
        }

        return {
          ...getViewportForZoomWithScrollConstraints(
            { viewportX, viewportY, nextZoom },
            state,
          ),
          shouldCacheIgnoreZoom: true,
        };
      },
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
