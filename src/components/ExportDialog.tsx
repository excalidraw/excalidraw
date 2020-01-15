import "./ExportDialog.css";

import React, { useState, useEffect, useRef } from "react";

import { Modal } from "./Modal";
import { ToolIcon } from "./ToolIcon";
import { clipboard, exportFile, downloadFile } from "./icons";
import { Island } from "./Island";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { getExportCanvasPreview } from "../scene/data";
import { ActionsManagerInterface, UpdaterFn } from "../actions/types";
import Stack from "./Stack";

export function ExportDialog({
  elements,
  appState,
  exportPadding = 10,
  actionManager,
  syncActionResult,
  onExportToPng,
  onExportToClipboard
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  exportPadding?: number;
  actionManager: ActionsManagerInterface;
  syncActionResult: UpdaterFn;
  onExportToPng(): void;
  onExportToClipboard(): void;
}) {
  const [modalIsShown, setModalIsShown] = useState(false);
  const previeRef = useRef<HTMLDivElement>(null);
  const { exportBackground, viewBackgroundColor } = appState;

  useEffect(() => {
    const previewNode = previeRef.current;
    const canvas = getExportCanvasPreview(elements, {
      exportBackground,
      viewBackgroundColor,
      exportPadding
    });
    previewNode?.appendChild(canvas);
    return () => {
      previewNode?.removeChild(canvas);
    };
  }, [
    modalIsShown,
    elements,
    exportBackground,
    exportPadding,
    viewBackgroundColor
  ]);

  return (
    <>
      <ToolIcon
        onClick={() => setModalIsShown(true)}
        icon={exportFile}
        type="button"
        aria-label="Show export dialog"
      />
      {modalIsShown && (
        <Modal maxWidth={640} onCloseRequest={() => setModalIsShown(false)}>
          <Island padding={4}>
            <h2>Export</h2>
            <div className="ExportDialog__preview" ref={previeRef}></div>
            <div className="ExportDialog__actions">
              <Stack.Row gap={2}>
                <ToolIcon
                  type="button"
                  icon={downloadFile}
                  title="Export to PNG"
                  aria-label="Export to PNG"
                  onClick={onExportToPng}
                />

                <ToolIcon
                  type="button"
                  icon={clipboard}
                  title="Copy to clipboard"
                  aria-label="Copy to clipboard"
                  onClick={onExportToClipboard}
                />
              </Stack.Row>
              {actionManager.renderAction(
                "changeExportBackground",
                elements,
                appState,
                syncActionResult
              )}
            </div>
          </Island>
        </Modal>
      )}
    </>
  );
}
