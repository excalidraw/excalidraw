import "./Tooltip.scss";

import React, { useEffect } from "react";

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
    return () =>
      getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
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
      onPointerLeave={() =>
        getTooltipDiv().classList.remove("excalidraw-tooltip--visible")
      }
      style={style}
    >
      {children}
    </div>
  );
};
