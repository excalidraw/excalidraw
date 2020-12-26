import oc from "open-color";
import React, { useEffect, useRef } from "react";
import { renderSpreadsheet, Spreadsheet } from "../charts";
import { ChartType } from "../element/types";
import { exportToSvg } from "../scene/export";
import { AppState, LibraryItem } from "../types";
import { Dialog } from "./Dialog";
import "./PasteChartDialog.scss";

const ChartPreviewBtn = (props: {
  spreadsheet: Spreadsheet | null;
  chartType: ChartType;
  selected: boolean;
  onClick: (chartType: ChartType) => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!props.spreadsheet) {
      return;
    }

    const chartPreview = renderSpreadsheet(
      props.chartType,
      props.spreadsheet,
      0,
      0,
    );
    const svg = exportToSvg(chartPreview as any, {
      exportBackground: false,
      viewBackgroundColor: oc.white,
      shouldAddWatermark: false,
    });
    ref.current!.appendChild(svg);

    const current = ref.current!;
    return () => {
      current.removeChild(svg);
    };
  });

  return (
    <button
      data-chart-type={props.chartType}
      className="ChartPreview"
      onClick={() => props.onClick(props.chartType)}
    >
      <div ref={ref} />
    </button>
  );
};

export const PasteChartDialog = ({
  setAppState,
  appState,
  onClose,
  onInsertShape,
}: {
  appState: AppState;
  onClose: () => void;
  setAppState: React.Component<any, AppState>["setState"];
  onInsertShape: (elements: LibraryItem) => void;
}) => {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleChartClick = (chartType: ChartType) => {
    if (appState.charts.data) {
      onInsertShape(
        renderSpreadsheet(chartType, appState.charts.data, 0, 0) as LibraryItem,
      );
    }
    console.info("### Paste", chartType, appState.charts.data);
    setAppState({
      charts: {
        shown: false,
        data: null,
        currentChartType: chartType,
      },
    });
  };

  const focusActiveChartType = (node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const button = node.querySelector(
      `.ChartPreview[data-chart-type="${appState.charts.currentChartType}"]`,
    );

    (button as HTMLDivElement).focus();
  };

  return (
    <Dialog
      maxWidth={500}
      onCloseRequest={handleClose}
      title={"Paste chart"}
      className={"PasteChartDialog"}
    >
      <div className={"container"} ref={focusActiveChartType}>
        <ChartPreviewBtn
          chartType="bar"
          spreadsheet={appState.charts.data}
          selected={appState.charts.currentChartType === "bar"}
          onClick={handleChartClick}
        />
        <ChartPreviewBtn
          chartType="line"
          spreadsheet={appState.charts.data}
          selected={appState.charts.currentChartType === "line"}
          onClick={handleChartClick}
        />
      </div>
    </Dialog>
  );
};
