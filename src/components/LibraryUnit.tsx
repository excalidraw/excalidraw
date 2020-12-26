import clsx from "clsx";
import oc from "open-color";
import React, { useEffect, useRef, useState } from "react";
import { close } from "../components/icons";
import { MIME_TYPES } from "../constants";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { exportToSvg } from "../scene/export";
import { LibraryItem } from "../types";
import "./LibraryUnit.scss";

// fa-plus
const PLUS_ICON = (
  <svg viewBox="0 0 1792 1792">
    <path
      fill="currentColor"
      d="M1600 736v192q0 40-28 68t-68 28h-416v416q0 40-28 68t-68 28h-192q-40 0-68-28t-28-68v-416h-416q-40 0-68-28t-28-68v-192q0-40 28-68t68-28h416v-416q0-40 28-68t68-28h192q40 0 68 28t28 68v416h416q40 0 68 28t28 68z"
    />
  </svg>
);

export const LibraryUnit = ({
  elements,
  pendingElements,
  onRemoveFromLibrary,
  onClick,
}: {
  elements?: LibraryItem;
  pendingElements?: LibraryItem;
  onRemoveFromLibrary: () => void;
  onClick: () => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const elementsToRender = elements || pendingElements;
    if (!elementsToRender) {
      return;
    }
    const svg = exportToSvg(elementsToRender, {
      exportBackground: false,
      viewBackgroundColor: oc.white,
      shouldAddWatermark: false,
    });
    for (const child of ref.current!.children) {
      if (child.tagName !== "svg") {
        continue;
      }
      ref.current!.removeChild(child);
    }
    ref.current!.appendChild(svg);

    const current = ref.current!;
    return () => {
      current.removeChild(svg);
    };
  }, [elements, pendingElements]);

  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();

  const adder = (isHovered || isMobile) && pendingElements && (
    <div className="library-unit__adder">{PLUS_ICON}</div>
  );

  return (
    <div
      className={clsx("library-unit", {
        "library-unit__active": elements || pendingElements,
      })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={clsx("library-unit__dragger", {
          "library-unit__pulse": !!pendingElements,
        })}
        ref={ref}
        draggable={!!elements}
        onClick={!!elements || !!pendingElements ? onClick : undefined}
        onDragStart={(event) => {
          setIsHovered(false);
          event.dataTransfer.setData(
            MIME_TYPES.excalidrawlib,
            JSON.stringify(elements),
          );
        }}
      />
      {adder}
      {elements && (isHovered || isMobile) && (
        <button
          className="library-unit__removeFromLibrary"
          aria-label={t("labels.removeFromLibrary")}
          onClick={onRemoveFromLibrary}
        >
          {close}
        </button>
      )}
    </div>
  );
};
