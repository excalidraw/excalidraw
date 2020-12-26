import React, { useEffect, useRef } from "react";
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
      viewBackgroundColor: "#fff",
      shouldAddWatermark: false,
    });
    for (const child of ref.current!.children) {
      if (child.tagName !== "svg") {
        continue;
      }
      ref.current!.removeChild(child);
    }
    ref.current!.appendChild(svg);

    const current = ref.current!;
    return () => {
      current.removeChild(svg);
    };
  });

  return (
    <a
      href={`#${props.chartType}`}
      className={`ChartPreview ${props.selected ? "selected" : ""}`}
      onClick={() => props.onClick(props.chartType)}
    >
      <div ref={ref} />
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
      maxWidth={500}
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
