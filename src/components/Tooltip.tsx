import "./Tooltip.scss";

import React, { useEffect } from "react";

const getTooltipDiv = () => {
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

  const {
    x: itemX,
    bottom: itemBottom,
    top: itemTop,
    width: itemWidth,
  } = item.getBoundingClientRect();

  const { width: labelWidth, height: labelHeight } =
    tooltip.getBoundingClientRect();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const margin = 5;

  const left = itemX + itemWidth / 2 - labelWidth / 2;
  const offsetLeft =
    left + labelWidth >= viewportWidth ? left + labelWidth - viewportWidth : 0;

  const top = itemBottom + margin;
  const offsetTop =
    top + labelHeight >= viewportHeight
      ? itemBottom - itemTop + labelHeight + margin * 2
      : 0;

  Object.assign(tooltip.style, {
    top: `${top - offsetTop}px`,
    left: `${left - offsetLeft}px`,
  });
};

type TooltipProps = {
  children: React.ReactNode;
  label: string;
  long?: boolean;
  style?: React.CSSProperties;
};

export const Tooltip = ({
  children,
  label,
  long = false,
  style,
}: TooltipProps) => {
  useEffect(() => {
    return () =>
      getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
  }, []);

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
