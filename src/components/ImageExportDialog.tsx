import React, { useEffect, useRef, useState } from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { probablySupportsClipboardBlob } from "../clipboard";
import { canvasToBlob } from "../data/blob";
import { NonDeletedExcalidrawElement } from "../element/types";
import { CanvasError } from "../errors";
import { t } from "../i18n";
import { useDevice } from "./App";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas } from "../scene/export";
import { AppState, BinaryFiles } from "../types";
import { Dialog } from "./Dialog";
import { clipboard, exportImage } from "./icons";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import "./ExportDialog.scss";
import OpenColor from "open-color";
import { CheckboxItem } from "./CheckboxItem";
import { DEFAULT_EXPORT_PADDING } from "../constants";
import { nativeFileSystemSupported } from "../data/filesystem";
import { ActionManager } from "../actions/manager";

const supportsContextFilters =
  "filter" in document.createElement("canvas").getContext("2d")!;

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

const ExportButton: React.FC<{
  color: keyof OpenColor;
  onClick: () => void;
  title: string;
  shade?: number;
  children?: React.ReactNode;
}> = ({ children, title, onClick, color, shade = 6 }) => {
  return (
    <button
      className="ExportDialog-imageExportButton"
      style={{
        ["--button-color" as any]: OpenColor[color][shade],
        ["--button-color-darker" as any]: OpenColor[color][shade + 1],
        ["--button-color-darkest" as any]: OpenColor[color][shade + 2],
      }}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

const ImageExportModal = ({
  elements,
  appState,
  files,
  exportPadding = DEFAULT_EXPORT_PADDING,
  actionManager,
  onExportToPng,
  onExportToSvg,
  onExportToClipboard,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  exportPadding?: number;
  actionManager: ActionManager;
  onExportToPng: ExportCB;
  onExportToSvg: ExportCB;
  onExportToClipboard: ExportCB;
  onCloseRequest: () => void;
}) => {
  const someElementIsSelected = isSomeElementSelected(elements, appState);
  const [exportSelected, setExportSelected] = useState(someElementIsSelected);
  const previewRef = useRef<HTMLDivElement>(null);
  const { exportBackground, viewBackgroundColor } = appState;

  const exportedElements = exportSelected
    ? getSelectedElements(elements, appState, true)
    : elements;

  useEffect(() => {
    setExportSelected(someElementIsSelected);
  }, [someElementIsSelected]);

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    exportToCanvas(exportedElements, appState, files, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
    })
      .then((canvas) => {
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        return canvasToBlob(canvas).then(() => {
          renderPreview(canvas, previewNode);
        });
      })
      .catch((error) => {
        console.error(error);
        renderPreview(new CanvasError(), previewNode);
      });
  }, [
    appState,
    files,
    exportedElements,
    exportBackground,
    exportPadding,
    viewBackgroundColor,
  ]);

  return (
    <div className="ExportDialog">
      <div className="ExportDialog__preview" ref={previewRef} />
      {supportsContextFilters &&
        actionManager.renderAction("exportWithDarkMode")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            // dunno why this is needed, but when the items wrap it creates
            // an overflow
            overflow: "hidden",
          }}
        >
          {actionManager.renderAction("changeExportBackground")}
          {someElementIsSelected && (
            <CheckboxItem
              checked={exportSelected}
              onChange={(checked) => setExportSelected(checked)}
            >
              {t("labels.onlySelected")}
            </CheckboxItem>
          )}
          {actionManager.renderAction("changeExportEmbedScene")}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: ".6em" }}>
        <Stack.Row gap={2}>
          {actionManager.renderAction("changeExportScale")}
        </Stack.Row>
        <p style={{ marginLeft: "1em", userSelect: "none" }}>
          {t("buttons.scale")}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: ".6em 0",
        }}
      >
        {!nativeFileSystemSupported &&
          actionManager.renderAction("changeProjectName")}
      </div>
      <Stack.Row gap={2} justifyContent="center" style={{ margin: "2em 0" }}>
        <ExportButton
          color="indigo"
          title={t("buttons.exportToPng")}
          aria-label={t("buttons.exportToPng")}
          onClick={() => onExportToPng(exportedElements)}
        >
          PNG
        </ExportButton>
        <ExportButton
          color="red"
          title={t("buttons.exportToSvg")}
          aria-label={t("buttons.exportToSvg")}
          onClick={() => onExportToSvg(exportedElements)}
        >
          SVG
        </ExportButton>
        {probablySupportsClipboardBlob && (
          <ExportButton
            title={t("buttons.copyPngToClipboard")}
            onClick={() => onExportToClipboard(exportedElements)}
            color="gray"
            shade={7}
          >
            {clipboard}
          </ExportButton>
        )}
      </Stack.Row>
    </div>
  );
};

export const ImageExportDialog = ({
  elements,
  appState,
  files,
  exportPadding = DEFAULT_EXPORT_PADDING,
  actionManager,
  onExportToPng,
  onExportToSvg,
  onExportToClipboard,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  exportPadding?: number;
  actionManager: ActionManager;
  onExportToPng: ExportCB;
  onExportToSvg: ExportCB;
  onExportToClipboard: ExportCB;
}) => {
  const [modalIsShown, setModalIsShown] = useState(false);

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);
  }, []);

  return (
    <>
      <ToolButton
        onClick={() => {
          setModalIsShown(true);
        }}
        data-testid="image-export-button"
        icon={exportImage}
        type="button"
        aria-label={t("buttons.exportImage")}
        showAriaLabel={useDevice().isMobile}
        title={t("buttons.exportImage")}
      />
      {modalIsShown && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.exportImage")}>
          <ImageExportModal
            elements={elements}
            appState={appState}
            files={files}
            exportPadding={exportPadding}
            actionManager={actionManager}
            onExportToPng={onExportToPng}
            onExportToSvg={onExportToSvg}
            onExportToClipboard={onExportToClipboard}
            onCloseRequest={handleClose}
          />
        </Dialog>
      )}
    </>
  );
};
