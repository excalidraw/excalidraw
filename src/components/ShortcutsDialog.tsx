import React from "react";
import { t } from "../i18n";

import { Dialog } from "./Dialog";

export function ShortcutsDialog({ onClose }: { onClose?: () => void }) {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <>
      <Dialog
        maxWidth={500}
        onCloseRequest={handleClose}
        title={t("errorDialog.title")}
      >
        <div>shortcuts</div>
      </Dialog>
    </>
  );
}
