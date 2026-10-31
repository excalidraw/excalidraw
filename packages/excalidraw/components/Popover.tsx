import React, { useLayoutEffect, useRef, useEffect } from "react";
import { unstable_batchedUpdates } from "react-dom";

import { KEYS, queryFocusableElements } from "@excalidraw/common";

import { clamp } from "@excalidraw/math";

import clsx from "clsx";

import "./Popover.scss";

const POPOVER_CONTAINER_GAP = 10;

type Props = {
  top?: number;
  left?: number;
  children?: React.ReactNode;
  onCloseRequest?(event: PointerEvent): void;
  fitInViewport?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  className?: string;
};

export const Popover = ({
  children,
  left,
  top,
  onCloseRequest,
  fitInViewport = false,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
  className,
}: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = popoverRef.current;

    if (!container) {
      return;
    }

    // focus popover only if the caller didn't focus on something else nested
    // within the popover, which should take precedence. Fixes cases
    // like color picker listening to keydown events on containers nested
    // in the popover.
    if (!container.contains(document.activeElement)) {
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.TAB) {
        const focusableElements = queryFocusableElements(container);
        const { activeElement } = document;
        const currentIndex = focusableElements.findIndex(
          (element) => element === activeElement,
        );

        if (activeElement === container) {
          if (event.shiftKey) {
            focusableElements[focusableElements.length - 1]?.focus();
          } else {
            focusableElements[0].focus();
          }
          event.preventDefault();
          event.stopImmediatePropagation();
        } else if (currentIndex === 0 && event.shiftKey) {
          focusableElements[focusableElements.length - 1]?.focus();
          event.preventDefault();
          event.stopImmediatePropagation();
        } else if (
          currentIndex === focusableElements.length - 1 &&
          !event.shiftKey
        ) {
          focusableElements[0]?.focus();
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, []);

  const lastInitializedPosRef = useRef<{ top: number; left: number } | null>(
    null,
  );

  // ensure the popover doesn't overflow the viewport
  useLayoutEffect(() => {
    if (fitInViewport && popoverRef.current && top != null && left != null) {
      const element = popoverRef.current;
      const { width, height } = element.getBoundingClientRect();

      // hack for StrictMode so this effect only runs once for
      // the same top/left position, otherwise
      // we'd potentically reposition twice (once for viewport overflow)
      // and once for top/left position afterwards
      if (
        lastInitializedPosRef.current?.top === top &&
        lastInitializedPosRef.current?.left === left
      ) {
        return;
      }
      lastInitializedPosRef.current = { top, left };

      const maxWidth = Math.max(0, viewportWidth - POPOVER_CONTAINER_GAP * 2);
      if (width >= maxWidth) {
        element.style.width = `${maxWidth}px`;
        element.style.left = `${POPOVER_CONTAINER_GAP}px`;
        element.style.overflowX = "scroll";
      } else {
        element.style.left = `${clamp(
          left,
          POPOVER_CONTAINER_GAP,
          viewportWidth - POPOVER_CONTAINER_GAP - width,
        )}px`;
      }

      const maxHeight = Math.max(0, viewportHeight - POPOVER_CONTAINER_GAP * 2);
      if (height >= maxHeight) {
        element.style.height = `${maxHeight}px`;
        element.style.top = `${POPOVER_CONTAINER_GAP}px`;
        element.style.overflowY = "scroll";
      } else {
        element.style.top = `${clamp(
          top,
          POPOVER_CONTAINER_GAP,
          viewportHeight - POPOVER_CONTAINER_GAP - height,
        )}px`;
      }
    }
  }, [top, left, fitInViewport, viewportWidth, viewportHeight]);

  useEffect(() => {
    if (onCloseRequest) {
      const handler = (event: PointerEvent) => {
        if (!popoverRef.current?.contains(event.target as Node)) {
          unstable_batchedUpdates(() => onCloseRequest(event));
        }
      };
      document.addEventListener("pointerdown", handler, false);
      return () => document.removeEventListener("pointerdown", handler, false);
    }
  }, [onCloseRequest]);

  return (
    <div className={clsx("popover", className)} ref={popoverRef} tabIndex={-1}>
      {children}
    </div>
  );
};
