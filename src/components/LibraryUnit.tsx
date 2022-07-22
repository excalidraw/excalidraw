import clsx from "clsx";
import oc from "open-color";
import { useEffect, useRef, useState } from "react";
import { useDevice } from "../components/App";
import { exportToSvg } from "../scene/export";
import { BinaryFiles, LibraryItem } from "../types";
import "./LibraryUnit.scss";
import { CheckboxItem } from "./CheckboxItem";

const PLUS_ICON = (
  <svg viewBox="0 0 1792 1792">
    <path
      d="M1600 736v192c0 26.667-9.33 49.333-28 68-18.67 18.67-41.33 28-68 28h-416v416c0 26.67-9.33 49.33-28 68s-41.33 28-68 28H800c-26.667 0-49.333-9.33-68-28s-28-41.33-28-68v-416H288c-26.667 0-49.333-9.33-68-28-18.667-18.667-28-41.333-28-68V736c0-26.667 9.333-49.333 28-68s41.333-28 68-28h416V224c0-26.667 9.333-49.333 28-68s41.333-28 68-28h192c26.67 0 49.33 9.333 68 28s28 41.333 28 68v416h416c26.67 0 49.33 9.333 68 28s28 41.333 28 68Z"
      style={{
        stroke: "#fff",
        strokeWidth: 140,
      }}
      transform="translate(0 64)"
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
  onDrag,
}: {
  id: LibraryItem["id"] | /** for pending item */ null;
  elements?: LibraryItem["elements"];
  files: BinaryFiles;
  isPending?: boolean;
  onClick: () => void;
  selected: boolean;
  onToggle: (id: string, event: React.MouseEvent) => void;
  onDrag: (id: string, event: React.DragEvent) => void;
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
  const isMobile = useDevice().isMobile;
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
        onClick={
          !!elements || !!isPending
            ? (event) => {
                if (id && event.shiftKey) {
                  onToggle(id, event);
                } else {
                  onClick();
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
