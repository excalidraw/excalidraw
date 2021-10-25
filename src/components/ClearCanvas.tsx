import { useState } from "react";
import { t } from "../i18n";
import { useIsMobile } from "./App";
import { Dialog } from "./Dialog";
import { trash } from "./icons";
import { ToolButton } from "./ToolButton";

import "./ClearCanvas.scss";

const ClearCanvas = ({ onConfirm }: { onConfirm: () => void }) => {
  const [showDialog, setShowDialog] = useState(false);
  const toggleDialog = () => {
    setShowDialog(!showDialog);
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
                title={t("buttons.clear")}
                aria-label={t("buttons.clear")}
                label={t("buttons.clear")}
                onClick={() => {
                  onConfirm();
                  toggleDialog();
                }}
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
