import "./ExportDialog.css";

import React, { useState, useEffect, useRef } from "react";

import { Modal } from "./Modal";
import { ToolButton } from "./ToolButton";
import { clipboard, exportFile, link } from "./icons";
import { Island } from "./Island";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { exportToCanvas } from "../scene/export";
import { ActionsManagerInterface, UpdaterFn } from "../actions/types";
import Stack from "./Stack";

import { useTranslation } from "react-i18next";
import { KEYS } from "../keys";

const probablySupportsClipboard =
  "toBlob" in HTMLCanvasElement.prototype &&
  "clipboard" in navigator &&
  "write" in navigator.clipboard &&
  "ClipboardItem" in window;

const scales = [1, 2, 3];
const defaultScale = scales.includes(devicePixelRatio) ? devicePixelRatio : 1;

type ExportCB = (
  elements: readonly ExcalidrawElement[],
  scale?: number,
) => void;

function ExportModal({
  elements,
  appState,
  exportPadding = 10,
  actionManager,
  syncActionResult,
  onExportToPng,
  onExportToSvg,
  onExportToClipboard,
  onExportToBackend,
  onCloseRequest,
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  exportPadding?: number;
  actionManager: ActionsManagerInterface;
  syncActionResult: UpdaterFn;
  onExportToPng: ExportCB;
  onExportToSvg: ExportCB;
  onExportToClipboard: ExportCB;
  onExportToBackend: ExportCB;
  onCloseRequest: () => void;
}) {
  const { t } = useTranslation();
  const someElementIsSelected = elements.some(element => element.isSelected);
  const [scale, setScale] = useState(defaultScale);
  const [exportSelected, setExportSelected] = useState(someElementIsSelected);
  const previewRef = useRef<HTMLDivElement>(null);
  const { exportBackground, viewBackgroundColor } = appState;
  const pngButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onlySelectedInput = useRef<HTMLInputElement>(null);

  const exportedElements = exportSelected
    ? elements.filter(element => element.isSelected)
    : elements;

  useEffect(() => {
    setExportSelected(someElementIsSelected);
  }, [someElementIsSelected]);

  useEffect(() => {
    const previewNode = previewRef.current;
    const canvas = exportToCanvas(exportedElements, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      scale,
    });
    previewNode?.appendChild(canvas);
    return () => {
      previewNode?.removeChild(canvas);
    };
  }, [
    exportedElements,
    exportBackground,
    exportPadding,
    viewBackgroundColor,
    scale,
  ]);

  useEffect(() => {
    pngButton.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === KEYS.TAB) {
      const { activeElement } = document;
      if (e.shiftKey) {
        if (activeElement === pngButton.current) {
          closeButton.current?.focus();
          e.preventDefault();
        }
      } else {
        if (activeElement === closeButton.current) {
          pngButton.current?.focus();
          e.preventDefault();
        }
        if (activeElement === onlySelectedInput.current) {
          closeButton.current?.focus();
          e.preventDefault();
        }
      }
    }
  }

  return (
    <div className="ExportDialog__dialog" onKeyDown={handleKeyDown}>
      <Island padding={4}>
        <button
          className="ExportDialog__close"
          onClick={onCloseRequest}
          aria-label={t("buttons.close")}
          ref={closeButton}
        >
          ╳
        </button>
        <h2 id="export-title">{t("buttons.export")}</h2>
        <div className="ExportDialog__preview" ref={previewRef}></div>
        <div className="ExportDialog__actions">
          <Stack.Col gap={1}>
            <Stack.Row gap={2}>
              <ToolButton
                type="button"
                label="PNG"
                title={t("buttons.exportToPng")}
                aria-label={t("buttons.exportToPng")}
                onClick={() => onExportToPng(exportedElements, scale)}
                ref={pngButton}
              />
              <ToolButton
                type="button"
                label="SVG"
                title={t("buttons.exportToSvg")}
                aria-label={t("buttons.exportToSvg")}
                onClick={() => onExportToSvg(exportedElements, scale)}
              />
              {probablySupportsClipboard && (
                <ToolButton
                  type="button"
                  icon={clipboard}
                  title={t("buttons.copyToClipboard")}
                  aria-label={t("buttons.copyToClipboard")}
                  onClick={() => onExportToClipboard(exportedElements, scale)}
                />
              )}
              <ToolButton
                type="button"
                icon={link}
                title={t("buttons.getShareableLink")}
                aria-label={t("buttons.getShareableLink")}
                onClick={() => onExportToBackend(exportedElements)}
              />
            </Stack.Row>
          </Stack.Col>

          {actionManager.renderAction(
            "changeProjectName",
            elements,
            appState,
            syncActionResult,
            t,
          )}
          <Stack.Col gap={1}>
            <div className="ExportDialog__scales">
              <Stack.Row gap={2} align="baseline">
                {scales.map(s => (
                  <ToolButton
                    key={s}
                    size="s"
                    type="radio"
                    icon={"x" + s}
                    name="export-canvas-scale"
                    aria-label={`Scale ${s} x`}
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
              t,
            )}
            {someElementIsSelected && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={exportSelected}
                    onChange={e => setExportSelected(e.currentTarget.checked)}
                    ref={onlySelectedInput}
                  />{" "}
                  {t("labels.onlySelected")}
                </label>
              </div>
            )}
          </Stack.Col>
        </div>
      </Island>
    </div>
  );
}

export function ExportDialog({
  elements,
  appState,
  exportPadding = 10,
  actionManager,
  syncActionResult,
  onExportToPng,
  onExportToSvg,
  onExportToClipboard,
  onExportToBackend,
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  exportPadding?: number;
  actionManager: ActionsManagerInterface;
  syncActionResult: UpdaterFn;
  onExportToPng: ExportCB;
  onExportToSvg: ExportCB;
  onExportToClipboard: ExportCB;
  onExportToBackend: ExportCB;
}) {
  const { t } = useTranslation();
  const [modalIsShown, setModalIsShown] = useState(false);
  const triggerButton = useRef<HTMLButtonElement>(null);

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);
    triggerButton.current?.focus();
  }, []);

  return (
    <>
      <ToolButton
        onClick={() => setModalIsShown(true)}
        icon={exportFile}
        type="button"
        aria-label={t("buttons.export")}
        title={t("buttons.export")}
        ref={triggerButton}
      />
      {modalIsShown && (
        <Modal
          maxWidth={800}
          onCloseRequest={handleClose}
          labelledBy="export-title"
        >
          <ExportModal
            elements={elements}
            appState={appState}
            exportPadding={exportPadding}
            actionManager={actionManager}
            syncActionResult={syncActionResult}
            onExportToPng={onExportToPng}
            onExportToSvg={onExportToSvg}
            onExportToClipboard={onExportToClipboard}
            onExportToBackend={onExportToBackend}
            onCloseRequest={handleClose}
          />
        </Modal>
      )}
    </>
  );
}
