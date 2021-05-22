import React, { useState } from "react";
import { ActionsManagerInterface } from "../actions/types";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useIsMobile } from "./App";
import { AppState } from "../types";
import { Dialog } from "./Dialog";
import { exportToFileIcon, link, save } from "./icons";
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
          <h2>Save to disk</h2>
          <div className="Card-details">
            Export the scene data to a file from which you can import later.
            {!fsSupported && actionManager.renderAction("changeProjectName")}
          </div>
          <ToolButton
            className="Card-button"
            type="button"
            title={"Save to file"}
            aria-label={"Save to file"}
            showAriaLabel={true}
            onClick={() => {
              actionManager.executeAction(actionSaveAsScene);
            }}
          />
        </Card>
        {onExportToBackend && (
          <Card color="pink">
            <div className="Card-icon">{link}</div>
            <h2>Shareable link</h2>
            <div className="Card-details">Export as a read-only link.</div>
            <ToolButton
              className="Card-button"
              type="button"
              title={"Export to Link"}
              aria-label={"Export to Link"}
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
        data-testid="export-button"
        icon={save}
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
