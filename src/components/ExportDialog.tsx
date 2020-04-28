import "./ExportDialog.scss";

import React, { useState, useEffect, useRef } from "react";

import { ToolButton } from "./ToolButton";
import { clipboard, exportFile, link } from "./icons";
import { NonDeletedExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { exportToCanvas } from "../scene/export";
import { ActionsManagerInterface } from "../actions/types";
import Stack from "./Stack";
import { t } from "../i18n";

import { probablySupportsClipboardBlob } from "../clipboard";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import useIsMobile from "../is-mobile";
import { Dialog } from "./Dialog";

const scales = [1, 2, 3];
const defaultScale = scales.includes(devicePixelRatio) ? devicePixelRatio : 1;

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
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
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
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
  const {
    exportBackground,
    viewBackgroundColor,
    shouldAddWatermark,
  } = appState;

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
      shouldAddWatermark,
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
    shouldAddWatermark,
  ]);

  return (
    <div className="ExportDialog">
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
              />{" "}
              {t("labels.onlySelected")}
            </label>
          </div>
        )}
        {actionManager.renderAction("changeShouldAddWatermark")}
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
  elements: readonly NonDeletedExcalidrawElement[];
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
        <Dialog
          maxWidth={800}
          onCloseRequest={handleClose}
          title={t("buttons.export")}
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
        </Dialog>
      )}
    </>
  );
}
