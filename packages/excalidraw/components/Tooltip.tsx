import React, { useEffect, useRef } from "react";

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

export const hideTooltip = (ownerDocument: Document) => {
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

const updateTooltip = (
  item: HTMLDivElement,
  tooltip: HTMLDivElement,
  label: string,
  long: boolean,
) => {
  tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
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
  // the tooltip div we're currently showing (may live in another document),
  // so that unmounting while hovered doesn't leave it stuck on screen
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    return () => {
      tooltipRef.current?.classList.remove(TOOLTIP_VISIBLE_CLASS);
      tooltipRef.current = null;
    };
  }, []);
  useEffect(() => {
    // the wrapper is unmounted while disabled, so its onPointerLeave never
    // fires and the shared tooltip div must be cleared here instead
    if (disabled) {
      tooltipRef.current?.classList.remove(TOOLTIP_VISIBLE_CLASS);
      tooltipRef.current = null;
    }
  }, [disabled]);
  if (disabled) {
    return null;
  }
  return (
    <div
      className="excalidraw-tooltip-wrapper"
      onPointerEnter={(event) => {
        const tooltip = getTooltipDiv(event.currentTarget.ownerDocument);
        tooltipRef.current = tooltip;
        updateTooltip(
          event.currentTarget as HTMLDivElement,
          tooltip,
          label,
          long,
        );
      }}
      onPointerLeave={(event) => {
        hideTooltip(event.currentTarget.ownerDocument);
        tooltipRef.current = null;
      }}
      style={style}
    >
      {children}
    </div>
  );
};
