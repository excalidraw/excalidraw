import { useState } from "react";
import { t } from "../i18n";
import { TrashIcon } from "./icons";

import ConfirmDialog from "./ConfirmDialog";
import DropdownMenuItem from "./dropdownMenu/DropdownMenuItem";

const ClearCanvas = ({ onConfirm }: { onConfirm: () => void }) => {
  const [showDialog, setShowDialog] = useState(false);
  const toggleDialog = () => {
    setShowDialog(!showDialog);
  };

  return (
    <>
      <DropdownMenuItem
        icon={TrashIcon}
        onSelect={toggleDialog}
        dataTestId="clear-canvas-button"
        ariaLabel={t("buttons.clearReset")}
      >
        {t("buttons.clearReset")}
      </DropdownMenuItem>

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
