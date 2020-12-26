import React from "react";
import { Spreadsheet } from "../charts";
import { ChartType } from "../element/types";
import { AppState } from "../types";
import { Dialog } from "./Dialog";
import "./PasteChartDialog.scss";

const ChartPreviewBtn = (props: {
  spreadsheet: Spreadsheet | null;
  chartType: ChartType;
  selected: boolean;
  onClick: (chartType: ChartType) => void;
}) => (
  <a
    href={`#${props.chartType}`}
    className={`ChartPreview ${props.selected ? "selected" : ""}`}
    onClick={() => props.onClick(props.chartType)}
  >
    {props.chartType}
  </a>
);

export const PasteChartDialog = ({
  setAppState,
  appState,
  onClose,
}: {
  appState: AppState;
  onClose: () => void;
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleChart = (chartType: ChartType) => {
    console.info("### Paste", chartType, appState.spreadsheet);
    setAppState({
      currentChartType: chartType,
    });
    onClose();
  };

  return (
    <Dialog
      maxWidth={420}
      onCloseRequest={handleClose}
      title={"Paste chart"}
      className={"PasteChartDialog"}
    >
      <div className={"container"}>
        <ChartPreviewBtn
          chartType="bar"
          spreadsheet={appState.spreadsheet}
          selected={appState.currentChartType === "bar"}
          onClick={handleChart}
        />
        <ChartPreviewBtn
          chartType="line"
          spreadsheet={appState.spreadsheet}
          selected={appState.currentChartType === "line"}
          onClick={handleChart}
        />
      </div>
    </Dialog>
  );
};
