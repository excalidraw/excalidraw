import { useState } from "react";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useIsMobile } from "./App";
import { Dialog } from "./Dialog";
import { trash } from "./icons";
import { ToolButton } from "./ToolButton";

import "./ClearCanvas.scss";
import { AppState } from "../types";
import { ActionManager } from "../actions/manager";
import { newElementWith } from "../element/mutateElement";
import { getDefaultAppState } from "../appState";

const ClearCanvas = ({
  elements,
  appState,
  actionManager,
}: {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  actionManager: ActionManager;
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const toggleDialog = () => {
    setShowDialog(!showDialog);
  };

  const onConfirm = () => {
    const data = {
      elements: elements.map((element) =>
        newElementWith(element, { isDeleted: true }),
      ),
      appState: {
        ...getDefaultAppState(),
        theme: appState.theme,
        elementLocked: appState.elementLocked,
        exportBackground: appState.exportBackground,
        exportEmbedScene: appState.exportEmbedScene,
        gridSize: appState.gridSize,
        showStats: appState.showStats,
        pasteDialog: appState.pasteDialog,
      },
      commitToHistory: true,
    };

    actionManager.updater(data);
    toggleDialog();
  };

  return (
    <>
      <ToolButton
        type="button"
        icon={trash}
        title={t("buttons.clearReset")}
        aria-label={t("buttons.clearReset")}
        showAriaLabel={useIsMobile()}
        onClick={toggleDialog}
        data-testid="clear-canvas-button"
      />

      {showDialog && (
        <Dialog
          onCloseRequest={toggleDialog}
          title={t("clearCanvasDialog.title")}
          className="clear-canvas"
          small={true}
        >
          <>
            <p className="clear-canvas__content"> {t("alerts.clearReset")}</p>
            <div className="clear-canvas-buttons">
              <ToolButton
                type="button"
                title={t("buttons.delete")}
                aria-label={t("buttons.delete")}
                label={t("buttons.delete")}
                onClick={onConfirm}
                data-testid="confirm-clear-canvas-button"
                className="clear-canvas--confirm"
              />
              <ToolButton
                type="button"
                title={t("buttons.cancel")}
                aria-label={t("buttons.cancel")}
                label={t("buttons.cancel")}
                onClick={toggleDialog}
                data-testid="cancel-clear-canvas-button"
                className="clear-canvas--cancel"
              />
            </div>
          </>
        </Dialog>
      )}
    </>
  );
};

export default ClearCanvas;
