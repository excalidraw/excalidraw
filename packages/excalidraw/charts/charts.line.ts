import { pointFrom } from "@excalidraw/math";

import { isDevEnv } from "@excalidraw/common";

import { newElement, newLinearElement } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import { GRID_OPACITY, commonProps } from "./charts.constants";
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

export const renderLineChart = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  colorSeed?: number,
): ChartElements => {
  const series = spreadsheet.series;
  const layout = getCartesianChartLayout("line", series.length);
  const max = Math.max(1, ...series.flatMap((seriesData) => seriesData.values));
  const colorOffset = getColorOffset(colorSeed);
  const backgroundColor = getBackgroundColor(colorOffset);
  const seriesColors = getSeriesColors(series.length, colorOffset);

  const lines = series.map((seriesData, seriesIndex) => {
    const points = seriesData.values.map((value, valueIndex) =>
      pointFrom<LocalPoint>(
        valueIndex * (layout.slotWidth + layout.gap),
        -(value / max) * layout.chartHeight,
      ),
    );

    const maxX = Math.max(...points.map((point) => point[0]));
    const maxY = Math.max(...points.map((point) => point[1]));
    const minX = Math.min(...points.map((point) => point[0]));
    const minY = Math.min(...points.map((point) => point[1]));

    return newLinearElement({
      backgroundColor: "transparent",
      ...commonProps,
      type: "line",
      x: x + layout.gap + layout.slotWidth / 2,
      y: y - layout.gap,
      height: maxY - minY,
      width: maxX - minX,
      strokeColor: seriesColors[seriesIndex],
      strokeWidth: 2,
      points,
    });
  });

  const dots = series.flatMap((seriesData, seriesIndex) =>
    seriesData.values.map((value, valueIndex) => {
      const cx = valueIndex * (layout.slotWidth + layout.gap) + layout.gap / 2;
      const cy = -(value / max) * layout.chartHeight + layout.gap / 2;
      return newElement({
        backgroundColor: seriesColors[seriesIndex],
        ...commonProps,
        fillStyle: "solid",
        strokeColor: seriesColors[seriesIndex],
        strokeWidth: 2,
        type: "ellipse",
        x: x + cx + layout.slotWidth / 2,
        y: y + cy - layout.gap * 2,
        width: layout.gap,
        height: layout.gap,
      });
    }),
  );

  const guideValues = series[0].values.map((_, valueIndex) =>
    Math.max(
      0,
      ...series.map((seriesData) => seriesData.values[valueIndex] ?? 0),
    ),
  );
  const guides = guideValues.map((value, valueIndex) => {
    const cx = valueIndex * (layout.slotWidth + layout.gap) + layout.gap / 2;
    const cy = (value / max) * layout.chartHeight + layout.gap / 2 + layout.gap;
    return newLinearElement({
      backgroundColor,
      ...commonProps,
      type: "line",
      x: x + cx + layout.slotWidth / 2 + layout.gap / 2,
      y: y - cy,
      height: cy,
      strokeStyle: "dotted",
      opacity: GRID_OPACITY,
      points: [pointFrom(0, 0), pointFrom(0, cy)],
    });
  });

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

  return [...baseElements, ...lines, ...guides, ...dots, ...seriesLegend];
};
