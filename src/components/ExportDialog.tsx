import React, { useEffect, useRef, useState } from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { ActionsManagerInterface } from "../actions/types";
import { probablySupportsClipboardBlob } from "../clipboard";
import { canvasToBlob } from "../data/blob";
import { NonDeletedExcalidrawElement } from "../element/types";
import { CanvasError } from "../errors";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas, getExportSize } from "../scene/export";
import { AppState } from "../types";
import { Dialog } from "./Dialog";
import "./ExportDialog.scss";
import { clipboard, exportFile, link } from "./icons";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";

const scales = [1, 2, 3];
const defaultScale = scales.includes(devicePixelRatio) ? devicePixelRatio : 1;

export const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("canvasError.cannotShowPreview")}</h3>
      <p>
        <span>{t("canvasError.canvasTooBig")}</span>
      </p>
      <em>({t("canvasError.canvasTooBigTip")})</em>
    </div>
  );
};

const renderPreview = (
  content: HTMLCanvasElement | Error,
  previewNode: HTMLDivElement,
) => {
  unmountComponentAtNode(previewNode);
  previewNode.innerHTML = "";
  if (content instanceof HTMLCanvasElement) {
    previewNode.appendChild(content);
  } else {
    render(<ErrorCanvasPreview />, previewNode);
  }
};

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
  scale?: number,
) => void;

const ExportModal = ({
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
  onExportToBackend?: ExportCB;
  onCloseRequest: () => void;
}) => {
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
    if (!previewNode) {
      return;
    }
    try {
      const canvas = exportToCanvas(exportedElements, appState, {
        exportBackground,
        viewBackgroundColor,
        exportPadding,
        scale,
        shouldAddWatermark,
      });

      // if converting to blob fails, there's some problem that will
      // likely prevent preview and export (e.g. canvas too big)
      canvasToBlob(canvas)
        .then(() => {
          renderPreview(canvas, previewNode);
        })
        .catch((error) => {
          console.error(error);
          renderPreview(new CanvasError(), previewNode);
        });
    } catch (error) {
      console.error(error);
      renderPreview(new CanvasError(), previewNode);
    }
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
      <div className="ExportDialog__preview" ref={previewRef} />
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
            {onExportToBackend && (
              <ToolButton
                type="button"
                icon={link}
                title={t("buttons.getShareableLink")}
                aria-label={t("buttons.getShareableLink")}
                onClick={() => onExportToBackend(exportedElements)}
              />
            )}
          </Stack.Row>
          <div className="ExportDialog__name">
            {actionManager.renderAction("changeProjectName")}
          </div>
          <Stack.Row gap={2}>
            {scales.map((s) => {
              const [width, height] = getExportSize(
                exportedElements,
                exportPadding,
                shouldAddWatermark,
                s,
              );

              const scaleButtonTitle = `${t(
                "buttons.scale",
              )} ${s}x (${width}x${height})`;

              return (
                <ToolButton
                  key={s}
                  size="s"
                  type="radio"
                  icon={`${s}x`}
                  name="export-canvas-scale"
                  title={scaleButtonTitle}
                  aria-label={scaleButtonTitle}
                  id="export-canvas-scale"
                  checked={s === scale}
                  onChange={() => setScale(s)}
                />
              );
            })}
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
        {actionManager.renderAction("changeExportEmbedScene")}
        {actionManager.renderAction("changeShouldAddWatermark")}
      </Stack.Col>
    </div>
  );
};

export const ExportDialog = ({
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
  onExportToBackend?: ExportCB;
}) => {
  const [modalIsShown, setModalIsShown] = useState(false);
  const triggerButton = useRef<HTMLButtonElement>(null);

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);
    triggerButton.current?.focus();
  }, []);

  return (
    <>
      <ToolButton
        onClick={() => {
          setModalIsShown(true);
        }}
        icon={exportFile}
        type="button"
        aria-label={t("buttons.export")}
        showAriaLabel={useIsMobile()}
        title={t("buttons.export")}
        ref={triggerButton}
      />
      {modalIsShown && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.export")}>
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
};
