import React, { useState } from "react";

import { t } from "../i18n";

import { Dialog } from "./Dialog";

export const ErrorDialog = ({
  children,
  onClose,
}: {
  children?: React.ReactNode;
  onClose?: () => void;
}) => {
  const [modalIsShown, setModalIsShown] = useState(!!children);

  const handleClose = React.useCallback(() => {
    setModalIsShown(false);

    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <>
      {modalIsShown && (
        <Dialog
          size="small"
          onCloseRequest={handleClose}
          title={t("errorDialog.title")}
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{children}</div>
        </Dialog>
      )}
    </>
  );
};
