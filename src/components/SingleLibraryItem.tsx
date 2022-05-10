import oc from "open-color";
import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { exportToSvg } from "../packages/utils";
import { AppState, LibraryItem } from "../types";
import { close } from "./icons";

import "./SingleLibraryItem.scss";
import { ToolButton } from "./ToolButton";

const SingleLibraryItem = ({
  libItem,
  appState,
  index,
  onChange,
  onRemove,
}: {
  libItem: LibraryItem;
  appState: AppState;
  index: number;
  onChange: (val: string, index: number) => void;
  onRemove: (id: string) => void;
}) => {
  const svgRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <div className="single-library-item">
      {libItem.status === "published" && (
        <span className="single-library-item-status">published</span>
      )}
      <div ref={svgRef} className="single-library-item__svg" />
      <ToolButton
        aria-label={t("buttons.remove")}
        type="button"
        icon={close}
        className="single-library-item--remove"
        onClick={onRemove.bind(null, libItem.id)}
        title={t("buttons.remove")}
      />
      <div
        style={{
          display: "flex",
          margin: "0.8rem 0.3rem",
          width: "100%",
          fontSize: "14px",
          fontWeight: 500,
          flexDirection: "column",
        }}
      >
        <label
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "0.5em 0" }}>
            <span style={{ fontWeight: 500, color: oc.gray[6] }}>
              {t("publishDialog.itemName")}
            </span>
            <span aria-hidden="true" className="required">
              *
            </span>
          </div>
          <input
            type="text"
            ref={inputRef}
            style={{ width: "80%", padding: "0.2rem" }}
            defaultValue={libItem.name}
            placeholder="Item name"
            onChange={(event) => {
              onChange(event.target.value, index);
            }}
          />
        </label>
        <span className="error">{libItem.error}</span>
      </div>
    </div>
  );
};

export default SingleLibraryItem;
