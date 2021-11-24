import clsx from "clsx";
import oc from "open-color";
import { useEffect, useRef, useState } from "react";
import { MIME_TYPES } from "../constants";
import { useIsMobile } from "../components/App";
import { exportToSvg } from "../scene/export";
import { BinaryFiles, LibraryItem } from "../types";
import "./LibraryUnit.scss";
import { CheckboxItem } from "./CheckboxItem";

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
  id,
  elements,
  files,
  isPending,
  onClick,
  selected,
  onToggle,
}: {
  id: LibraryItem["id"] | /** for pending item */ null;
  elements?: LibraryItem["elements"];
  files: BinaryFiles;
  isPending?: boolean;
  onClick: () => void;
  selected: boolean;
  onToggle: (id: string) => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    (async () => {
      if (!elements) {
        return;
      }
      const svg = await exportToSvg(
        elements,
        {
          exportBackground: false,
          viewBackgroundColor: oc.white,
        },
        files,
      );
      node.innerHTML = svg.outerHTML;
    })();

    return () => {
      node.innerHTML = "";
    };
  }, [elements, files]);

  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();
  const adder = isPending && (
    <div className="library-unit__adder">{PLUS_ICON}</div>
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
        onClick={!!elements || !!isPending ? onClick : undefined}
        onDragStart={(event) => {
          setIsHovered(false);
          event.dataTransfer.setData(
            MIME_TYPES.excalidrawlib,
            JSON.stringify(elements),
          );
        }}
      />
      {adder}
      {id && elements && (isHovered || isMobile || selected) && (
        <CheckboxItem
          checked={selected}
          onChange={() => onToggle(id)}
          className="library-unit__checkbox"
        />
      )}
    </div>
  );
};
