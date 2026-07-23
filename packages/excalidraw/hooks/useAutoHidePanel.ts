import { useEffect, useRef, useState } from "react";

const HIDE_DELAY = 1000; // ms before hiding after pointer leaves
const EDGE_THRESHOLD = 15; // px from left edge to trigger show

/**
 * Manages auto-hide/show behavior for the shape actions panel.
 *
 * - When the pointer leaves the panel area, the panel slides to the left
 *   edge after `HIDE_DELAY` milliseconds.
 * - When the pointer comes within `EDGE_THRESHOLD` pixels of the left edge
 *   of the viewport, the panel slides back out.
 *
 * The hook returns a ref to attach to the panel container and a boolean
 * indicating whether the panel is currently hidden.
 */
export const useAutoHidePanel = (
  enabled: boolean,
): {
  panelRef: React.RefObject<HTMLDivElement | null>;
  isHidden: boolean;
} => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPointerInsidePanelRef = useRef(false);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!isPointerInsidePanelRef.current) {
        setIsHidden(true);
      }
    }, HIDE_DELAY);
  };

  useEffect(() => {
    if (!enabled) {
      clearHideTimer();
      setIsHidden(false);
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const handlePanelEnter = () => {
      isPointerInsidePanelRef.current = true;
      clearHideTimer();
      setIsHidden(false);
    };

    const handlePanelLeave = () => {
      isPointerInsidePanelRef.current = false;
      scheduleHide();
    };

    const handleMouseMove = (e: MouseEvent) => {
      // If panel is hidden, check if pointer is near the left edge
      if (isHidden || !isPointerInsidePanelRef.current) {
        if (e.clientX <= EDGE_THRESHOLD) {
          setIsHidden(false);
          isPointerInsidePanelRef.current = true;
          clearHideTimer();
        }
      }
    };

    panel.addEventListener("pointerenter", handlePanelEnter);
    panel.addEventListener("pointerleave", handlePanelLeave);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      panel.removeEventListener("pointerenter", handlePanelEnter);
      panel.removeEventListener("pointerleave", handlePanelLeave);
      window.removeEventListener("mousemove", handleMouseMove);
      clearHideTimer();
    };
  }, [enabled, isHidden]);

  return { panelRef, isHidden };
};
