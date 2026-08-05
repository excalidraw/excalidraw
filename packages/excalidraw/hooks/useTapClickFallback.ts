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

/**
 * Recovers "ghost clicks" in scrollable menus on iOS (iPad/iPhone).
 *
 * When a tap interrupts an active scroll animation (momentum scroll or the
 * rubber-band/elastic overscroll at the edges), WebKit deliberately suppresses
 * the resulting `click` event so the tap is treated as "stop the scroll" and
 * not as an activation (see https://github.com/WebKit/WebKit/commit/21aada2).
 * Because Radix menu items are activated via `click`, the tap is silently
 * dropped even though the menu item is already visible under the finger —
 * the user has to wait for the scroll to settle and tap again.
 *
 * This hook observes pointer events inside the menu and, when a tap (pointer
 * up without significant movement) does not produce a native `click` within a
 * single event-loop turn, replays one click on the tapped element so the menu
 * item activates as intended.
 *
 * Safety properties:
 * - Real drags (movement > `DRAGGING_THRESHOLD`) never activate.
 * - When the browser delivers the native click (mouse, trackpad, settled
 *   touch), it wins: the fallback is cancelled, so there is no double
 *   activation and existing behavior is unchanged.
 * - If the fallback fires and a late native click still arrives, the native
 *   click is swallowed to avoid activating the item twice.
 * - Keyboard navigation is untouched (no pointer events involved).
 */
export const useTapClickFallback = <T extends HTMLElement>() => {
  const [element, setElement] = useState<T | null>(null);
  const elementRef = useCallback((node: T | null) => setElement(node), []);

  useEffect(() => {
    if (!element) {
      return;
    }

    let gesture: TapGesture | null = null;

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
      if (event.isPrimary === false) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
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
      if (event.isPrimary === false) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      // `pointerup` target is hit-tested by the browser, i.e. the element the
      // finger/cursor was over when released — exactly the element the browser
      // would have clicked (and whose click it may have suppressed).
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
        if (!nativeClickFired && tapTarget instanceof HTMLElement) {
          currentGesture.fallbackFired = true;
          currentGesture.dispatchingFallback = true;
          // Click the closest anchor when present so that its default
          // navigation behavior runs, otherwise the tapped element itself
          // (the click bubbles up to the containing menu item).
          const clickTarget =
            (tapTarget.closest("a[href]") as HTMLElement | null) ?? tapTarget;
          clickTarget.click();
          currentGesture.dispatchingFallback = false;
        }
        reset();
      }, 0);
    };

    const onPointerCancel = () => {
      reset();
    };

    // Swallow a native click that arrives after we already replayed the click
    // (otherwise the menu item would be activated twice).
    const onClickCapture = (event: MouseEvent) => {
      if (!gesture || gesture.dispatchingFallback) {
        return;
      }
      if (!element.contains(event.target as Node)) {
        return;
      }
      if (gesture.fallbackFired) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        gesture.nativeClickFired = true;
      }
    };

    element.addEventListener("pointerdown", onPointerDown, true);
    element.addEventListener("pointermove", onPointerMove, true);
    element.addEventListener("pointerup", onPointerUp, true);
    element.addEventListener("pointercancel", onPointerCancel, true);
    element.addEventListener("click", onClickCapture, true);

    return () => {
      reset();
      element.removeEventListener("pointerdown", onPointerDown, true);
      element.removeEventListener("pointermove", onPointerMove, true);
      element.removeEventListener("pointerup", onPointerUp, true);
      element.removeEventListener("pointercancel", onPointerCancel, true);
      element.removeEventListener("click", onClickCapture, true);
    };
  }, [element]);

  return elementRef;
};
