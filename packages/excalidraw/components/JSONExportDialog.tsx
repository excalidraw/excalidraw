import React from "react";

import { getFrame } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { actionSaveFileToDisk } from "../actions/actionExport";

import { trackEvent } from "../analytics";
import { nativeFileSystemSupported } from "../data/filesystem";
import { t } from "../i18n";

import { Card } from "./Card";
import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { exportToFileIcon, LinkIcon } from "./icons";

import "./ExportDialog.scss";

import type { ActionManager } from "../actions/manager";

import type { ExportOpts, BinaryFiles, UIAppState } from "../types";

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
  scale?: number,
) => void;

const JSONExportModal = ({
  elements,
  appState,
  setAppState,
  files,
  actionManager,
  exportOpts,
  canvas,
  onCloseRequest,
}: {
  appState: UIAppState;
  setAppState: React.Component<any, UIAppState>["setState"];
  files: BinaryFiles;
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionManager;
  onCloseRequest: () => void;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement;
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
                actionManager.executeAction(actionSaveFileToDisk, "ui");
              }}
            />
          </Card>
        )}
        {onExportToBackend && (
          <Card color="pink">
            <div className="Card-icon">{LinkIcon}</div>
            <h2>{t("exportDialog.link_title")}</h2>
            <div className="Card-details">{t("exportDialog.link_details")}</div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.link_button")}
              aria-label={t("exportDialog.link_button")}
              showAriaLabel={true}
              onClick={async () => {
                try {
                  trackEvent("export", "link", `ui (${getFrame()})`);
                  await onExportToBackend(elements, appState, files);
                  onCloseRequest();
                } catch (error: any) {
                  setAppState({ errorMessage: error.message });
                }
              }}
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
  setAppState,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: UIAppState;
  files: BinaryFiles;
  actionManager: ActionManager;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement;
  setAppState: React.Component<any, UIAppState>["setState"];
}) => {
  const handleClose = React.useCallback(() => {
    setAppState({ openDialog: null });
  }, [setAppState]);

  return (
    <>
      {appState.openDialog?.name === "jsonExport" && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.export")}>
          <JSONExportModal
            elements={elements}
            appState={appState}
            setAppState={setAppState}
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
