import React, { useEffect, useRef } from "react"; // zsviczian -- retain the trigger's document for cross-document cleanup, upstream #11974 follow-up

import "./Tooltip.scss";

export const getTooltipDiv = (
  ownerDocument: Document, // zsviczian -- keep tooltip singletons document-local, upstream #11974 follow-up
) => {
  const existingDiv = ownerDocument.querySelector<HTMLDivElement>( // zsviczian -- query the mounted editor document, upstream #11974 follow-up
    ".excalidraw-tooltip",
  );
  if (existingDiv) {
    return existingDiv;
  }
  const div = ownerDocument.createElement("div"); // zsviczian -- create in the mounted editor document, upstream #11974 follow-up
  ownerDocument.body.appendChild(div); // zsviczian -- portal beside the mounted editor, upstream #11974 follow-up
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
  const ownerWindow = tooltip.ownerDocument.defaultView; // zsviczian -- measure the tooltip's viewport, upstream #11974 follow-up
  if (
    !ownerWindow // zsviczian -- detached documents have no usable viewport, upstream #11974 follow-up
  ) {
    return;
  }

  const viewportWidth = ownerWindow.innerWidth; // zsviczian -- use the mounted editor viewport, upstream #11974 follow-up
  const viewportHeight = ownerWindow.innerHeight; // zsviczian -- use the mounted editor viewport, upstream #11974 follow-up

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
  const wrapperRef = useRef<HTMLDivElement>(null); // zsviczian -- capture this tooltip trigger's document, upstream #11974 follow-up
  useEffect(() => {
    const ownerDocument = wrapperRef.current?.ownerDocument; // zsviczian -- retain the live owner before ref cleanup, upstream #11974 follow-up
    return () => {
      ownerDocument
        ?.querySelector(".excalidraw-tooltip")
        ?.classList.remove("excalidraw-tooltip--visible"); // zsviczian -- clean only this document's tooltip, upstream #11974 follow-up
    };
  }, []);
  if (disabled) {
    return null;
  }
  return (
    <div
      ref={
        wrapperRef /* zsviczian -- expose the trigger document to cleanup, upstream #11974 follow-up */
      }
      className="excalidraw-tooltip-wrapper"
      onPointerEnter={(event) =>
        updateTooltip(
          event.currentTarget as HTMLDivElement,
          getTooltipDiv(event.currentTarget.ownerDocument), // zsviczian -- show in the trigger document, upstream #11974 follow-up
          label,
          long,
        )
      }
      onPointerLeave={(event) =>
        getTooltipDiv(
          event.currentTarget.ownerDocument, // zsviczian -- hide in the trigger document, upstream #11974 follow-up
        ).classList.remove("excalidraw-tooltip--visible")
      }
      style={style}
    >
      {children}
    </div>
  );
};
