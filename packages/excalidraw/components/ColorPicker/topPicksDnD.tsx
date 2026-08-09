import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { colorToHex, isTransparent } from "@excalidraw/common";

/**
 * Custom (non-native) drag & drop for pinning colors to the color-picker
 * top-picks strip and reordering the strip itself.
 *
 * Implemented with pointer events + a manually rendered "ghost" swatch so we
 * control the visuals fully (native HTML5 dnd flickers and forces ugly
 * ghosting/cursors).
 */

const GHOST_CLASS = "excalidraw-color-dnd-ghost";
const BODY_CLASS = "excalidraw-color-dnd-active";
const DRAG_THRESHOLD = 10;
/** a fast sloppy click can travel many px — releases faster than this stay
 * clicks; the drag only starts once the pointer is held this long */
const DRAG_TIME_THRESHOLD_MS = 100;

/** value-equality of colors — normalizes notation (`#fff` vs `#ffffff` vs
 * `white`) so visually identical colors can't occupy multiple pick slots */
const isSameColor = (a: string, b: string) => {
  if (a.toLowerCase() === b.toLowerCase()) {
    return true;
  }
  const aHex = colorToHex(a);
  return aHex !== null && aHex === colorToHex(b);
};

type DragOrigin =
  // a color dragged from the picker popup (palette/shades/custom) or the
  // active-color trigger — dropping replaces the hovered pick
  | { kind: "swatch" }
  // a pick dragged from the top-picks strip itself — dropping reorders
  | { kind: "pick"; index: number };

export type TopPicksDragState = {
  color: string;
  origin: DragOrigin;
  /** hovered strip slot — the slot to replace (swatch drags) or the final
   * position (pick reorders). null while the pointer is outside the strip */
  overIndex: number | null;
  /** index of an already-pinned identical color that blocks the drop */
  duplicateIndex: number | null;
  /** signed distance between strip slot centers (for reorder preview) */
  slotSpan: number;
} | null;

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  /** pending delayed activation (spatial threshold crossed before the
   * temporal one) */
  activationTimer: number | null;
  color: string;
  origin: DragOrigin;
  sourceEl: HTMLElement;
  sourceRect: DOMRect;
  activated: boolean;
  ghost: HTMLDivElement | null;
  ghostW: number;
  ghostH: number;
  slotRects: DOMRect[];
  slotSpan: number;
  hitRect: { left: number; right: number; top: number; bottom: number } | null;
  overIndex: number | null;
  duplicateIndex: number | null;
};

export type ColorPickerDnD = {
  dragState: TopPicksDragState;
  startSwatchDrag: (event: React.PointerEvent, color: string | null) => void;
  startPickDrag: (
    event: React.PointerEvent,
    index: number,
    color: string,
  ) => void;
  setStripEl: (el: HTMLDivElement | null) => void;
};

export const ColorPickerDnDContext = createContext<ColorPickerDnD | null>(null);

export const useColorPickerDnD = () => useContext(ColorPickerDnDContext);

