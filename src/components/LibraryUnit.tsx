import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useDevice } from "../components/App";
import { LibraryItem } from "../types";
import "./LibraryUnit.scss";
import { CheckboxItem } from "./CheckboxItem";
import { PlusIcon } from "./icons";
import { useLibraryItemSvg } from "../hooks/useLibraryItemSvg";

export const LibraryUnit = ({
  id,
  elements,
  isPending,
  onClick,
  selected,
  onToggle,
  onDrag,
}: {
  id: LibraryItem["id"] | /** for pending item */ null;
  elements?: LibraryItem["elements"];
  isPending?: boolean;
  onClick: (id: LibraryItem["id"] | null) => void;
  selected: boolean;
  onToggle: (id: string, event: React.MouseEvent) => void;
  onDrag: (id: string, event: React.DragEvent) => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const svg = useLibraryItemSvg(id, elements);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    if (svg) {
      svg.querySelector(".style-fonts")?.remove();
      node.innerHTML = svg.outerHTML;
    }

    return () => {
      node.innerHTML = "";
    };
  }, [elements, svg]);

  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useDevice().isMobile;
  const adder = isPending && (
    <div className="library-unit__adder">{PlusIcon}</div>
  );

  return (
    <div
      className={clsx("library-unit", {
        "library-unit__active": elements,
        "library-unit--hover": elements && isHovered,
        "library-unit--selected": selected,
      })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={clsx("library-unit__dragger", {
          "library-unit__pulse": !!isPending,
        })}
        ref={ref}
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
      />
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
};
