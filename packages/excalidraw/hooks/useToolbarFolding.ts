import { useLayoutEffect, useRef, useState } from "react";

import type { ToolbarToolType } from "../components/Tools";

/**
 * Toolbar tools that may fold into the extra-tools dropdown when the toolbar
 * doesn't fit its column, in folding order (first folds first). Hand and
 * selection never fold.
 */
export const TOOLBAR_FOLD_ORDER: readonly Extract<
  ToolbarToolType,
  | "eraser"
  | "stickynote"
  | "text"
  | "freedraw"
  | "line"
  | "arrow"
  | "ellipse"
  | "diamond"
  | "rectangle"
>[] = [
  "eraser",
  "stickynote",
  "text",
  "freedraw",
  "line",
  "arrow",
  "ellipse",
  "diamond",
  "rectangle",
];

export type FoldableToolType = typeof TOOLBAR_FOLD_ORDER[number];

/** sub-pixel slack, so rounding can't flip a tool in and out */
const TOLERANCE_PX = 0.5;

const TRACK_VAR = "--exc-toolbar-track";

/**
 * Lets the toolbar shrink to the width its column can give it, by folding
 * tools into the extra-tools dropdown.
 *
 * The toolbar column's track is set to `minmax(<fully folded>, <unfolded>)`.
 * Both bounds are computed from cached per-tool widths, so they don't change
 * when tools fold — the column's width never depends on the folding state,
 * and folding can't feed back into the width it reacts to. The grid then
 * gives the toolbar up to its full width (the side columns still floor at
 * their top region's content), and the toolbar folds exactly as many tools
 * as needed to fit what it got. Below the fully folded width the top row
 * overflows as before.
 *
 * Inert where layout isn't measurable (no ResizeObserver, zero sizes —
 * e.g. jsdom).
 *
 * @param resetKey changes whenever the toolbar's per-tool widths may change
 *   (e.g. compact ⇄ full styles panel), so they're re-measured unfolded
 */
export const useToolbarFolding = (
  columnsRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  resetKey: unknown,
) => {
  const [foldedCount, setFoldedCount] = useState(0);
  const foldedCountRef = useRef(foldedCount);
  foldedCountRef.current = foldedCount;

  /** width + gap of each foldable tool, measured while it was rendered */
  const stepsRef = useRef(new Map<FoldableToolType, number>());

  useLayoutEffect(() => {
    stepsRef.current.clear();
    setFoldedCount(0);
  }, [resetKey]);

  useLayoutEffect(() => {
    const columns = columnsRef.current;
    const ResizeObserver = columns?.ownerDocument.defaultView?.ResizeObserver;

    const reset = () => {
      columns?.style.removeProperty(TRACK_VAR);
      setFoldedCount(0);
    };

    if (!enabled || !columns || !ResizeObserver) {
      reset();
      return;
    }

    const measure = () => {
      const region = columns.querySelector<HTMLElement>(
        ".exc-region-top-center",
      );
      const row = region?.querySelector<HTMLElement>(".App-toolbar-container");
      const toolbar = row?.querySelector<HTMLElement>(".App-toolbar");
      if (!region || !row || !toolbar) {
        reset();
        return;
      }

      const steps = stepsRef.current;
      for (const type of TOOLBAR_FOLD_ORDER) {
        const button = toolbar.querySelector<HTMLElement>(
          `[data-testid="toolbar-${type}"]`,
        );
        if (button?.parentElement) {
          const gap =
            parseFloat(getComputedStyle(button.parentElement).columnGap) || 0;
          steps.set(type, button.getBoundingClientRect().width + gap);
        }
      }

      const folded = TOOLBAR_FOLD_ORDER.slice(0, foldedCountRef.current);
      // a folded tool that was never measured (shouldn't happen: folding
      // starts from the unfolded toolbar) — measure again unfolded
      if (folded.some((type) => !steps.has(type))) {
        reset();
        return;
      }

      const rowWidth = row.getBoundingClientRect().width;
      const fullWidth =
        rowWidth + folded.reduce((sum, type) => sum + steps.get(type)!, 0);
      const minWidth =
        fullWidth -
        TOOLBAR_FOLD_ORDER.reduce(
          (sum, type) => sum + (steps.get(type) ?? 0),
          0,
        );

      if (rowWidth <= 0 || minWidth <= 0) {
        reset();
        return;
      }

      const track = `minmax(${Math.ceil(minWidth)}px, ${Math.ceil(
        fullWidth,
      )}px)`;
      if (columns.style.getPropertyValue(TRACK_VAR) !== track) {
        // the region resizes in response, which re-runs this measurement
        columns.style.setProperty(TRACK_VAR, track);
        return;
      }

      const available = region.getBoundingClientRect().width + TOLERANCE_PX;
      let width = fullWidth;
      let count = 0;
      while (count < TOOLBAR_FOLD_ORDER.length && width > available) {
        width -= steps.get(TOOLBAR_FOLD_ORDER[count]) ?? 0;
        count++;
      }
      setFoldedCount(count);
    };

    // deferred to the next frame, so that reacting to a resize can't trip
    // the ResizeObserver loop limit
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(columns);
    const region = columns.querySelector(".exc-region-top-center");
    if (region) {
      observer.observe(region);
    }
    // the toolbar's own content (e.g. the collab laser button, a forced
    // tool hiding the lock button) changes its full width
    const row = region?.querySelector(".App-toolbar-container");
    if (row) {
      observer.observe(row);
    }
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [columnsRef, enabled, resetKey]);

  return foldedCount;
};
