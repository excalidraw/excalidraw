import "./ExportDialog.css";

import React, { useState, useEffect, useRef } from "react";

import { Modal } from "./Modal";
import { ToolButton } from "./ToolButton";
import { clipboard, exportFile, link } from "./icons";
import { Island } from "./Island";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { exportToCanvas } from "../scene/export";
import { ActionsManagerInterface } from "../actions/types";
import Stack from "./Stack";
import { t } from "../i18n";

import { KEYS } from "../keys";

import { probablySupportsClipboardBlob } from "../clipboard";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import useIsMobile from "../is-mobile";

const scales = [1, 2, 3];
const defaultScale = scales.includes(devicePixelRatio) ? devicePixelRatio : 1;

export type ExportCB = (
  elements: readonly ExcalidrawElement[],
  scale?: number,
) => void;

function ExportModal({
  elements,
  appState,
  exportPadding = 10,
  actionManager,
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
  onExportToPng: ExportCB;
  onExportToSvg: ExportCB;
  onExportToClipboard: ExportCB;
  onExportToBackend: ExportCB;
  onCloseRequest: () => void;
}) {
  const someElementIsSelected = isSomeElementSelected(elements, appState);
  const [scale, setScale] = useState(defaultScale);
  const [exportSelected, setExportSelected] = useState(someElementIsSelected);
  const previewRef = useRef<HTMLDivElement>(null);
  const { exportBackground, viewBackgroundColor } = appState;
  const pngButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onlySelectedInput = useRef<HTMLInputElement>(null);

  const exportedElements = exportSelected
    ? getSelectedElements(elements, appState)
    : elements;

  useEffect(() => {
    setExportSelected(someElementIsSelected);
  }, [someElementIsSelected]);

  useEffect(() => {
    const previewNode = previewRef.current;
    const canvas = exportToCanvas(exportedElements, appState, {
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
    appState,
    exportedElements,
    exportBackground,
    exportPadding,
    viewBackgroundColor,
    scale,
  ]);

  useEffect(() => {
    pngButton.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === KEYS.TAB) {
      const { activeElement } = document;
      if (event.shiftKey) {
        if (activeElement === pngButton.current) {
          closeButton.current?.focus();
          event.preventDefault();
        }
      } else {
        if (activeElement === closeButton.current) {
          pngButton.current?.focus();
          event.preventDefault();
        }
        if (activeElement === onlySelectedInput.current) {
          closeButton.current?.focus();
          event.preventDefault();
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
              {probablySupportsClipboardBlob && (
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

          {actionManager.renderAction("changeProjectName")}
          <Stack.Col gap={1}>
            <div className="ExportDialog__scales">
              <Stack.Row gap={2} align="baseline">
                {scales.map(s => (
                  <ToolButton
                    key={s}
                    size="s"
                    type="radio"
                    icon={`x${s}`}
                    name="export-canvas-scale"
                    aria-label={`Scale ${s} x`}
                    id="export-canvas-scale"
                    checked={s === scale}
                    onChange={() => setScale(s)}
                  />
                ))}
              </Stack.Row>
            </div>
            {actionManager.renderAction("changeExportBackground")}
            {someElementIsSelected && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={exportSelected}
                    onChange={event =>
                      setExportSelected(event.currentTarget.checked)
                    }
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
  onExportToPng,
  onExportToSvg,
  onExportToClipboard,
  onExportToBackend,
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  exportPadding?: number;
  actionManager: ActionsManagerInterface;
  onExportToPng: ExportCB;
  onExportToSvg: ExportCB;
  onExportToClipboard: ExportCB;
  onExportToBackend: ExportCB;
}) {
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
        showAriaLabel={useIsMobile()}
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
