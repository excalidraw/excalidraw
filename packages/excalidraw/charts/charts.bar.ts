import { isDevEnv } from "@excalidraw/common";

import { newElement } from "@excalidraw/element";

import { commonProps } from "./charts.constants";
import {
  chartBaseElements,
  chartXLabels,
  createSeriesLegend,
  getBackgroundColor,
  getCartesianChartLayout,
  getChartDimensions,
  getColorOffset,
  getRotatedTextElementBottom,
  getSeriesColors,
} from "./charts.helpers";

import type { ChartElements, Spreadsheet } from "./charts.types";

export const renderBarChart = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  colorSeed?: number,
): ChartElements => {
  const series = spreadsheet.series;
  const layout = getCartesianChartLayout("bar", series.length);
  const max = Math.max(
    1,
    ...series.flatMap((seriesData) =>
      seriesData.values.map((value) => Math.max(0, value)),
    ),
  );
  const colorOffset = getColorOffset(colorSeed);
  const backgroundColor = getBackgroundColor(colorOffset);
  const seriesColors = getSeriesColors(series.length, colorOffset);
  const interBarGap =
    series.length > 1
      ? Math.max(1, Math.floor(layout.gap / (series.length + 1)))
      : 0;
  const barWidth =
    series.length > 1
      ? Math.max(
          2,
          (layout.slotWidth - interBarGap * (series.length - 1)) /
            series.length,
        )
      : layout.slotWidth;
  const clusterWidth =
    series.length * barWidth + interBarGap * (series.length - 1);
  const clusterOffset = (layout.slotWidth - clusterWidth) / 2;

  const bars = series[0].values.flatMap((_, categoryIndex) =>
    series.map((seriesData, seriesIndex) => {
      const value = Math.max(0, seriesData.values[categoryIndex] ?? 0);
      const barHeight = (value / max) * layout.chartHeight;
      const barColor =
        series.length > 1 ? seriesColors[seriesIndex] : backgroundColor;
      return newElement({
        backgroundColor: barColor,
        ...commonProps,
        type: "rectangle",
        fillStyle: series.length > 1 ? "solid" : commonProps.fillStyle,
        strokeColor: series.length > 1 ? barColor : commonProps.strokeColor,
        x:
          x +
          categoryIndex * (layout.slotWidth + layout.gap) +
          layout.gap +
          clusterOffset +
          seriesIndex * (barWidth + interBarGap),
        y: y - barHeight - layout.gap,
        width: barWidth,
        height: barHeight,
      });
    }),
  );

  const baseElements = chartBaseElements(
    spreadsheet,
    x,
    y,
    backgroundColor,
    layout,
    max,
    isDevEnv(),
  );
  const xLabels = chartXLabels(spreadsheet, x, y, backgroundColor, layout);
  const xLabelsBottomY = Math.max(
    y + layout.gap / 2,
    ...xLabels.map((label) => getRotatedTextElementBottom(label)),
  );
  const { chartWidth } = getChartDimensions(spreadsheet, layout);
  const seriesLegend = createSeriesLegend(
    series,
    seriesColors,
    x + chartWidth / 2,
    xLabelsBottomY,
    y + layout.gap * 5,
    backgroundColor,
  );

  return [...baseElements, ...bars, ...seriesLegend];
};
