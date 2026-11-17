import clsx from "clsx";
import React from "react";

import { getTargetWindow } from "@excalidraw/common";

import "./Tooltip.scss";

export const TOOLTIP_CLASS = "excalidraw-tooltip";
export const TOOLTIP_VISIBLE_CLASS = "excalidraw-tooltip--visible";

export const getTooltipDiv = (ownerDocument: Document) => {
  const existingDiv = ownerDocument.querySelector<HTMLDivElement>(
    `.${TOOLTIP_CLASS}`,
  );
  if (existingDiv) {
    return existingDiv;
  }
  const div = ownerDocument.createElement("div");
  ownerDocument.body.appendChild(div);
  div.classList.add(TOOLTIP_CLASS);
  return div;
};

/**
 * Hides `ownerDocument`'s tooltip, for tooltips not shown through
 * `showTooltip` (see `hideTooltip`).
 */
export const hideDocumentTooltip = (ownerDocument: Document) => {
  ownerDocument
    .querySelector(`.${TOOLTIP_CLASS}`)
    ?.classList.remove(TOOLTIP_VISIBLE_CLASS);
};

export const updateTooltipPosition = (
  tooltip: HTMLDivElement,
  item: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
  position: "bottom" | "top" = "bottom",
) => {
  const tooltipRect = tooltip.getBoundingClientRect();
  // callers have already made the tooltip visible, so it must always end up
  // positioned — falls back to the module realm for a detached document
  const ownerWindow = getTargetWindow(tooltip);
  if (!ownerWindow) {
    return;
  }

  const viewportWidth = ownerWindow.innerWidth;
  const viewportHeight = ownerWindow.innerHeight;

  const margin = 5;

  let left = item.left + item.width / 2 - tooltipRect.width / 2;
  if (left < 0) {
    left = margin;
  } else if (left + tooltipRect.width >= viewportWidth) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  let top: number;

  if (position === "bottom") {
    top = item.top + item.height + margin;
    if (top + tooltipRect.height >= viewportHeight) {
      top = item.top - tooltipRect.height - margin;
    }
  } else {
    top = item.top - tooltipRect.height - margin;
    if (top < 0) {
      top = item.top + item.height + margin;
    }
  }

  Object.assign(tooltip.style, {
    top: `${top}px`,
    left: `${left}px`,
  });
};

/** ms before a `delay`ed tooltip shows */
export const TOOLTIP_DELAY = 500;
/**
 * ms after a tooltip hides during which a `delay`ed tooltip shows right away
 * (e.g. when moving across adjacent buttons)
 */
const TOOLTIP_WARM_WINDOW = 300;

/** a pending delayed tooltip, timed in its item's window */
let showTooltipTimer: { id: number; ownerWindow: Window } | null = null;
let tooltipHiddenAt = 0;
/**
 * the tooltip `showTooltip` showed last (it lives in its item's document,
 * which may be another window's)
 */
let shownTooltip: HTMLDivElement | null = null;
/**
 * while a tooltip is visible, hides it once its item is removed from the DOM
 * (e.g. unmounted while hovered, which doesn't fire pointerleave)
 */
let tooltipItemObserver: MutationObserver | null = null;

const clearShowTooltipTimer = () => {
  if (showTooltipTimer) {
    showTooltipTimer.ownerWindow.clearTimeout(showTooltipTimer.id);
    showTooltipTimer = null;
  }
};

/** Hides the tooltip `showTooltip` shows, and cancels a pending one. */
export const hideTooltip = () => {
  clearShowTooltipTimer();
  tooltipItemObserver?.disconnect();
  tooltipItemObserver = null;
  const tooltip = shownTooltip;
  shownTooltip = null;
  if (tooltip?.classList.contains(TOOLTIP_VISIBLE_CLASS)) {
    tooltip.classList.remove(TOOLTIP_VISIBLE_CLASS);
    tooltipHiddenAt = Date.now();
  }
};

const updateTooltip = (
  item: HTMLElement,
  tooltip: HTMLDivElement,
  label: string,
  long: boolean,
  position: "bottom" | "top",
) => {
  if (shownTooltip && shownTooltip !== tooltip) {
    // shown in another document before
    shownTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS);
  }
  shownTooltip = tooltip;
  tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
  tooltip.style.minWidth = long ? "50ch" : "10ch";
  tooltip.style.maxWidth = long ? "50ch" : "15ch";

  tooltip.textContent = label;

  const itemRect = item.getBoundingClientRect();
  updateTooltipPosition(tooltip, itemRect, position);

  tooltipItemObserver?.disconnect();
  tooltipItemObserver = new MutationObserver(() => {
    if (!item.isConnected) {
      hideTooltip();
    }
  });
  tooltipItemObserver.observe(item.ownerDocument.body, {
    childList: true,
    subtree: true,
  });
};

/**
 * Shows the tooltip for `item`. For elements that can't be wrapped
 * in <Tooltip>. Pair with `hideTooltip()`.
 */
export const showTooltip = (
  item: HTMLElement,
  label: string,
  {
    long = false,
    delay = false,
    position = "bottom",
  }: {
    long?: boolean;
    /** show after a short delay (unless a tooltip was visible just now) */
    delay?: boolean;
    position?: "bottom" | "top";
  } = {},
) => {
  const show = () => {
    // item may have been unmounted while the delayed tooltip was pending
    showTooltipTimer = null;
    if (item.isConnected) {
      updateTooltip(
        item,
        getTooltipDiv(item.ownerDocument),
        label,
        long,
        position,
      );
    }
  };
  clearShowTooltipTimer();
  const ownerWindow = getTargetWindow(item);
  if (
    ownerWindow &&
    delay &&
    Date.now() - tooltipHiddenAt > TOOLTIP_WARM_WINDOW
  ) {
    showTooltipTimer = {
      id: ownerWindow.setTimeout(show, TOOLTIP_DELAY),
      ownerWindow,
    };
  } else {
    show();
  }
};

type TooltipProps = {
  children: React.ReactNode;
  label: string;
  long?: boolean;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  /** show after a short delay (unless a tooltip was visible just now) */
  delay?: boolean;
};

export const Tooltip = ({
  children,
  label,
  long = false,
  style,
  className,
  disabled,
  delay = false,
}: TooltipProps) => {
  if (disabled) {
    return null;
  }
  return (
    <div
      className={clsx("excalidraw-tooltip-wrapper", className)}
      onPointerEnter={(event) =>
        showTooltip(event.currentTarget, label, { long, delay })
      }
      onPointerLeave={hideTooltip}
      style={style}
    >
      {children}
    </div>
  );
};
