import React from "react";
import { Panel } from "../Panel";
import { ExportType } from "../../scene/types";

import "./panelExport.scss";
import { ActionManager } from "../../actions";
import { ExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";
import { UpdaterFn } from "../../actions/types";

interface PanelExportProps {
  actionManager: ActionManager;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  syncActionResult: UpdaterFn;
  onExportCanvas: (type: ExportType) => void;
}

// fa-clipboard
const ClipboardIcon = () => (
  <svg viewBox="0 0 384 512">
    <path
      fill="currentColor"
      d="M384 112v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h80c0-35.29 28.71-64 64-64s64 28.71 64 64h80c26.51 0 48 21.49 48 48zM192 40c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24m96 114v-20a6 6 0 0 0-6-6H102a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h180a6 6 0 0 0 6-6z"
    ></path>
  </svg>
);

const probablySupportsClipboard =
  "toBlob" in HTMLCanvasElement.prototype &&
  "clipboard" in navigator &&
  "write" in navigator.clipboard &&
  "ClipboardItem" in window;

export const PanelExport: React.FC<PanelExportProps> = ({
  actionManager,
  elements,
  appState,
  syncActionResult,
  onExportCanvas
}) => {
  return (
    <Panel title="Export">
      <div className="panelColumn">
        {actionManager.renderAction(
          "changeProjectName",
          elements,
          appState,
          syncActionResult
        )}
        <h5>Image</h5>
        <div className="panelExport-imageButtons">
          <button
            className="panelExport-exportToPngButton"
            onClick={() => onExportCanvas("png")}
          >
            Export to PNG
          </button>
          {probablySupportsClipboard && (
            <button
              className="panelExport-exportToClipboardButton"
              onClick={() => onExportCanvas("clipboard")}
              title="Copy to clipboard (experimental)"
            >
              <ClipboardIcon />
            </button>
          )}
        </div>
        <div className="panelExport-imageButtons">
          <button
            className="panelExport-exportToShortlinkButton"
            onClick={() => onExportCanvas("shortlink")}
          >
            Get shareable link
          </button>
        </div>
        {actionManager.renderAction(
          "changeExportBackground",
          elements,
          appState,
          syncActionResult
        )}

        <h5>Scene</h5>
        {actionManager.renderAction(
          "saveScene",
          elements,
          appState,
          syncActionResult
        )}
        {actionManager.renderAction(
          "loadScene",
          elements,
          appState,
          syncActionResult
        )}
      </div>
    </Panel>
  );
};
