import React, { useState } from "react";
import { Dialog } from "./Dialog";
import "./PasteChartDialog.scss";

export const PasteChartDialog = ({ onClose }: { onClose?: () => void }) => {
  const [modalIsShown, setModalIsShown] = useState(false);

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
          maxWidth={500}
          onCloseRequest={handleClose}
          title={"Paste Chart"}
        >
          <div>{"Hello"}</div>
        </Dialog>
      )}
    </>
  );
};
