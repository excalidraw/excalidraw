import React, { useState } from "react";
import { t } from "../i18n";

import { Dialog } from "./Dialog";
import { useExcalidrawContainer } from "./App";

export const ErrorDialog = ({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) => {
  const [modalIsShown, setModalIsShown] = useState(!!message);
  const { container: excalidrawContainer } = useExcalidrawContainer();

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);

    if (onClose) {
      onClose();
    }
    // TODO: Fix the A11y issues so this is never needed since we should always focus on last active element
    excalidrawContainer?.focus();
  }, [onClose, excalidrawContainer]);

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
