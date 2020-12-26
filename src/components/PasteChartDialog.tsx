import React from "react";
import { AppState } from "../types";
import { Dialog } from "./Dialog";
import "./PasteChartDialog.scss";

export const PasteChartDialog = ({
  className,
  appState,
  onClose,
}: {
  className?: string;
  appState: AppState;
  onClose: () => void;
}) => {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleChart = (chartType: string) => {
    console.info("### Paste", chartType, appState.spreadsheet);
    onClose();
  };

  return (
    <Dialog
      maxWidth={420}
      onCloseRequest={handleClose}
      title={"Paste chart"}
      className={className}
    >
      <div className={"container"}>
        <button
          className={"chart-btn"}
          onClick={() => {
            handleChart("bar");
          }}
        >
          {"[Bar preview]"}
        </button>
        <button
          className={"chart-btn"}
          onClick={() => {
            handleChart("line");
          }}
        >
          {"[Line preview]"}
        </button>
      </div>
    </Dialog>
  );
};
