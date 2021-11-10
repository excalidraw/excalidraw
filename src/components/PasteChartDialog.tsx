import oc from "open-color";
import React, { useLayoutEffect, useRef, useState } from "react";
import { trackEvent } from "../analytics";
import { ChartElements, renderSpreadsheet, Spreadsheet } from "../charts";
import { ChartType } from "../element/types";
import { t } from "../i18n";
import { exportToSvg } from "../scene/export";
import { AppState, LibraryItem } from "../types";
import { Dialog } from "./Dialog";
import "./PasteChartDialog.scss";

type OnInsertChart = (chartType: ChartType, elements: ChartElements) => void;

const ChartPreviewBtn = (props: {
  spreadsheet: Spreadsheet | null;
  chartType: ChartType;
  selected: boolean;
  onClick: OnInsertChart;
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [chartElements, setChartElements] = useState<ChartElements | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!props.spreadsheet) {
      return;
    }

    const elements = renderSpreadsheet(
      props.chartType,
      props.spreadsheet,
      0,
      0,
    );
    setChartElements(elements);
    let svg: SVGSVGElement;
    const previewNode = previewRef.current!;

    (async () => {
      svg = await exportToSvg(
        elements,
        {
          exportBackground: false,
          viewBackgroundColor: oc.white,
        },
        null, // files
      );

      previewNode.appendChild(svg);

      if (props.selected) {
        (previewNode.parentNode as HTMLDivElement).focus();
      }
    })();

    return () => {
      previewNode.removeChild(svg);
    };
  }, [props.spreadsheet, props.chartType, props.selected]);

  return (
    <button
      className="ChartPreview"
      onClick={() => {
        if (chartElements) {
          props.onClick(props.chartType, chartElements);
        }
      }}
    >
      <div ref={previewRef} />
    </button>
  );
};

export const PasteChartDialog = ({
  setAppState,
  appState,
  onClose,
  onInsertChart,
}: {
  appState: AppState;
  onClose: () => void;
  setAppState: React.Component<any, AppState>["setState"];
  onInsertChart: (elements: LibraryItem["elements"]) => void;
}) => {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleChartClick = (chartType: ChartType, elements: ChartElements) => {
    onInsertChart(elements);
    trackEvent("magic", "chart", chartType);
    setAppState({
      currentChartType: chartType,
      pasteDialog: {
        shown: false,
        data: null,
      },
    });
  };

  return (
    <Dialog
      small
      onCloseRequest={handleClose}
      title={t("labels.pasteCharts")}
      className={"PasteChartDialog"}
      autofocus={false}
    >
      <div className={"container"}>
        <ChartPreviewBtn
          chartType="bar"
          spreadsheet={appState.pasteDialog.data}
          selected={appState.currentChartType === "bar"}
          onClick={handleChartClick}
        />
        <ChartPreviewBtn
          chartType="line"
          spreadsheet={appState.pasteDialog.data}
          selected={appState.currentChartType === "line"}
          onClick={handleChartClick}
        />
      </div>
    </Dialog>
  );
};
