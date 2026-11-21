import clsx from "clsx";
import { memo, useRef, useState } from "react";

import { useLibraryItemSvg } from "../hooks/useLibraryItemSvg";

import { useEditorInterface } from "./App";
import { CheckboxItem } from "./CheckboxItem";
import { PlusIcon } from "./icons";
import { hideTooltip, showTooltip } from "./Tooltip";

import "./LibraryUnit.scss";

import type { LibraryItem } from "../types";
import type { SvgCache } from "../hooks/useLibraryItemSvg";

export const LibraryUnit = memo(
  ({
    id,
    name,
    showName,
    elements,
    isPending,
    onClick,
    selected,
    onToggle,
    onDrag,
    svgCache,
  }: {
    id: LibraryItem["id"] | /** for pending item */ null;
    name?: LibraryItem["name"];
    /** render larger, with the name below the item */
    showName?: boolean;
    elements?: LibraryItem["elements"];
    isPending?: boolean;
    onClick: (id: LibraryItem["id"] | null) => void;
    selected: boolean;
    onToggle: (id: string, event: React.MouseEvent) => void;
    onDrag: (id: string, event: React.DragEvent) => void;
    svgCache: SvgCache;
  }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const svg = useLibraryItemSvg(id, elements, svgCache, ref);

    const [isHovered, setIsHovered] = useState(false);
    const isMobile = useEditorInterface().formFactor === "phone";
    const hasName = !!name?.trim();

    const adder = isPending && (
      <div className="library-unit__adder">{PlusIcon}</div>
    );

    return (
      <div
        className={clsx("library-unit", {
          "library-unit__active": elements,
          "library-unit--hover": elements && isHovered,
          "library-unit--selected": selected,
          "library-unit--skeleton": !svg,
          "library-unit--named": showName,
        })}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        // pointer (not mouse) events so that touch taps don't leave the
        // tooltip behind (pointerdown right after pointerenter cancels it)
        onPointerEnter={
          hasName
            ? (event) => {
                const nameEl = showName
                  ? event.currentTarget.querySelector(".library-unit__name")
                  : null;
                // name is already shown below the item, unless truncated
                if (nameEl && nameEl.scrollWidth <= nameEl.clientWidth) {
                  return;
                }
                showTooltip(event.currentTarget, name!, {
                  delay: true,
                  position: "top",
                });
              }
            : undefined
        }
        onPointerLeave={hasName ? hideTooltip : undefined}
        onPointerDown={hasName ? hideTooltip : undefined}
      >
        <div
          className={clsx("library-unit__dragger", {
            "library-unit__pulse": !!isPending,
          })}
          // svg is rendered into `ref` (replacing its contents)
          ref={showName ? undefined : ref}
          draggable={!!elements}
          onClick={
            !!elements || !!isPending
              ? (event) => {
                  if (id && event.shiftKey) {
                    onToggle(id, event);
                  } else {
                    onClick(id);
                  }
                }
              : undefined
          }
          onDragStart={(event) => {
            if (!id) {
              event.preventDefault();
              return;
            }
            setIsHovered(false);
            onDrag(id, event);
          }}
        >
          {showName && (
            <>
              <div className="library-unit__preview" ref={ref} />
              <div className="library-unit__name">{name}</div>
            </>
          )}
        </div>
        {adder}
        {id && elements && (isHovered || isMobile || selected) && (
          <CheckboxItem
            checked={selected}
            onChange={(checked, event) => onToggle(id, event)}
            className="library-unit__checkbox"
          />
        )}
      </div>
    );
  },
);

export const EmptyLibraryUnit = ({ showName }: { showName?: boolean }) => (
  <div
    className={clsx("library-unit library-unit--skeleton", {
      "library-unit--named": showName,
    })}
  />
);
