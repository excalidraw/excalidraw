import clsx from "clsx";
import { useLayoutEffect, useEffect, useRef, useState } from "react";

import { ARROW_TYPE, EVENT } from "@excalidraw/common";

import { atom, useAtom } from "../editor-jotai";

import { useApp, useExcalidrawContainer } from "./App";
import {
  LineIcon,
  sharpArrowIcon,
  roundArrowIcon,
  elbowArrowIcon,
} from "./icons";

import "./CursorHint.scss";

import type { AppClassProperties, AppState } from "../types";

/** how long the hint stays visible before it starts fading out */
const CURSOR_HINT_DURATION = 700;
/** fade-out duration (keep in sync with CursorHint.scss) */
const CURSOR_HINT_FADE_DURATION = 100;
/** distance from the pointer so the hint isn't covered by the cursor */
const CURSOR_HINT_OFFSET = 16;

/**
 * While a recently shown hint is still fresh in memory, tool-switch hints
 * are suppressed (repeatedly re-picking a tool you just used doesn't need
 * the reminder). Cycling arrow types and numeric shortcuts bypass this.
 */
export const CURSOR_HINT_COOLDOWN = 5 * 60 * 1000;

export const cursorHintAtom = atom<{
  content: React.ReactNode;
  /** unique per trigger so a re-trigger restarts the hide timer */
  nonce: number;
} | null>(null);

const getArrowTypeIcon = (arrowType: AppState["currentItemArrowType"]) =>
  arrowType === ARROW_TYPE.elbow
    ? elbowArrowIcon
    : arrowType === ARROW_TYPE.round
    ? roundArrowIcon
    : sharpArrowIcon;

/**
 * Owns the cursor-hint policy. App reports semantic interaction events
 * (what the user did); all decisions about whether and what to show —
 * cooldown, bypasses, hint content — are made here.
 */
export class CursorHints {
  private app: AppClassProperties;
  private lastShownAt = 0;

  constructor(app: AppClassProperties) {
    this.app = app;
  }

  /**
   * Shows a transient tooltip next to the cursor, hidden automatically
   * after a short delay. Repeated calls replace the content and restart
   * the timer.
   */
  show = (content: React.ReactNode) => {
    // `lastViewportPosition` stays at its initial (0, 0) until the first
    // pointermove, so in pointer-less flows (e.g. keyboard-only session so
    // far) we don't know where to show the hint — don't show it at all
    const { x, y } = this.app.lastViewportPosition;
    if (x === 0 && y === 0) {
      return;
    }
    this.lastShownAt = Date.now();
    this.app.updateEditorAtom(cursorHintAtom, {
      content,
      nonce: Math.random(),
    });
  };

  private isOnCooldown = () =>
    Date.now() - this.lastShownAt < CURSOR_HINT_COOLDOWN;

  /** arrow type cycled via shortcut (arrow tool already active) */
  onArrowTypeCycled = (arrowType: AppState["currentItemArrowType"]) => {
    // always worth hinting — you need to see what you switched to
    this.show(getArrowTypeIcon(arrowType));
  };

  /** arrow/line tool picked via keyboard shortcut */
  onToolShortcut = (tool: "arrow" | "line", source: "letter" | "digit") => {
    // digit shortcuts always hint (often pressed blind, without certainty
    // which tool the digit maps to); letter shortcuts only after a
    // cooldown — re-picking a tool you used moments ago doesn't need the
    // reminder
    if (source === "digit" || !this.isOnCooldown()) {
      this.show(
        tool === "line"
          ? LineIcon
          : getArrowTypeIcon(this.app.state.currentItemArrowType),
      );
    }
  };
}

/**
 * Transient tooltip shown next to the cursor for added affordance after
 * actions that have no other visual feedback near the pointer (e.g. cycling
 * arrow types via shortcut). Trigger via `app.cursorHints`.
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
