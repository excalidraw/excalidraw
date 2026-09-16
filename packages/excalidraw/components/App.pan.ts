import { CURSOR_TYPE, EVENT, POINTER_BUTTON } from "@excalidraw/common";

import { isHandToolActive } from "../appState";
import { withBatchedUpdates, withBatchedUpdatesThrottled } from "../reactUtils";

import type React from "react";

import type App from "./App";

const SECONDARY_BUTTON_PAN_THRESHOLD = 5; // px

/**
 * The drag-pan: a pointer drag that moves the canvas — the wheel or the
 * secondary button, the main button while space is held or the hand tool
 * is active, or any button in view mode. One session at a time, owning its
 * window listeners and teardown; wheel input is gated on it (see
 * `AppWheel`).
 *
 * A secondary-button session is a pan only once the pointer travels past
 * the drag threshold; released before that, it is a right-click. The
 * platform's `contextmenu` event opens the menu for a right-click where it
 * follows the release (Windows), as it always has; where it comes with the
 * press (macOS, Linux) it is swallowed — a drag cannot be told from a
 * click yet — and the session opens the menu on release instead.
 */
export class AppPan {
  /** space held down turns a main-button drag into a pan */
  private spaceHeld = false;
  private active = false;
  /** the secondary-button session, while one is active */
  private secondary: { engaged: boolean; nativeMenuSeen: boolean } | null =
    null;
  /** the platform fires `contextmenu` on mouseup (Windows) or on mousedown
   * (macOS, Linux); the one belonging to a secondary-button session is not a
   * new click, whichever side of the session it lands on */
  private suppressNextContextMenu = false;
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

  /**
   * Whether a `contextmenu` event belongs to a secondary-button session and
   * must not open the menu: it came with the press (the session decides on
   * release), or it follows a release that turned out to be a drag.
   */
  consumesContextMenuEvent = () => {
    if (this.secondary) {
      this.secondary.nativeMenuSeen = true;
      return true;
    }
    if (this.suppressNextContextMenu) {
      this.suppressNextContextMenu = false;
      return true;
    }
    return false;
  };

  /** starts a session for the pointerdown if it qualifies; returns whether
   * it did */
  start = (event: React.PointerEvent<HTMLElement> | MouseEvent): boolean => {
    const { app } = this;
    // a new press supersedes whatever the previous session left pending
    this.suppressNextContextMenu = false;
    const isSecondary = event.button === POINTER_BUTTON.SECONDARY;
    if (
      !(
        this.dependencies.getPointerCount() <= 1 &&
        (((event.button === POINTER_BUTTON.WHEEL ||
          isSecondary ||
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
    this.secondary = isSecondary
      ? { engaged: false, nativeMenuSeen: false }
      : null;

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

    if (!this.secondary) {
      app.cursor.set(CURSOR_TYPE.GRABBING);
    }
    const { clientX: startX, clientY: startY } = event;
    let { clientX: lastX, clientY: lastY } = event;
    const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
      if (this.secondary && !this.secondary.engaged) {
        // a right-click until the pointer travels far enough for a drag
        if (
          Math.hypot(event.clientX - startX, event.clientY - startY) <=
          SECONDARY_BUTTON_PAN_THRESHOLD
        ) {
          return;
        }
        this.secondary.engaged = true;
        app.cursor.set(CURSOR_TYPE.GRABBING);
        // pans from here on; the threshold distance is not caught up
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }

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
    const teardown = withBatchedUpdates(
      (upEvent?: PointerEvent | FocusEvent) => {
        const { secondary } = this;
        this.teardown = null;
        this.pendingMoveFlush = null;
        this.active = false;
        this.secondary = null;
        if (secondary?.engaged && !secondary.nativeMenuSeen) {
          // a drag: the platform's `contextmenu` still to come is no click
          this.suppressNextContextMenu = true;
        }
        if (!this.spaceHeld) {
          app.cursor.reset();
        }
        app.setState(
          {
            cursorButton: "up",
          },
          // Wait for the trailing pan move to commit before converting the
          // pointer to scene coordinates or starting the snap-back.
          () => {
            // Missing-pointerup cleanup can run during a new press. Don't
            // overwrite the newer button state with this pan's release.
            if (app.state.cursorButton === "up") {
              const pointer =
                upEvent && "clientX" in upEvent
                  ? upEvent
                  : { clientX: lastX, clientY: lastY };
              app.savePointer(pointer.clientX, pointer.clientY, "up");
            }
            app.viewport.releaseOverscroll();
          },
        );
        app.ownerWindow.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
        app.ownerWindow.removeEventListener(EVENT.POINTER_UP, teardown);
        app.ownerWindow.removeEventListener(EVENT.BLUR, teardown);
        onPointerMove.flush();

        // released without a drag: a right-click. Where the platform's
        // `contextmenu` came with the press it was swallowed, so the menu
        // opens here, at the release point; where it is still to come it
        // opens the menu itself, as it always has
        if (
          secondary &&
          !secondary.engaged &&
          secondary.nativeMenuSeen &&
          upEvent &&
          "clientX" in upEvent
        ) {
          app.openContextMenu({
            clientX: upEvent.clientX,
            clientY: upEvent.clientY,
            button: upEvent.button,
            pointerType: upEvent.pointerType,
          });
        }
      },
    );
    this.teardown = teardown;
    app.ownerWindow.addEventListener(EVENT.BLUR, teardown);
    app.ownerWindow.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
      passive: true,
    });
    app.ownerWindow.addEventListener(EVENT.POINTER_UP, teardown);
    return true;
  };
}
