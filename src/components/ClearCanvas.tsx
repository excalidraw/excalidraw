import { useState } from "react";
import { t } from "../i18n";
import { useDevice } from "./App";
import { trash } from "./icons";
import { ToolButton } from "./ToolButton";

import ConfirmDialog from "./ConfirmDialog";

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
        showAriaLabel={useDevice().isMobile}
        onClick={toggleDialog}
        data-testid="clear-canvas-button"
      />

      {showDialog && (
        <ConfirmDialog
          onConfirm={() => {
            onConfirm();
            toggleDialog();
          }}
          onCancel={toggleDialog}
          title={t("clearCanvasDialog.title")}
        >
          <p className="clear-canvas__content"> {t("alerts.clearReset")}</p>
        </ConfirmDialog>
      )}
    </>
  );
};

export default ClearCanvas;
