import React, { useState } from "react";
import { ActionsManagerInterface } from "../actions/types";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useIsMobile } from "./App";
import { AppState } from "../types";
import { Dialog } from "./Dialog";
import { exportFile, exportToFileIcon, link } from "./icons";
import { ToolButton } from "./ToolButton";
import { actionSaveAsScene } from "../actions/actionExport";
import { Card } from "./Card";

import "./ExportDialog.scss";
import { supported as fsSupported } from "browser-fs-access";

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
  scale?: number,
) => void;

const JSONExportModal = ({
  elements,
  appState,
  actionManager,
  onExportToBackend,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionsManagerInterface;
  onExportToBackend?: ExportCB;
  onCloseRequest: () => void;
}) => {
  return (
    <div className="ExportDialog ExportDialog--json">
      <div className="ExportDialog-cards">
        <Card color="lime">
          <div className="Card-icon">{exportToFileIcon}</div>
          <h2>{t("exportDialog.disk_title")}</h2>
          <div className="Card-details">
            {t("exportDialog.disk_details")}
            {!fsSupported && actionManager.renderAction("changeProjectName")}
          </div>
          <ToolButton
            className="Card-button"
            type="button"
            title={t("exportDialog.disk_button")}
            aria-label={t("exportDialog.disk_button")}
            showAriaLabel={true}
            onClick={() => {
              actionManager.executeAction(actionSaveAsScene);
            }}
          />
        </Card>
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
              onClick={() => onExportToBackend(elements)}
            />
          </Card>
        )}
      </div>
    </div>
  );
};

export const JSONExportDialog = ({
  elements,
  appState,
  actionManager,
  onExportToBackend,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionsManagerInterface;
  onExportToBackend?: ExportCB;
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
        showAriaLabel={useIsMobile()}
        title={t("buttons.export")}
      />
      {modalIsShown && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.export")}>
          <JSONExportModal
            elements={elements}
            appState={appState}
            actionManager={actionManager}
            onExportToBackend={onExportToBackend}
            onCloseRequest={handleClose}
          />
        </Dialog>
      )}
    </>
  );
};
