import clsx from "clsx";
import React, { useEffect } from "react";

import "./Tooltip.scss";

export const getTooltipDiv = () => {
  const existingDiv = document.querySelector<HTMLDivElement>(
    ".excalidraw-tooltip",
  );
  if (existingDiv) {
    return existingDiv;
  }
  const div = document.createElement("div");
  document.body.appendChild(div);
  div.classList.add("excalidraw-tooltip");
  return div;
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

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

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
const TOOLTIP_DELAY = 500;
/**
 * ms after a tooltip hides during which a `delay`ed tooltip shows right away
 * (e.g. when moving across adjacent buttons)
 */
const TOOLTIP_WARM_WINDOW = 300;

let showTooltipTimer = 0;
let tooltipHiddenAt = 0;
/**
 * the item the visible (or pending) tooltip belongs to. All tooltips share
 * one DOM node & timer, so without an owner an unrelated item unmounting
 * would cancel/hide a tooltip someone else is still hovering.
 */
let tooltipOwner: HTMLElement | null = null;
/**
 * while a tooltip is visible, hides it once its item is removed from the DOM
 * (e.g. unmounted while hovered, which doesn't fire pointerleave)
 */
let tooltipItemObserver: MutationObserver | null = null;

/** hides the tooltip & cancels a pending one, whichever item owns it */
export const hideTooltip = () => {
  clearTimeout(showTooltipTimer);
  showTooltipTimer = 0;
  tooltipOwner = null;
  tooltipItemObserver?.disconnect();
  tooltipItemObserver = null;
  // a plain query, so that hiding never creates the tooltip node
  const tooltip = document.querySelector<HTMLDivElement>(".excalidraw-tooltip");
  if (tooltip?.classList.contains("excalidraw-tooltip--visible")) {
    tooltip.classList.remove("excalidraw-tooltip--visible");
    tooltipHiddenAt = Date.now();
  }
};

/** hides the tooltip only if `item` is the one that owns it */
const hideTooltipOf = (item: HTMLElement) => {
  if (tooltipOwner === item) {
    hideTooltip();
  }
};

/**
 * hides the tooltip if its item left the DOM. Unlike the MutationObserver,
 * synchronous, and also covers a still-pending tooltip. A no-op while no
 * tooltip is owned, so that unmounting an item that was never hovered doesn't
 * touch the DOM.
 */
const hideOrphanedTooltip = () => {
  if (tooltipOwner && !tooltipOwner.isConnected) {
    hideTooltip();
  }
};

const updateTooltip = (
  item: HTMLElement,
  tooltip: HTMLDivElement,
  label: string,
  long: boolean,
  position: "bottom" | "top",
) => {
  tooltip.classList.add("excalidraw-tooltip--visible");
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
  tooltipItemObserver.observe(document.body, {
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
    if (item.isConnected) {
      updateTooltip(item, getTooltipDiv(), label, long, position);
    }
  };
  clearTimeout(showTooltipTimer);
  tooltipOwner = item;
  if (delay && Date.now() - tooltipHiddenAt > TOOLTIP_WARM_WINDOW) {
    showTooltipTimer = window.setTimeout(show, TOOLTIP_DELAY);
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
  // retract our tooltip if we unmount while hovered, but leave others' alone.
  // (`disabled` removes the wrapper without unmounting — the MutationObserver
  // covers that.)
  useEffect(() => hideOrphanedTooltip, []);

  if (disabled) {
    return null;
  }
  return (
    <div
      className={clsx("excalidraw-tooltip-wrapper", className)}
      onPointerEnter={(event) =>
        showTooltip(event.currentTarget, label, { long, delay })
      }
      onPointerLeave={(event) => hideTooltipOf(event.currentTarget)}
      style={style}
    >
      {children}
    </div>
  );
};
