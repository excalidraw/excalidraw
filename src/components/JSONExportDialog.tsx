import React, { useState } from "react";
import { ActionsManagerInterface } from "../actions/types";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useDeviceType } from "./App";
import { AppState, ExportOpts, BinaryFiles } from "../types";
import { Dialog } from "./Dialog";
import { exportFile, exportToFileIcon, link } from "./icons";
import { ToolButton } from "./ToolButton";
import { actionSaveFileToDisk } from "../actions/actionExport";
import { Card } from "./Card";

import "./ExportDialog.scss";
import { nativeFileSystemSupported } from "../data/filesystem";

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
  scale?: number,
) => void;

const JSONExportModal = ({
  elements,
  appState,
  files,
  actionManager,
  exportOpts,
  canvas,
}: {
  appState: AppState;
  files: BinaryFiles;
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionsManagerInterface;
  onCloseRequest: () => void;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement | null;
}) => {
  const { onExportToBackend } = exportOpts;
  return (
    <div className="ExportDialog ExportDialog--json">
      <div className="ExportDialog-cards">
        {exportOpts.saveFileToDisk && (
          <Card color="lime">
            <div className="Card-icon">{exportToFileIcon}</div>
            <h2>{t("exportDialog.disk_title")}</h2>
            <div className="Card-details">
              {t("exportDialog.disk_details")}
              {!nativeFileSystemSupported &&
                actionManager.renderAction("changeProjectName")}
            </div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.disk_button")}
              aria-label={t("exportDialog.disk_button")}
              showAriaLabel={true}
              onClick={() => {
                actionManager.executeAction(actionSaveFileToDisk);
              }}
            />
          </Card>
        )}
        {onExportToBackend && (
          <Card color="pink">
            <div className="Card-icon">{link}</div>
            <h2>{t("exportDialog.link_title")}</h2>
            <div className="Card-details">{t("exportDialog.link_details")}</div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.link_button")}
              aria-label={t("exportDialog.link_button")}
              showAriaLabel={true}
              onClick={() =>
                onExportToBackend(elements, appState, files, canvas)
              }
            />
          </Card>
        )}
        {exportOpts.renderCustomUI &&
          exportOpts.renderCustomUI(elements, appState, files, canvas)}
      </div>
    </div>
  );
};

export const JSONExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  exportOpts,
  canvas,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  actionManager: ActionsManagerInterface;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement | null;
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
        data-testid="json-export-button"
        icon={exportFile}
        type="button"
        aria-label={t("buttons.export")}
        showAriaLabel={useDeviceType().isMobile}
        title={t("buttons.export")}
      />
      {modalIsShown && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.export")}>
          <JSONExportModal
            elements={elements}
            appState={appState}
            files={files}
            actionManager={actionManager}
            onCloseRequest={handleClose}
            exportOpts={exportOpts}
            canvas={canvas}
          />
        </Dialog>
      )}
    </>
  );
};
