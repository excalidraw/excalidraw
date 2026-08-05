import { useCallback, useEffect, useState } from "react";

import { DRAGGING_THRESHOLD } from "@excalidraw/common";

type TapGesture = {
  x: number;
  y: number;
  moved: boolean;
  /** the element the tap ended on (hit-tested by the browser) */
  target: Element | null;
  fallbackTimer: number | null;
  /** whether a native click was delivered before the fallback timer ran */
  nativeClickFired: boolean;
  /** whether we already replayed the click ourselves */
  fallbackFired: boolean;
  /** set while we're dispatching our own synthetic click */
  dispatchingFallback: boolean;
};

/** elements a replayed click is allowed to activate */
const ACTIVATABLE_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  '[role^="menuitem"]',
  '[role="button"]',
  '[role="link"]',
  '[role="switch"]',
].join(", ");

const DISABLED_SELECTOR = "[disabled], [aria-disabled='true'], [data-disabled]";

/**
 * Resolves the element a replayed click should be dispatched on, or `null`
 * when the tap landed on something that must not be activated (disabled
 * controls, separators, empty menu space, non-interactive content).
 */
const resolveActivationTarget = (target: Element): HTMLElement | null => {
  const el = target.closest<HTMLElement>(ACTIVATABLE_SELECTOR);
  if (!el || el.closest(DISABLED_SELECTOR)) {
    return null;
  }
  return el;
};

/**
 * Recovers "ghost clicks" in scrollable menus on touch devices (iPad/iPhone).
 *
 * When a tap interrupts an active scroll animation (momentum scroll or the
 * rubber-band/elastic overscroll at the edges), WebKit deliberately suppresses
 * the resulting `click` event so the tap is treated as "stop the scroll" and
 * not as an activation (documented behavior, see
 * https://github.com/WebKit/WebKit/commit/21aada2). Because Radix menu items
 * are activated via `click`, the tap is silently dropped even though the menu
 * item is already visible under the finger — the user has to wait for the
 * scroll to settle and tap again.
 *
 * This hook observes pointer events inside the menu and, when a touch tap
 * (pointer up without significant movement) does not produce a native `click`
 * within a single event-loop turn, replays one click on the tapped element so
 * the menu item activates as intended. It never inspects scroll state — it
 * only reacts to the browser delivering (or not delivering) the `click`.
 *
 * Safety properties:
 * - Only touch pointers are considered; mouse/trackpad/pen are left alone
 *   (mouse clicks are dispatched synchronously and can never be suppressed).
 * - Only interactive, non-disabled elements (`button`, `a[href]`, menu items,
 *   inputs, etc.) are replayed onto — empty space, separators and other
 *   non-interactive content are never activated.
 * - Real drags (movement > `DRAGGING_THRESHOLD`) never activate.
 * - When the browser delivers the native click (settled menu), it wins: the
 *   fallback is cancelled, so there is no double activation.
 * - If the fallback fires and a late native click still arrives, the late
 *   click is swallowed (event-driven latch) so the item is not activated
 *   twice; the latch is disarmed by any new pointer interaction or keydown on
 *   the menu, so subsequent intentional clicks keep working.
 * - Keyboard navigation is untouched.
 */
