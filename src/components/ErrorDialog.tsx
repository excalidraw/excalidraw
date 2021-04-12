import React, { useState } from "react";
import { t } from "../i18n";

import { Dialog } from "./Dialog";

export const ErrorDialog = ({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) => {
  const [modalIsShown, setModalIsShown] = useState(!!message);

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);

    if (onClose) {
      onClose();
    }
    document.querySelector<HTMLElement>(".excalidraw-container")?.focus();
  }, [onClose]);

  return (
    <>
      {modalIsShown && (
        <Dialog
          small
          onCloseRequest={handleClose}
          title={t("errorDialog.title")}
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{message}</div>
        </Dialog>
      )}
    </>
  );
};
