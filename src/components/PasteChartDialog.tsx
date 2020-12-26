import React from "react";
import { renderSpreadsheet, Spreadsheet } from "../charts";
import { ChartType } from "../element/types";
import { exportToSvg } from "../scene/export";
import { AppState } from "../types";
import { Dialog } from "./Dialog";
import "./PasteChartDialog.scss";

const ChartPreviewBtn = (props: {
  spreadsheet: Spreadsheet | null;
  chartType: ChartType;
  selected: boolean;
  onClick: (chartType: ChartType) => void;
}) => {
  let svg: SVGSVGElement;
  if (props.spreadsheet) {
    const chartPreview = renderSpreadsheet(
      props.chartType,
      props.spreadsheet,
      0,
      0,
    );
    svg = exportToSvg(chartPreview as any, {
      exportBackground: false,
      viewBackgroundColor: "#fff",
      shouldAddWatermark: false,
    });
    console.info("#####", svg);
  }

  return (
    <a
      href={`#${props.chartType}`}
      className={`ChartPreview ${props.selected ? "selected" : ""}`}
      onClick={() => props.onClick(props.chartType)}
    >
      {props.chartType}
    </a>
  );
};

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
    console.info("### Paste", chartType, appState.charts.data);
    setAppState({
      charts: {
        shown: false,
        data: null,
        currentChartType: chartType,
      },
    });
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
          spreadsheet={appState.charts.data}
          selected={appState.charts.currentChartType === "bar"}
          onClick={handleChart}
        />
        <ChartPreviewBtn
          chartType="line"
          spreadsheet={appState.charts.data}
          selected={appState.charts.currentChartType === "line"}
          onClick={handleChart}
        />
      </div>
    </Dialog>
  );
};
