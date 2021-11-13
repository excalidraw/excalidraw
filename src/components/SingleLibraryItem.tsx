import oc from "open-color";
import { useEffect, useRef, useState } from "react";
import { exportToSvg } from "../packages/utils";
import { AppState, LibraryItem } from "../types";

import "./SingleLibraryItem.scss";

const SingleLibraryItem = ({
  libItem,
  appState,
  index,
  onChange,
  error,
}: {
  libItem: LibraryItem;
  appState: AppState;
  index: number;
  error: string | null;
  onChange: (val: string, index: number) => void;
}) => {
  const svgRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [editLibName, setEditLibName] = useState(false);

  useEffect(() => {
    const node = svgRef.current;
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
  }, [libItem.elements, appState]);

  useEffect(() => {
    if (!inputRef.current || !editLibName) {
      return;
    }
    inputRef.current.focus();
  }, [editLibName]);
  return (
    <div className="single-library-item">
      <div ref={svgRef} className="single-library-item__svg" />
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
          <input
            ref={inputRef}
            style={{ width: "80%", padding: "0.2rem" }}
            value={libItem.name}
            placeholder="Item name"
            onChange={(event) => {
              onChange(event.target.value, index);
            }}
            onBlur={() => setEditLibName(false)}
          />
        ) : (
          <div>
            <div>
              <span
                style={{
                  width: "80%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                onClick={() => {
                  setEditLibName(true);
                }}
              >
                {libItem.name || `Unnamed Item ${index}`}
              </span>
              <span aria-hidden="true" className="required">
                *
              </span>
            </div>
            <span className="error">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleLibraryItem;
