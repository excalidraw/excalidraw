import clsx from "clsx";
import { useLayoutEffect, useEffect, useRef, useState } from "react";

import { EVENT } from "@excalidraw/common";

import { atom, useAtom } from "../editor-jotai";

import { useApp, useExcalidrawContainer } from "./App";

import "./CursorHint.scss";

/** how long the hint stays visible before it starts fading out */
const CURSOR_HINT_DURATION = 700;
/** fade-out duration (keep in sync with CursorHint.scss) */
const CURSOR_HINT_FADE_DURATION = 100;
/** distance from the pointer so the hint isn't covered by the cursor */
const CURSOR_HINT_OFFSET = 16;

export const cursorHintAtom = atom<{
  content: React.ReactNode;
  /** bumped on every trigger so a re-trigger restarts the hide timer */
  nonce: number;
} | null>(null);

/**
 * Transient tooltip shown next to the cursor for added affordance after
 * actions that have no other visual feedback near the pointer (e.g. cycling
 * arrow types via shortcut). Trigger via `app.showCursorHint()`.
 */
export const CursorHint = () => {
  const [hint, setHint] = useAtom(cursorHintAtom);
  const app = useApp();
  const { container } = useExcalidrawContainer();
  const hintRef = useRef<HTMLDivElement>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const nonce = hint?.nonce;

  useLayoutEffect(() => {
    if (nonce == null || !container) {
      return;
    }

    const updatePosition = (clientX: number, clientY: number) => {
      const element = hintRef.current;
      if (!element) {
        return;
      }
      const rect = container.getBoundingClientRect();
      let x = clientX - rect.left + CURSOR_HINT_OFFSET;
      let y = clientY - rect.top + CURSOR_HINT_OFFSET;
      // flip to the other side of the pointer when overflowing the container
      if (x + element.offsetWidth > rect.width) {
        x = clientX - rect.left - CURSOR_HINT_OFFSET - element.offsetWidth;
      }
      if (y + element.offsetHeight > rect.height) {
        y = clientY - rect.top - CURSOR_HINT_OFFSET - element.offsetHeight;
      }
      element.style.transform = `translate(${x}px, ${y}px)`;
    };

    updatePosition(app.lastViewportPosition.x, app.lastViewportPosition.y);

    const onPointerMove = (event: PointerEvent) => {
      updatePosition(event.clientX, event.clientY);
    };

    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
    return () => {
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
    };
  }, [nonce, container, app]);

  // hints are transient — don't let a stale one reappear on remount
  useEffect(() => {
    return () => {
      setHint(null);
    };
  }, [setHint]);

  useEffect(() => {
    if (nonce == null) {
      return;
    }

    setIsFadingOut(false);

    const fadeTimer = window.setTimeout(() => {
      setIsFadingOut(true);
    }, CURSOR_HINT_DURATION);
    const hideTimer = window.setTimeout(() => {
      setHint(null);
    }, CURSOR_HINT_DURATION + CURSOR_HINT_FADE_DURATION);

    // hide immediately when the user starts interacting (e.g. drawing)
    // so the hint doesn't get in the way
    const onPointerDown = () => {
      setHint(null);
    };
    window.addEventListener(EVENT.POINTER_DOWN, onPointerDown, {
      capture: true,
    });

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
      window.removeEventListener(EVENT.POINTER_DOWN, onPointerDown, {
        capture: true,
      });
    };
  }, [nonce, setHint]);

  if (!hint) {
    return null;
  }

  return (
    <div
      ref={hintRef}
      className={clsx("CursorHint", {
        "CursorHint--fade-out": isFadingOut,
      })}
      data-testid="cursor-hint"
    >
      {hint.content}
    </div>
  );
};