export const useTopPicksDnD = ({
  enabled,
  picks,
  onPicksChange,
}: {
  enabled: boolean;
  picks: readonly string[];
  onPicksChange: (picks: string[]) => void;
}): ColorPickerDnD => {
  const [dragState, setDragState] = useState<TopPicksDragState>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const latestRef = useRef({ enabled, picks, onPicksChange });
  latestRef.current = { enabled, picks, onPicksChange };

  const controller = useMemo(() => {
    let session: DragSession | null = null;

    const publish = () => {
      if (session?.activated) {
        setDragState({
          color: session.color,
          origin: session.origin,
          overIndex: session.overIndex,
          duplicateIndex: session.duplicateIndex,
          slotSpan: session.slotSpan,
        });
      } else {
        setDragState(null);
      }
    };

    const measureStrip = () => {
      const strip = stripRef.current;
      if (!strip || !session) {
        return false;
      }
      const buttons = Array.from(
        strip.querySelectorAll<HTMLElement>("[data-top-pick-index]"),
      ).sort(
        (a, b) =>
          Number(a.dataset.topPickIndex) - Number(b.dataset.topPickIndex),
      );
      if (!buttons.length) {
        return false;
      }
      session.slotRects = buttons.map((button) =>
        button.getBoundingClientRect(),
      );
      const [first, second] = session.slotRects;
      // strip is evenly spaced (space-between); sign flips under RTL
      session.slotSpan = second ? second.left - first.left : first.width + 4;
      const stripRect = strip.getBoundingClientRect();
      const padX = Math.max(Math.abs(session.slotSpan) / 2, 10);
      session.hitRect = {
        left: stripRect.left - padX,
        right: stripRect.right + padX,
        top: stripRect.top - 14,
        bottom: stripRect.bottom + 14,
      };
      return true;
    };

    const positionGhost = (x: number, y: number) => {
      if (session?.ghost) {
        session.ghost.style.transform = `translate(${
          x - session.ghostW / 2
        }px, ${y - session.ghostH / 2}px)`;
      }
    };

    const setGhostSize = (
      width: number,
      height: number,
      x: number,
      y: number,
    ) => {
      if (!session?.ghost) {
        return;
      }
      if (session.ghostW !== width || session.ghostH !== height) {
        session.ghostW = width;
        session.ghostH = height;
        session.ghost.style.width = `${width}px`;
        session.ghost.style.height = `${height}px`;
        positionGhost(x, y);
      }
    };

    const activate = (x: number, y: number) => {
      if (!session) {
        return;
      }
      const { sourceRect, sourceEl, color } = session;

      const ghost = document.createElement("div");
      ghost.className = GHOST_CLASS;
      const swatch = document.createElement("div");
      swatch.className = `${GHOST_CLASS}__swatch`;
      if (isTransparent(color)) {
        swatch.classList.add("is-transparent");
      } else {
        // swatches render the theme-adjusted color (dark mode remaps colors
        // rather than CSS-filtering them) — sample the rendered color so the
        // ghost matches what the user picked up
        const rendered = getComputedStyle(sourceEl).backgroundColor;
        swatch.style.backgroundColor =
          rendered && rendered !== "rgba(0, 0, 0, 0)" ? rendered : color;
      }
      ghost.appendChild(swatch);
      document.body.appendChild(ghost);

      session.ghost = ghost;
      session.ghostW = sourceRect.width;
      session.ghostH = sourceRect.height;
      ghost.style.width = `${sourceRect.width}px`;
      ghost.style.height = `${sourceRect.height}px`;
      positionGhost(x, y);
      // let the spawn frame paint at rest, then "lift" (scale-up transition)
      requestAnimationFrame(() => {
        // unless the drag already ended — don't restyle a ghost that's
        // mid-flight in its release animation (or already removed)
        if (session?.ghost === ghost) {
          ghost.classList.add(`${GHOST_CLASS}--lifted`);
        }
      });

      document.body.classList.add(BODY_CLASS);
      session.activated = true;
      publish();
    };

    const hitTest = (x: number, y: number) => {
      if (!session?.hitRect) {
        return;
      }
      const { hitRect, slotRects } = session;
      let overIndex: number | null = null;
      let duplicateIndex: number | null = null;

      if (
        x >= hitRect.left &&
        x <= hitRect.right &&
        y >= hitRect.top &&
        y <= hitRect.bottom
      ) {
        let best = 0;
        let bestDistance = Infinity;
        slotRects.forEach((rect, index) => {
          const distance = Math.abs(x - (rect.left + rect.width / 2));
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        });
        if (session.origin.kind === "swatch") {
          const duplicate = latestRef.current.picks.findIndex((pick) =>
            isSameColor(pick, session!.color),
          );
          if (duplicate !== -1) {
            duplicateIndex = duplicate;
          } else {
            overIndex = best;
          }
        } else {
          overIndex = best;
        }
      }

      if (
        overIndex !== session.overIndex ||
        duplicateIndex !== session.duplicateIndex
      ) {
        session.overIndex = overIndex;
        session.duplicateIndex = duplicateIndex;

        const { ghost } = session;
        if (ghost) {
          ghost.classList.toggle(`${GHOST_CLASS}--over`, overIndex !== null);
          ghost.classList.toggle(
            `${GHOST_CLASS}--blocked`,
            duplicateIndex !== null,
          );
        }
        publish();
      }

      // over the strip the ghost morphs to slot size to preview the landing
      if (overIndex !== null) {
        const rect = session.slotRects[overIndex];
        setGhostSize(rect.width, rect.height, x, y);
      } else {
        setGhostSize(session.sourceRect.width, session.sourceRect.height, x, y);
      }
    };

    const releaseGhost = (target: { rect: DOMRect | null }) => {
      if (!session?.ghost) {
        return;
      }
      const { ghost } = session;
      session.ghost = null;
      ghost.classList.add(`${GHOST_CLASS}--dropping`);
      const rect = target.rect;
      if (rect) {
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      }
      window.setTimeout(() => {
        ghost.classList.add(`${GHOST_CLASS}--fade`);
      }, 160);
      window.setTimeout(() => {
        ghost.remove();
      }, 340);
    };

    // kill any in-flight (or retargetable) reorder-preview transitions before
    // the drag state is torn down. Running CSS transitions survive both the
    // removal of the `transition` property (spec: transition-* changes don't
    // affect running transitions) and React's keyed DOM reorder on commit —
    // the browser retargets them, which made the picks visibly re-shift on
    // drop. Clearing the transforms with transitions disabled (+ forced
    // reflow) cancels them for good, so the commit paints the final order
    // directly.
    const settleStripInstantly = () => {
      const strip = stripRef.current;
      if (!strip || !session?.activated) {
        return;
      }
      const buttons = Array.from(
        strip.querySelectorAll<HTMLElement>("[data-top-pick-index]"),
      );
      for (const button of buttons) {
        button.style.transition = "none";
        button.style.transform = "none";
      }
      // flush the non-animated state...
      void strip.offsetWidth;
      // ...then let the stylesheet govern transitions again (next drag)
      for (const button of buttons) {
        button.style.transition = "";
      }
    };

    const suppressNextClick = () => {
      const suppress = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
      };
      window.addEventListener("click", suppress, { capture: true, once: true });
      window.setTimeout(() => {
        window.removeEventListener("click", suppress, { capture: true });
      }, 100);
    };

    const removeListeners = () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };

    const dispose = () => {
      removeListeners();
      document.body.classList.remove(BODY_CLASS);
      if (session?.activationTimer != null) {
        window.clearTimeout(session.activationTimer);
      }
      session = null;
      setDragState(null);
    };

    const cancelDrag = (animate: boolean) => {
      if (!session) {
        return;
      }
      settleStripInstantly();
      if (session.ghost) {
        if (animate) {
          releaseGhost({ rect: session.sourceRect });
        } else {
          session.ghost.remove();
          session.ghost = null;
        }
      }
      dispose();
    };

    const tryActivate = (x: number, y: number) => {
      if (!session || session.activated) {
        return;
      }
      if (!measureStrip()) {
        dispose();
        return;
      }
      activate(x, y);
      hitTest(x, y);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      session.lastX = event.clientX;
      session.lastY = event.clientY;
      if (!session.activated) {
        if (
          Math.hypot(
            event.clientX - session.startX,
            event.clientY - session.startY,
          ) < DRAG_THRESHOLD
        ) {
          // back inside the click tolerance — a delayed activation scheduled
          // while we were beyond it no longer applies (wiggle-and-return
          // must stay a click)
          if (session.activationTimer !== null) {
            window.clearTimeout(session.activationTimer);
            session.activationTimer = null;
          }
          return;
        }
        const elapsed = performance.now() - session.startTime;
        if (elapsed < DRAG_TIME_THRESHOLD_MS) {
          // spatial threshold crossed, temporal not yet — likely a fast
          // sloppy click. Wait out the rest of the grace period; the timeout
          // covers "flick then hold still", where no further moves fire
          if (session.activationTimer === null) {
            session.activationTimer = window.setTimeout(() => {
              if (session) {
                session.activationTimer = null;
                // the pointer may have returned inside the tolerance after
                // the last event we saw — never activate from within it
                if (
                  Math.hypot(
                    session.lastX - session.startX,
                    session.lastY - session.startY,
                  ) >= DRAG_THRESHOLD
                ) {
                  tryActivate(session.lastX, session.lastY);
                }
              }
            }, DRAG_TIME_THRESHOLD_MS - elapsed);
          }
          return;
        }
        tryActivate(event.clientX, event.clientY);
        if (!session?.activated) {
          return;
        }
      }
      event.preventDefault();
      positionGhost(event.clientX, event.clientY);
      hitTest(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      if (!session.activated) {
        // never became a drag — let the regular click happen
        dispose();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick();

      const { overIndex, origin, color, slotRects } = session;
      const { picks, onPicksChange } = latestRef.current;

      settleStripInstantly();

      if (overIndex !== null) {
        if (origin.kind === "swatch") {
          if (!picks.some((pick) => isSameColor(pick, color))) {
            const next = [...picks];
            next[overIndex] = color;
            onPicksChange(next);
          }
        } else if (origin.index !== overIndex) {
          const next = [...picks];
          const [moved] = next.splice(origin.index, 1);
          next.splice(overIndex, 0, moved);
          onPicksChange(next);
        }
        releaseGhost({ rect: slotRects[overIndex] });
      } else {
        releaseGhost({ rect: session.sourceRect });
      }
      dispose();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (session && event.pointerId === session.pointerId) {
        cancelDrag(true);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (session?.activated && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelDrag(true);
      }
    };

    const begin = (
      event: React.PointerEvent,
      color: string | null,
      origin: DragOrigin,
    ) => {
      if (
        !latestRef.current.enabled ||
        session ||
        event.button !== 0 ||
        !color
      ) {
        return;
      }
      session = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        lastX: event.clientX,
        lastY: event.clientY,
        activationTimer: null,
        color,
        origin,
        sourceEl: event.currentTarget as HTMLElement,
        sourceRect: (
          event.currentTarget as HTMLElement
        ).getBoundingClientRect(),
        activated: false,
        ghost: null,
        ghostW: 0,
        ghostH: 0,
        slotRects: [],
        slotSpan: 0,
        hitRect: null,
        overIndex: null,
        duplicateIndex: null,
      };
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerUp, true);
      window.addEventListener("pointercancel", onPointerCancel, true);
      window.addEventListener("keydown", onKeyDown, true);
    };

    return {
      begin,
      destroy: () => cancelDrag(false),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cancel a drag in flight if the picker unmounts mid-drag
  useEffect(() => () => controller.destroy(), [controller]);

  return useMemo(
    () => ({
      dragState,
      startSwatchDrag: (event, color) =>
        controller.begin(event, color, { kind: "swatch" }),
      startPickDrag: (event, index, color) =>
        controller.begin(event, color, { kind: "pick", index }),
      setStripEl: (el) => {
        stripRef.current = el;
      },
    }),
    [dragState, controller],
  );
};
