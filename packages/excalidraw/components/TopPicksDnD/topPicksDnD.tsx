import { useEffect, useMemo, useRef, useState } from "react";

import "./TopPicksDnD.scss";

/**
 * Custom (non-native) drag & drop for pinning values (colors, font families)
 * to a picker's top-picks strip and reordering the strip itself.
 *
 * Implemented with pointer events + a manually rendered "ghost" so we
 * control the visuals fully (native HTML5 dnd flickers and forces ugly
 * ghosting/cursors).
 *
 * The strip must be registered via `setStripEl`, and render its picks with
 * `data-top-pick-index` (hit-testing and the drop animation measure these).
 */

const GHOST_CLASS = "excalidraw-top-picks-dnd-ghost";
const BODY_CLASS = "excalidraw-top-picks-dnd-active";
const DRAG_THRESHOLD = 10;
/** a fast sloppy click can travel many px — releases faster than this stay
 * clicks; the drag only starts once the pointer is held this long */
const DRAG_TIME_THRESHOLD_MS = 100;

type DragOrigin =
  // a value dragged from outside the strip (picker popup, active-value
  // trigger) — dropping replaces the hovered pick
  | { kind: "source" }
  // a pick dragged from the top-picks strip itself — dropping reorders
  | { kind: "pick"; index: number };

export type TopPicksDragState<T> = {
  value: T;
  origin: DragOrigin;
  /** hovered strip slot — the slot to replace (source drags) or the final
   * position (pick reorders). null while the pointer is outside the strip */
  overIndex: number | null;
  /** index of an already-pinned identical value that blocks the drop */
  duplicateIndex: number | null;
  /** signed distance between strip slot centers (for reorder preview) */
  slotSpan: number;
} | null;

export type TopPicksGhost = {
  /** the ghost's visual. Rendered into `document.body` — outside the
   * editor's CSS scope, so theme-dependent styling must be resolved from the
   * rendered DOM (computed styles) rather than CSS variables */
  content: HTMLElement;
  /** where the ghost spawns (its size) and flies back to on cancel */
  rect: DOMRect;
};

/** called on pointerdown (the source may not stay mounted until the drag
 * activates), for every potential drag — keep it cheap */
export type CreateTopPicksGhost<T> = (args: {
  value: T;
  /** the element the drag started on */
  sourceEl: HTMLElement;
  /** the registered strip */
  stripEl: HTMLElement;
}) => TopPicksGhost;

type DragSession<T> = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  /** pending delayed activation (spatial threshold crossed before the
   * temporal one) */
  activationTimer: number | null;
  value: T;
  origin: DragOrigin;
  /** built on pointerdown, shown on activation */
  ghostContent: HTMLElement;
  /** see `TopPicksGhost.rect` */
  homeRect: DOMRect;
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

export type TopPicksDnD<T> = {
  dragState: TopPicksDragState<T>;
  startSourceDrag: (event: React.PointerEvent, value: T | null) => void;
  startPickDrag: (event: React.PointerEvent, index: number, value: T) => void;
  setStripEl: (el: HTMLDivElement | null) => void;
};

/**
 * live preview of the reorder result — the translation (px) moving the pick
 * at `index` to the slot it would occupy if dropped right now
 */
export const getTopPickReorderOffset = (
  dragState: TopPicksDragState<unknown>,
  index: number,
) => {
  if (
    !dragState ||
    dragState.origin.kind !== "pick" ||
    dragState.overIndex === null
  ) {
    return 0;
  }
  const from = dragState.origin.index;
  const to = dragState.overIndex;
  if (from === to) {
    return 0;
  }
  let newIndex = index;
  if (index === from) {
    newIndex = to;
  } else {
    if (index > from) {
      newIndex -= 1;
    }
    if (newIndex >= to) {
      newIndex += 1;
    }
  }
  return (newIndex - index) * dragState.slotSpan;
};

/** "marching ants" outline hinting that the strip accepts the drop — SVG
 * because CSS dashed outlines/borders can't animate their dash offset */
export const TopPicksDnDOutline = () => (
  <svg className="top-picks-dnd__outline" aria-hidden="true">
    <rect />
  </svg>
);

export const useTopPicksDnD = <T,>({
  enabled,
  picks,
  onPicksChange,
  isSamePick = (a, b) => a === b,
  createGhost,
}: {
  enabled: boolean;
  picks: readonly T[];
  onPicksChange: (picks: T[]) => void;
  /** value-equality — pins identical to an existing pick are refused */
  isSamePick?: (a: T, b: T) => boolean;
  createGhost: CreateTopPicksGhost<T>;
}): TopPicksDnD<T> => {
  const [dragState, setDragState] = useState<TopPicksDragState<T>>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const latestRef = useRef({
    enabled,
    picks,
    onPicksChange,
    isSamePick,
    createGhost,
  });
  latestRef.current = {
    enabled,
    picks,
    onPicksChange,
    isSamePick,
    createGhost,
  };

  const controller = useMemo(() => {
    let session: DragSession<T> | null = null;

    const publish = () => {
      if (session?.activated) {
        setDragState({
          value: session.value,
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
      // strip is evenly spaced; sign flips under RTL
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
      const { ghostContent, homeRect: rect } = session;

      const ghost = document.createElement("div");
      ghost.className = GHOST_CLASS;
      ghostContent.classList.add(`${GHOST_CLASS}__content`);
      ghost.appendChild(ghostContent);
      document.body.appendChild(ghost);

      session.ghost = ghost;
      session.ghostW = rect.width;
      session.ghostH = rect.height;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
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
        if (session.origin.kind === "source") {
          const { picks, isSamePick } = latestRef.current;
          const duplicate = picks.findIndex((pick) =>
            isSamePick(pick, session!.value),
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
        setGhostSize(session.homeRect.width, session.homeRect.height, x, y);
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
          releaseGhost({ rect: session.homeRect });
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

      const { overIndex, origin, value, slotRects } = session;
      const { picks, onPicksChange, isSamePick } = latestRef.current;

      settleStripInstantly();

      if (overIndex !== null) {
        if (origin.kind === "source") {
          if (!picks.some((pick) => isSamePick(pick, value))) {
            const next = [...picks];
            next[overIndex] = value;
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
        releaseGhost({ rect: session.homeRect });
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
      value: T | null,
      origin: DragOrigin,
    ) => {
      if (
        !latestRef.current.enabled ||
        session ||
        event.button !== 0 ||
        value == null
      ) {
        return;
      }
      const stripEl = stripRef.current;
      if (!stripEl) {
        return;
      }
      // build & measure the ghost now, while the source is guaranteed to be
      // mounted — it may be re-rendered (detached) before the drag activates
      // (e.g. the font list re-renders on hover), and a detached source
      // measures as a zero rect, flying a cancelled ghost to the viewport's
      // top-left
      const { content: ghostContent, rect: homeRect } =
        latestRef.current.createGhost({
          value,
          sourceEl: event.currentTarget as HTMLElement,
          stripEl,
        });
      session = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        lastX: event.clientX,
        lastY: event.clientY,
        activationTimer: null,
        value,
        origin,
        ghostContent,
        homeRect,
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
      startSourceDrag: (event, value) =>
        controller.begin(event, value, { kind: "source" }),
      startPickDrag: (event, index, value) =>
        controller.begin(event, value, { kind: "pick", index }),
      setStripEl: (el) => {
        stripRef.current = el;
      },
    }),
    [dragState, controller],
  );
};
