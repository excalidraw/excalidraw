import { CURSOR_TYPE, EVENT, POINTER_BUTTON } from "@excalidraw/common";

import { isHandToolActive } from "../appState";
import { withBatchedUpdates, withBatchedUpdatesThrottled } from "../reactUtils";

import type React from "react";

import type App from "./App";

/**
 * The drag-pan: a pointer drag that moves the canvas — the wheel button,
 * the main button while space is held or the hand tool is active, or any
 * button in view mode. One session at a time, owning its window listeners
 * and teardown; wheel input is gated on it (see `AppWheel`).
 */
export class AppPan {
  /** space held down turns a main-button drag into a pan */
  private spaceHeld = false;
  private active = false;
  /** applies the pointer move the session is holding back for its next
   * frame, if any */
  private pendingMoveFlush: (() => void) | null = null;
  private teardown: (() => void) | null = null;

  constructor(
    private app: App,
    private dependencies: {
      /** pointers currently down (a two-finger gesture is not a pan) */
      getPointerCount: () => number;
    },
  ) {}

  isActive = () => this.active;

  isSpaceHeld = () => this.spaceHeld;

  setSpaceHeld = (held: boolean) => {
    this.spaceHeld = held;
  };

  /** applies the pointer move still waiting for its frame, if any */
  flushMove = () => {
    this.pendingMoveFlush?.();
  };

  /** ends the active session, if any — pointerup may never arrive (the user
   * tabs away, a new pointerdown lands first) */
  end = () => {
    this.teardown?.();
  };

  /** starts a session for the pointerdown if it qualifies; returns whether
   * it did */
  start = (event: React.PointerEvent<HTMLElement> | MouseEvent): boolean => {
    const { app } = this;
    if (
      !(
        this.dependencies.getPointerCount() <= 1 &&
        (((event.button === POINTER_BUTTON.WHEEL ||
          (event.button === POINTER_BUTTON.MAIN && this.spaceHeld) ||
          isHandToolActive(app.state)) &&
          // reachable while non-interactive when the active tool is allowed
          // via `interaction.enabled.tools` — panning must remain gated on
          // `navigation` then
          (app.isInteractionEnabled() || app.isNavigationEnabled())) ||
          (app.state.viewModeEnabled && !app.isActiveToolPointerCapturing()))
      )
    ) {
      return false;
    }
    this.active = true;

    // due to event.preventDefault below, container wouldn't get focus
    // automatically
    app.focusContainer();

    // preventing defualt while text editing messes with cursor/focus
    if (!app.state.editingTextElement) {
      // necessary to prevent browser from scrolling the page if excalidraw
      // not full-page #4489
      //
      // as such, the above is broken when panning canvas while in wysiwyg
      event.preventDefault();
    }

    let nextPastePrevented = false;
    const isLinux = /Linux/.test(app.ownerWindow.navigator.platform);

    app.cursor.set(CURSOR_TYPE.GRABBING);
    let { clientX: lastX, clientY: lastY } = event;
    const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
      const deltaX = lastX - event.clientX;
      const deltaY = lastY - event.clientY;
      lastX = event.clientX;
      lastY = event.clientY;

      /*
       * Prevent paste event if we move while middle clicking on Linux.
       * See issue #1383.
       */
      if (
        isLinux &&
        !nextPastePrevented &&
        (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)
      ) {
        nextPastePrevented = true;

        /* Prevent the next paste event */
        const preventNextPaste = (event: ClipboardEvent) => {
          app.ownerDocument.body.removeEventListener(
            EVENT.PASTE,
            preventNextPaste,
          );
          event.stopPropagation();
        };

        /*
         * Reenable next paste in case of disabled middle click paste for
         * any reason:
         * - right click paste
         * - empty clipboard
         */
        const enableNextPaste = () => {
          setTimeout(() => {
            app.ownerDocument.body.removeEventListener(
              EVENT.PASTE,
              preventNextPaste,
            );
            app.ownerWindow.removeEventListener(
              EVENT.POINTER_UP,
              enableNextPaste,
            );
          }, 100);
        };

        app.ownerDocument.body.addEventListener(EVENT.PASTE, preventNextPaste);
        app.ownerWindow.addEventListener(EVENT.POINTER_UP, enableNextPaste);
      }

      // an updater, not a snapshot of `app.state`: a wheel zoom queued in
      // the same React flush would otherwise be overwritten by a pan
      // computed from the pre-zoom state
      app.viewport.translate((state) => ({
        scrollX: state.scrollX - deltaX / state.zoom.value,
        scrollY: state.scrollY - deltaY / state.zoom.value,
      }));
    });
    this.pendingMoveFlush = onPointerMove.flush;
    const teardown = withBatchedUpdates(() => {
      this.teardown = null;
      this.pendingMoveFlush = null;
      this.active = false;
      if (!this.spaceHeld) {
        app.cursor.reset();
      }
      app.setState(
        {
          cursorButton: "up",
        },
        // Runs after the trailing throttled pointer move has committed, so
        // the snap-back starts from the pan's actual final viewport.
        app.viewport.releaseOverscroll,
      );
      app.savePointer(event.clientX, event.clientY, "up");
      app.ownerWindow.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
      app.ownerWindow.removeEventListener(EVENT.POINTER_UP, teardown);
      app.ownerWindow.removeEventListener(EVENT.BLUR, teardown);
      onPointerMove.flush();
    });
    this.teardown = teardown;
    app.ownerWindow.addEventListener(EVENT.BLUR, teardown);
    app.ownerWindow.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
      passive: true,
    });
    app.ownerWindow.addEventListener(EVENT.POINTER_UP, teardown);
    return true;
  };
}
