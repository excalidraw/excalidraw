import oc from "open-color";
import { useEffect, useRef, useState } from "react";
import { exportToSvg } from "../packages/utils";
import { AppState, LibraryItem } from "../types";
import { close, editIcon } from "./icons";

import "./SingleLibraryItem.scss";
import { ToolButton } from "./ToolButton";

const SingleLibraryItem = ({
  libItem,
  appState,
  index,
  onChange,
}: {
  libItem: LibraryItem;
  appState: AppState;
  index: number;
  onChange: (val: string, index: number) => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [editLibName, setEditLibName] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    (async () => {
      const svg = await exportToSvg({
        elements: libItem.elements,
        appState: {
          ...appState,
          viewBackgroundColor: oc.white,
          exportBackground: true,
        },
        files: null,
      });
      node.innerHTML = svg.outerHTML;
    })();
  });
  return (
    <div className="single-library-item">
      <div ref={ref} className="single-library-item__svg" />
      <div
        style={{
          display: "flex",
          margin: "0.8rem 0.3rem",
          width: "100%",
          fontSize: "14px",
          fontWeight: 500,
          color: oc.gray[6],
        }}
      >
        {editLibName ? (
          <>
            <input
              style={{ width: "60%", padding: "0.2rem" }}
              value={libItem.name}
              placeholder="Item name"
              onChange={(event) => {
                onChange(event.target.value, index);
              }}
            />
            <ToolButton
              aria-label="edit"
              type="icon"
              icon={close}
              onClick={() => setEditLibName(false)}
            />
          </>
        ) : (
          <>
            <span
              style={{
                minWidth: "63%",
                maxWidth: "63%",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {libItem.name || "Unnamed Item"}
            </span>
            <ToolButton
              aria-label="edit"
              type="icon"
              icon={editIcon}
              onClick={() => setEditLibName(true)}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SingleLibraryItem;
