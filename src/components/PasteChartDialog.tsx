import oc from "open-color";
import React, { useLayoutEffect, useRef } from "react";
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
  const previewRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
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

    const previewNode = previewRef.current!;

    previewNode.appendChild(svg);

    if (props.selected) {
      (previewNode.parentNode as HTMLDivElement).focus();
    }

    return () => {
      previewNode.removeChild(svg);
    };
  }, [props.spreadsheet, props.chartType, props.selected]);

  return (
    <button
      className="ChartPreview"
      onClick={() => props.onClick(props.chartType)}
    >
      <div ref={previewRef} />
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

  return (
    <Dialog
      maxWidth={500}
      onCloseRequest={handleClose}
      title={"Paste chart"}
      className={"PasteChartDialog"}
      autofocus={false}
    >
      <div className={"container"}>
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
