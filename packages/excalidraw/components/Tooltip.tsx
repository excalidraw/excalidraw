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

const hideTooltip = () => {
  clearTimeout(showTooltipTimer);
  const tooltip = getTooltipDiv();
  if (tooltip.classList.contains("excalidraw-tooltip--visible")) {
    tooltip.classList.remove("excalidraw-tooltip--visible");
    tooltipHiddenAt = Date.now();
  }
};

const updateTooltip = (
  item: HTMLDivElement,
  tooltip: HTMLDivElement,
  label: string,
  long: boolean,
) => {
  tooltip.classList.add("excalidraw-tooltip--visible");
  tooltip.style.minWidth = long ? "50ch" : "10ch";
  tooltip.style.maxWidth = long ? "50ch" : "15ch";

  tooltip.textContent = label;

  const itemRect = item.getBoundingClientRect();
  updateTooltipPosition(tooltip, itemRect);
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
  useEffect(() => {
    return () => hideTooltip();
  }, []);
  if (disabled) {
    return null;
  }
  return (
    <div
      className={clsx("excalidraw-tooltip-wrapper", className)}
      onPointerEnter={(event) => {
        const item = event.currentTarget as HTMLDivElement;
        const show = () => updateTooltip(item, getTooltipDiv(), label, long);
        clearTimeout(showTooltipTimer);
        if (delay && Date.now() - tooltipHiddenAt > TOOLTIP_WARM_WINDOW) {
          showTooltipTimer = window.setTimeout(show, TOOLTIP_DELAY);
        } else {
          show();
        }
      }}
      onPointerLeave={hideTooltip}
      style={style}
    >
      {children}
    </div>
  );
};
