import React, { useEffect, useRef } from "react";

import "./Tooltip.scss";

export const getTooltipDiv = (ownerDocument: Document) => {
  const existingDiv = ownerDocument.querySelector<HTMLDivElement>(
    ".excalidraw-tooltip",
  );
  if (existingDiv) {
    return existingDiv;
  }
  const div = ownerDocument.createElement("div");
  ownerDocument.body.appendChild(div);
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
  const ownerWindow = tooltip.ownerDocument.defaultView;
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ownerDocument = wrapperRef.current?.ownerDocument;
    return () => {
      ownerDocument
        ?.querySelector(".excalidraw-tooltip")
        ?.classList.remove("excalidraw-tooltip--visible");
    };
  }, []);
  if (disabled) {
    return null;
  }
  return (
    <div
      ref={wrapperRef}
      className="excalidraw-tooltip-wrapper"
      onPointerEnter={(event) =>
        updateTooltip(
          event.currentTarget as HTMLDivElement,
          getTooltipDiv(event.currentTarget.ownerDocument),
          label,
          long,
        )
      }
      onPointerLeave={(event) =>
        getTooltipDiv(event.currentTarget.ownerDocument).classList.remove(
          "excalidraw-tooltip--visible",
        )
      }
      style={style}
    >
      {children}
    </div>
  );
};
