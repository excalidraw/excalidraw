import React, { useEffect } from "react";

import { KEYS } from "@excalidraw/common";

import "./Tooltip.scss";

const TOOLTIP_ID = "excalidraw-tooltip";

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
  div.id = TOOLTIP_ID;
  div.setAttribute("role", "tooltip");
  return div;
};

const hideTooltip = () =>
  getTooltipDiv().classList.remove("excalidraw-tooltip--visible");

const isTooltipVisible = () =>
  getTooltipDiv().classList.contains("excalidraw-tooltip--visible");

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
  disabled?: boolean;
};

export const Tooltip = ({
  children,
  label,
  long = false,
  style,
  disabled,
}: TooltipProps) => {
  useEffect(() => {
    return () => hideTooltip();
  }, []);
  if (disabled) {
    return null;
  }
  return (
    <div
      className="excalidraw-tooltip-wrapper"
      onPointerEnter={(event) =>
        updateTooltip(
          event.currentTarget as HTMLDivElement,
          getTooltipDiv(),
          label,
          long,
        )
      }
      onPointerLeave={() => hideTooltip()}
      onFocus={(event) => {
        // only show visually for keyboard focus so pointer clicks don't
        // pop the tooltip (keeps the pointer experience unchanged)
        if ((event.target as HTMLElement).matches?.(":focus-visible")) {
          updateTooltip(
            event.currentTarget as HTMLDivElement,
            getTooltipDiv(),
            label,
            long,
          );
        }
        (event.target as HTMLElement).setAttribute(
          "aria-describedby",
          TOOLTIP_ID,
        );
      }}
      onBlur={(event) => {
        hideTooltip();
        (event.target as HTMLElement).removeAttribute("aria-describedby");
      }}
      onKeyDown={(event) => {
        // WCAG 1.4.13: tooltip must be dismissible without moving focus
        if (event.key === KEYS.ESCAPE && isTooltipVisible()) {
          hideTooltip();
          event.stopPropagation();
        }
      }}
      style={style}
    >
      {children}
    </div>
  );
};
