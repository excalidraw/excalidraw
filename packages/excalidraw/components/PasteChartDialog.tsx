import React, { useLayoutEffect, useRef, useState } from "react";

import { newTextElement } from "@excalidraw/element";

import type { ChartType } from "@excalidraw/element/types";

import { trackEvent } from "../analytics";
import {
  isSpreadsheetValidForChartType,
  renderSpreadsheet,
} from "../charts/index";
import { t } from "../i18n";
import { exportToSvg } from "../scene/export";

import { useUIAppState } from "../context/ui-appState";
import { COLOR_WHITE } from "../../common/src";

import { useApp } from "./App";
import { Dialog } from "./Dialog";

import "./PasteChartDialog.scss";

import { bucketFillIcon } from "./icons";

import type { ChartElements, Spreadsheet } from "../charts/index";

type OnPlainTextPaste = (rawText: string) => void;

type OnInsertChart = (chartType: ChartType, elements: ChartElements) => void;

const getChartTypeLabel = (chartType: ChartType) => {
  switch (chartType) {
    case "bar":
      return t("labels.chartType_bar");
    case "line":
      return t("labels.chartType_line");
    case "radar":
      return t("labels.chartType_radar");
    default:
      return chartType;
  }
};

const ChartPreviewBtn = (props: {
  spreadsheet: Spreadsheet | null;
  chartType: ChartType;
  colorSeed: number;
  onClick: OnInsertChart;
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [chartElements, setChartElements] = useState<ChartElements | null>(
    null,
  );
  const { theme } = useUIAppState();

  useLayoutEffect(() => {
    if (!props.spreadsheet) {
      setChartElements(null);
      return;
    }

    const elements = renderSpreadsheet(
      props.chartType,
      props.spreadsheet,
      0,
      0,
      props.colorSeed,
    );
    if (!elements) {
      setChartElements(null);
      previewRef.current?.replaceChildren();
      return;
    }
    setChartElements(elements);
    let svg: SVGSVGElement;
    const previewNode = previewRef.current!;

    (async () => {
      svg = await exportToSvg({
        data: {
          elements,
          appState: {
            exportBackground: false,
            viewBackgroundColor: COLOR_WHITE,
            exportWithDarkMode: theme === "dark",
          },
          files: null,
        },
        config: {
          skipInliningFonts: true,
        },
      });
      svg.querySelector(".style-fonts")?.remove();
      previewNode.replaceChildren();
      previewNode.appendChild(svg);
    })();

    return () => {
      previewNode.replaceChildren();
    };
  }, [props.spreadsheet, props.chartType, props.colorSeed, theme]);

  const chartTypeLabel = getChartTypeLabel(props.chartType);

  return (
    <button
      type="button"
      className="ChartPreview"
      aria-label={chartTypeLabel}
      onClick={() => {
        if (chartElements) {
          props.onClick(props.chartType, chartElements);
        }
      }}
    >
      <div className="ChartPreview__canvas" ref={previewRef} />
      <div className="ChartPreview__label">{chartTypeLabel}</div>
    </button>
  );
};

const PlainTextPreviewBtn = (props: {
  rawText: string;
  onClick: OnPlainTextPaste;
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useUIAppState();

  useLayoutEffect(() => {
    if (!props.rawText) {
      return;
    }

    const textElement = newTextElement({
      text: props.rawText,
      x: 0,
      y: 0,
    });

    const previewNode = previewRef.current!;

    (async () => {
      const svg = await exportToSvg({
        data: {
          elements: [textElement],
          appState: {
            exportBackground: false,
            viewBackgroundColor: COLOR_WHITE,
            exportWithDarkMode: theme === "dark",
          },
          files: null,
        },
        config: {
          skipInliningFonts: true,
        },
      });
      svg.querySelector(".style-fonts")?.remove();
      previewNode.replaceChildren();
      previewNode.appendChild(svg);
    })();

    return () => {
      previewNode.replaceChildren();
    };
  }, [props.rawText, theme]);

  return (
    <button
      type="button"
      className="ChartPreview"
      aria-label={t("labels.chartType_plaintext")}
      onClick={() => {
        props.onClick(props.rawText);
      }}
    >
      <div className="ChartPreview__canvas" ref={previewRef} />
      <div className="ChartPreview__label">
        {t("labels.chartType_plaintext")}
      </div>
    </button>
  );
};

export const PasteChartDialog = ({
  data,
  rawText,
  onClose,
}: {
  data: Spreadsheet;
  rawText: string;
  onClose: () => void;
}) => {
  const { onInsertElements, focusContainer } = useApp();
  const [colorSeed, setColorSeed] = useState(Math.random());

  const handleReshuffleColors = React.useCallback(() => {
    setColorSeed(Math.random());
  }, []);

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleChartClick = (chartType: ChartType, elements: ChartElements) => {
    onInsertElements(elements);
    trackEvent("paste", "chart", chartType);
    onClose();
    focusContainer();
  };

  const handlePlainTextClick = (rawText: string) => {
    const textElement = newTextElement({
      text: rawText,
      x: 0,
      y: 0,
    });
    onInsertElements([textElement]);
    trackEvent("paste", "chart", "plaintext");
    onClose();
    focusContainer();
  };

  return (
    <Dialog
      size="regular"
      onCloseRequest={handleClose}
      title={
        <div className="PasteChartDialog__title">
          <div className="PasteChartDialog__titleText">
            {t("labels.pasteCharts")}
          </div>
          <div
            className="PasteChartDialog__reshuffleBtn"
            onClick={handleReshuffleColors}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleReshuffleColors();
              }
            }}
          >
            {bucketFillIcon}
          </div>
        </div>
      }
      className={"PasteChartDialog"}
      autofocus={false}
    >
      <div className={"container"}>
        {(["bar", "line", "radar"] as const).map((chartType) => {
          if (!isSpreadsheetValidForChartType(data, chartType)) {
            return null;
          }

          return (
            <ChartPreviewBtn
              key={chartType}
              chartType={chartType}
              spreadsheet={data}
              colorSeed={colorSeed}
              onClick={handleChartClick}
            />
          );
        })}
        {rawText && (
          <PlainTextPreviewBtn
            rawText={rawText}
            onClick={handlePlainTextClick}
          />
        )}
      </div>
    </Dialog>
  );
};
