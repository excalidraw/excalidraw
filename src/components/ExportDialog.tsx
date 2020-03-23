import "./ExportDialog.scss";

import React, { useState, useEffect, useRef } from "react";

import { ToolButton } from "./ToolButton";
import { clipboard, exportFile, link } from "./icons";
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
import { Dialog } from "./Dialog";

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
  closeButton,
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
  closeButton: React.RefObject<HTMLButtonElement>;
}) {
  const someElementIsSelected = isSomeElementSelected(elements, appState);
  const [scale, setScale] = useState(defaultScale);
  const [exportSelected, setExportSelected] = useState(someElementIsSelected);
  const previewRef = useRef<HTMLDivElement>(null);
  const { exportBackground, viewBackgroundColor } = appState;
  const pngButton = useRef<HTMLButtonElement>(null);
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
    <div onKeyDown={handleKeyDown} className="ExportDialog">
      <div className="ExportDialog__preview" ref={previewRef}></div>
      <Stack.Col gap={2} align="center">
        <div className="ExportDialog__actions">
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
                title={t("buttons.copyPngToClipboard")}
                aria-label={t("buttons.copyPngToClipboard")}
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
          <div className="ExportDialog__name">
            {actionManager.renderAction("changeProjectName")}
          </div>
          <Stack.Row gap={2}>
            {scales.map((s) => (
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
                onChange={(event) =>
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
  const closeButton = useRef<HTMLButtonElement>(null);

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
        <Dialog
          maxWidth={800}
          onCloseRequest={handleClose}
          title={t("buttons.export")}
          closeButtonRef={closeButton}
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
            closeButton={closeButton}
          />
        </Dialog>
      )}
    </>
  );
}
