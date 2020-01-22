import "./ExportDialog.css";

import React, { useState, useEffect, useRef } from "react";

import { Modal } from "./Modal";
import { ToolIcon } from "./ToolIcon";
import { clipboard, exportFile, downloadFile, link } from "./icons";
import { Island } from "./Island";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { getExportCanvasPreview } from "../scene/getExportCanvasPreview";
import { ActionsManagerInterface, UpdaterFn } from "../actions/types";
import Stack from "./Stack";

import { useTranslation } from "react-i18next";

const probablySupportsClipboard =
  "toBlob" in HTMLCanvasElement.prototype &&
  "clipboard" in navigator &&
  "write" in navigator.clipboard &&
  "ClipboardItem" in window;

const scales = [1, 2, 3];
const defaultScale = scales.includes(devicePixelRatio) ? devicePixelRatio : 1;

type ExportCB = (elements: readonly ExcalidrawElement[], scale: number) => void;

export function ExportDialog({
  elements,
  appState,
  exportPadding = 10,
  actionManager,
  syncActionResult,
  onExportToPng,
  onExportToClipboard,
  onExportToBackend
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  exportPadding?: number;
  actionManager: ActionsManagerInterface;
  syncActionResult: UpdaterFn;
  onExportToPng: ExportCB;
  onExportToClipboard: ExportCB;
  onExportToBackend: ExportCB;
}) {
  const { t } = useTranslation();
  const someElementIsSelected = elements.some(element => element.isSelected);
  const [modalIsShown, setModalIsShown] = useState(false);
  const [scale, setScale] = useState(defaultScale);
  const [exportSelected, setExportSelected] = useState(someElementIsSelected);
  const previeRef = useRef<HTMLDivElement>(null);
  const { exportBackground, viewBackgroundColor } = appState;

  const exportedElements = exportSelected
    ? elements.filter(element => element.isSelected)
    : elements;

  useEffect(() => {
    setExportSelected(someElementIsSelected);
  }, [someElementIsSelected]);

  useEffect(() => {
    const previewNode = previeRef.current;
    const canvas = getExportCanvasPreview(exportedElements, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      scale
    });
    previewNode?.appendChild(canvas);
    return () => {
      previewNode?.removeChild(canvas);
    };
  }, [
    modalIsShown,
    exportedElements,
    exportBackground,
    exportPadding,
    viewBackgroundColor,
    scale
  ]);

  function handleClose() {
    setModalIsShown(false);
    setExportSelected(someElementIsSelected);
  }

  return (
    <>
      <ToolIcon
        onClick={() => setModalIsShown(true)}
        icon={exportFile}
        type="button"
        aria-label="Show export dialog"
        title={t("buttons.export")}
      />
      {modalIsShown && (
        <Modal maxWidth={640} onCloseRequest={handleClose}>
          <div className="ExportDialog__dialog">
            <Island padding={4}>
              <button className="ExportDialog__close" onClick={handleClose}>
                ╳
              </button>
              <h2>{t("buttons.export")}</h2>
              <div className="ExportDialog__preview" ref={previeRef}></div>
              <div className="ExportDialog__actions">
                <Stack.Row gap={2}>
                  <ToolIcon
                    type="button"
                    icon={downloadFile}
                    title={t("buttons.exportToPng")}
                    aria-label={t("buttons.exportToPng")}
                    onClick={() => onExportToPng(exportedElements, scale)}
                  />
                  {probablySupportsClipboard && (
                    <ToolIcon
                      type="button"
                      icon={clipboard}
                      title={t("buttons.copyToClipboard")}
                      aria-label={t("buttons.copyToClipboard")}
                      onClick={() =>
                        onExportToClipboard(exportedElements, scale)
                      }
                    />
                  )}
                  <ToolIcon
                    type="button"
                    icon={link}
                    title={t("buttons.getShareableLink")}
                    aria-label={t("buttons.getShareableLink")}
                    onClick={() => onExportToBackend(exportedElements, 1)}
                  />
                </Stack.Row>

                {actionManager.renderAction(
                  "changeProjectName",
                  elements,
                  appState,
                  syncActionResult,
                  t
                )}
                <Stack.Col gap={1}>
                  <div className="ExportDialog__scales">
                    <Stack.Row gap={1} align="baseline">
                      {scales.map(s => (
                        <ToolIcon
                          key={s}
                          size="s"
                          type="radio"
                          icon={"x" + s}
                          name="export-canvas-scale"
                          id="export-canvas-scale"
                          checked={scale === s}
                          onChange={() => setScale(s)}
                        />
                      ))}
                    </Stack.Row>
                  </div>
                  {actionManager.renderAction(
                    "changeExportBackground",
                    elements,
                    appState,
                    syncActionResult,
                    t
                  )}
                  {someElementIsSelected && (
                    <div>
                      <label>
                        <input
                          type="checkbox"
                          checked={exportSelected}
                          onChange={e =>
                            setExportSelected(e.currentTarget.checked)
                          }
                        />{" "}
                        {t("labels.onlySelected")}
                      </label>
                    </div>
                  )}
                </Stack.Col>
              </div>
            </Island>
          </div>
        </Modal>
      )}
    </>
  );
}