export const useTapClickFallback = <T extends HTMLElement>() => {
  const [element, setElement] = useState<T | null>(null);
  const elementRef = useCallback((node: T | null) => setElement(node), []);

  useEffect(() => {
    if (!element) {
      return;
    }

    let gesture: TapGesture | null = null;
    // Event-driven latch: after we replay a click, the next native click that
    // arrives on the same element is the (late) one the browser suppressed —
    // swallow it so the item isn't activated twice. Deliberately kept outside
    // the gesture lifecycle: it must survive `reset()`.
    let swallowTarget: HTMLElement | null = null;

    const clearFallbackTimer = () => {
      if (gesture?.fallbackTimer != null) {
        window.clearTimeout(gesture.fallbackTimer);
        gesture.fallbackTimer = null;
      }
    };

    const reset = () => {
      clearFallbackTimer();
      gesture = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      // Any new pointer interaction supersedes a pending swallow, so the
      // following real click is never eaten.
      if (swallowTarget && swallowTarget.contains(event.target as Node)) {
        swallowTarget = null;
      }

      if (event.pointerType !== "touch") {
        return;
      }
      if (event.isPrimary === false) {
        return;
      }

      reset();
      gesture = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
        target: event.target instanceof Element ? event.target : null,
        fallbackTimer: null,
        nativeClickFired: false,
        fallbackFired: false,
        dispatchingFallback: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!gesture || gesture.moved) {
        return;
      }
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (Math.hypot(dx, dy) > DRAGGING_THRESHOLD) {
        gesture.moved = true;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!gesture || gesture.moved) {
        return;
      }
      if (event.pointerType !== "touch") {
        return;
      }
      if (event.isPrimary === false) {
        return;
      }

      // `pointerup` target is hit-tested by the browser, i.e. the element the
      // finger was over when released — exactly the element the browser would
      // have clicked (and whose click it may have suppressed).
      const target =
        event.target instanceof Element ? event.target : gesture.target;
      gesture.target = target;
      if (!target || !element.contains(target)) {
        reset();
        return;
      }

      // The browser may deliver the native click right after this event (the
      // menu settled) or suppress it (the tap interrupted a scroll animation).
      // Give the native click a single event-loop turn to arrive; if it
      // doesn't, replay the click ourselves.
      gesture.fallbackTimer = window.setTimeout(() => {
        // note: `gesture` may be nulled out by the effect cleanup if the menu
        // closes synchronously while replaying the click below, so capture the
        // gesture in a local variable first
        const currentGesture = gesture;
        if (!currentGesture) {
          return;
        }
        const { nativeClickFired, target: tapTarget } = currentGesture;
        if (!nativeClickFired && tapTarget) {
          const clickTarget = resolveActivationTarget(tapTarget);
          if (clickTarget) {
            currentGesture.fallbackFired = true;
            currentGesture.dispatchingFallback = true;
            clickTarget.click();
            currentGesture.dispatchingFallback = false;
            // arm the latch: a late native click on this element must not
            // activate it a second time
            swallowTarget = clickTarget;
          }
        }
        reset();
      }, 0);
    };

    const onPointerCancel = () => {
      reset();
    };

    const onKeyDown = () => {
      // a keyboard activation (Enter/Space on a focused item) dispatches a
      // click without a pointerdown — disarm so it is never swallowed
      swallowTarget = null;
    };

    // Swallow a native click that arrives after we already replayed the click
    // (otherwise the menu item would be activated twice).
    const onClickCapture = (event: MouseEvent) => {
      if (gesture?.dispatchingFallback) {
        return;
      }
      if (!element.contains(event.target as Node)) {
        return;
      }
      if (swallowTarget && swallowTarget.contains(event.target as Node)) {
        swallowTarget = null;
        event.preventDefault();
        event.stopPropagation();
        reset();
        return;
      }
      if (gesture) {
        gesture.nativeClickFired = true;
      }
    };

    element.addEventListener("pointerdown", onPointerDown, true);
    element.addEventListener("pointermove", onPointerMove, true);
    element.addEventListener("pointerup", onPointerUp, true);
    element.addEventListener("pointercancel", onPointerCancel, true);
    element.addEventListener("click", onClickCapture, true);
    element.addEventListener("keydown", onKeyDown);

    return () => {
      reset();
      element.removeEventListener("pointerdown", onPointerDown, true);
      element.removeEventListener("pointermove", onPointerMove, true);
      element.removeEventListener("pointerup", onPointerUp, true);
      element.removeEventListener("pointercancel", onPointerCancel, true);
      element.removeEventListener("click", onClickCapture, true);
      element.removeEventListener("keydown", onKeyDown);
    };
  }, [element]);

  return elementRef;
};
