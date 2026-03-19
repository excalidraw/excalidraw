import { pointFrom } from "@excalidraw/math";

import {
  FONT_FAMILY,
  FONT_SIZES,
  getFontString,
  getLineHeight,
  ROUGHNESS,
} from "@excalidraw/common";

import {
  measureText,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import {
  BAR_GAP,
  BAR_HEIGHT,
  GRID_OPACITY,
  RADAR_GRID_LEVELS,
  RADAR_LABEL_OFFSET,
  commonProps,
} from "./charts.constants";
import {
  createRadarAxisLabels,
  createSeriesLegend,
  getBackgroundColor,
  getColorOffset,
  getRadarDimensions,
  getRadarDisplayText,
  getRadarValueScale,
  getSeriesColors,
  isSpreadsheetValidForChartType,
} from "./charts.helpers";

import type { ChartElements, Spreadsheet } from "./charts.types";

export const renderRadarChart = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  colorSeed?: number,
): ChartElements | null => {
  if (!isSpreadsheetValidForChartType(spreadsheet, "radar")) {
    return null;
  }

  const labels =
    spreadsheet.labels ??
    spreadsheet.series[0].values.map((_, index) => `Value ${index + 1}`);

  const series = spreadsheet.series;
  const { normalize, renderSteps } = getRadarValueScale(series, labels.length);
  const colorOffset = getColorOffset(colorSeed);
  const backgroundColor = getBackgroundColor(colorOffset);
  const seriesColors = getSeriesColors(series.length, colorOffset);
  const { chartWidth, chartHeight } = getRadarDimensions();
  const centerX = x + chartWidth / 2;
  const centerY = y - chartHeight / 2;
  const radius = BAR_HEIGHT / 2;
  const angles = labels.map(
    (_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / labels.length,
  );

  const { axisLabels, axisLabelTopY, axisLabelBottomY } = createRadarAxisLabels(
    labels,
    angles,
    centerX,
    centerY,
    radius,
    backgroundColor,
  );

  const titleFontFamily = FONT_FAMILY["Lilita One"];
  const titleFontSize = FONT_SIZES.xl;
  const titleLineHeight = getLineHeight(titleFontFamily);
  const titleFontString = getFontString({
    fontFamily: titleFontFamily,
    fontSize: titleFontSize,
  });
  const titleText = spreadsheet.title
    ? getRadarDisplayText(
        spreadsheet.title,
        titleFontString,
        chartWidth + RADAR_LABEL_OFFSET * 2,
      )
    : null;
  const titleTextMetrics = titleText
    ? measureText(titleText, titleFontString, titleLineHeight)
    : null;
  const title = titleText
    ? newTextElement({
        backgroundColor,
        ...commonProps,
        text: titleText,
        originalText: spreadsheet.title ?? titleText,
        x: x + chartWidth / 2,
        y: axisLabelTopY - RADAR_LABEL_OFFSET - titleTextMetrics!.height / 2,
        fontFamily: titleFontFamily,
        fontSize: titleFontSize,
        lineHeight: titleLineHeight,
        textAlign: "center",
      })
    : null;

  const radarGridLines = renderSteps
    ? Array.from({ length: RADAR_GRID_LEVELS }, (_, levelIndex) => {
        const levelRatio = (levelIndex + 1) / RADAR_GRID_LEVELS;
        const levelRadius = radius * levelRatio;
        const points = angles.map((angle) =>
          pointFrom<LocalPoint>(
            Math.cos(angle) * levelRadius,
            Math.sin(angle) * levelRadius,
          ),
        );
        points.push(pointFrom(points[0][0], points[0][1]));

        return newLinearElement({
          backgroundColor: "transparent",
          ...commonProps,
          type: "line",
          x: centerX,
          y: centerY,
          width: levelRadius * 2,
          height: levelRadius * 2,
          strokeStyle: "solid",
          roughness: ROUGHNESS.architect,
          opacity: GRID_OPACITY,
          polygon: true,
          points,
        });
      })
    : [];

  const spokes = angles.map((angle) => {
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    return newLinearElement({
      backgroundColor: "transparent",
      ...commonProps,
      type: "line",
      x: centerX,
      y: centerY,
      width: Math.abs(px),
      height: Math.abs(py),
      strokeStyle: "solid",
      roughness: ROUGHNESS.architect,
      opacity: GRID_OPACITY,
      points: [pointFrom(0, 0), pointFrom(px, py)],
    });
  });

  const seriesPolygons = series.map((seriesData, index) => {
    const points = angles.map((angle, axisIndex) => {
      const value = seriesData.values[axisIndex] ?? 0;
      const pointRadius = normalize(value, axisIndex) * radius;
      return pointFrom<LocalPoint>(
        Math.cos(angle) * pointRadius,
        Math.sin(angle) * pointRadius,
      );
    });
    points.push(pointFrom(points[0][0], points[0][1]));

    return newLinearElement({
      backgroundColor: "transparent",
      ...commonProps,
      type: "line",
      x: centerX,
      y: centerY,
      width: radius * 2,
      height: radius * 2,
      strokeColor: seriesColors[index],
      strokeWidth: 2,
      polygon: true,
      points,
    });
  });

  const seriesLegend = createSeriesLegend(
    series,
    seriesColors,
    centerX,
    axisLabelBottomY,
    y + BAR_GAP * 5,
    backgroundColor,
  );

  return [
    ...(title ? [title] : []),
    ...axisLabels,
    ...radarGridLines,
    ...spokes,
    ...seriesPolygons,
    ...seriesLegend,
  ];
};
