import { pointFrom } from "@excalidraw/math";

import {
  DEFAULT_CHART_COLOR_INDEX,
  FONT_FAMILY,
  FONT_SIZES,
  ROUNDNESS,
  DEFAULT_FONT_SIZE,
  getAllColorsSpecificShade,
  getFontString,
  getLineHeight,
  ROUGHNESS,
  COLOR_CHARCOAL_BLACK,
} from "@excalidraw/common";

import {
  getApproxMinLineWidth,
  measureText,
  newElement,
  newLinearElement,
  newTextElement,
  wrapText,
} from "@excalidraw/element";

import type {
  ChartType,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  BAR_GAP,
  CARTESIAN_BAR_HEIGHT,
  CARTESIAN_BASE_SLOT_WIDTH,
  CARTESIAN_BAR_SLOT_EXTRA_MAX,
  CARTESIAN_BAR_SLOT_EXTRA_PER_SERIES,
  CARTESIAN_GAP,
  CARTESIAN_LABEL_AXIS_CLEARANCE,
  CARTESIAN_LABEL_MAX_WIDTH_BUFFER,
  CARTESIAN_LABEL_MIN_WIDTH,
  CARTESIAN_LABEL_OVERFLOW_PREFERENCE_BUFFER,
  CARTESIAN_LABEL_ROTATED_WIDTH_BUFFER,
  CARTESIAN_LABEL_ROTATION,
  CARTESIAN_LABEL_SLOT_PADDING,
  CARTESIAN_LINE_HEIGHT,
  CARTESIAN_LINE_SLOT_WIDTH,
  GRID_OPACITY,
  RADAR_AXIS_LABEL_ALIGNMENT_THRESHOLD,
  RADAR_AXIS_LABEL_CLEARANCE,
  RADAR_AXIS_LABEL_MAX_WIDTH,
  RADAR_LABEL_OFFSET,
  RADAR_LEGEND_ITEM_GAP,
  RADAR_LEGEND_SWATCH_SIZE,
  RADAR_LEGEND_TEXT_GAP,
  RADAR_PADDING,
  RADAR_SINGLE_SERIES_LOG_SCALE_THRESHOLD,
  BAR_HEIGHT,
  commonProps,
  type CartesianChartLayout,
  type CartesianChartType,
} from "./charts.constants";

import type {
  ChartElements,
  Spreadsheet,
  SpreadsheetSeries,
} from "./charts.types";

const bgColors = getAllColorsSpecificShade(DEFAULT_CHART_COLOR_INDEX);

const getSpreadsheetDimensionCount = (spreadsheet: Spreadsheet) =>
  spreadsheet.labels?.length ?? spreadsheet.series[0]?.values.length ?? 0;

export const isSpreadsheetValidForChartType = (
  spreadsheet: Spreadsheet | null,
  chartType: ChartType,
) => {
  if (!spreadsheet) {
    return false;
  }

  const dimensionCount = getSpreadsheetDimensionCount(spreadsheet);
  if (dimensionCount < 2) {
    return false;
  }

  if (chartType === "radar") {
    return dimensionCount >= 3;
  }

  return true;
};

const getSeriesAwareSlotWidth = (
  baseSlotWidth: number,
  seriesCount: number,
) => {
  const extraSlotWidth =
    seriesCount <= 1
      ? 0
      : Math.min(
          CARTESIAN_BAR_SLOT_EXTRA_MAX,
          (seriesCount - 1) * CARTESIAN_BAR_SLOT_EXTRA_PER_SERIES,
        );
  return baseSlotWidth + extraSlotWidth;
};

export const getCartesianChartLayout = (
  chartType: CartesianChartType,
  seriesCount: number,
): CartesianChartLayout => {
  if (chartType === "line") {
    const slotWidth = getSeriesAwareSlotWidth(
      CARTESIAN_LINE_SLOT_WIDTH,
      seriesCount,
    );
    return {
      slotWidth,
      gap: CARTESIAN_GAP,
      chartHeight: CARTESIAN_LINE_HEIGHT,
      xLabelMaxWidth:
        slotWidth + CARTESIAN_GAP * 3 + CARTESIAN_LABEL_MAX_WIDTH_BUFFER,
    };
  }

  const slotWidth = getSeriesAwareSlotWidth(
    CARTESIAN_BASE_SLOT_WIDTH,
    seriesCount,
  );
  return {
    slotWidth,
    gap: CARTESIAN_GAP,
    chartHeight: CARTESIAN_BAR_HEIGHT,
    xLabelMaxWidth:
      slotWidth + CARTESIAN_GAP * 3 + CARTESIAN_LABEL_MAX_WIDTH_BUFFER,
  };
};

export const getChartDimensions = (
  spreadsheet: Spreadsheet,
  layout: CartesianChartLayout,
) => {
  const chartWidth =
    (layout.slotWidth + layout.gap) * spreadsheet.series[0].values.length +
    layout.gap;
  const chartHeight = layout.chartHeight + layout.gap * 2;
  return { chartWidth, chartHeight };
};

export const getRadarDimensions = () => {
  const chartWidth = BAR_HEIGHT + RADAR_PADDING * 2;
  const chartHeight = BAR_HEIGHT + RADAR_PADDING * 2;
  return { chartWidth, chartHeight };
};

const getCircularDistance = (
  firstIndex: number,
  secondIndex: number,
  paletteSize: number,
) => {
  const absoluteDistance = Math.abs(firstIndex - secondIndex);
  return Math.min(absoluteDistance, paletteSize - absoluteDistance);
};

export const getSeriesColors = (
  seriesCount: number,
  colorOffset: number,
): readonly string[] => {
  if (seriesCount <= 0 || bgColors.length === 0) {
    return [];
  }

  const paletteSize = bgColors.length;
  const startIndex = ((colorOffset % paletteSize) + paletteSize) % paletteSize;
  const selectedIndices = [startIndex];
  const maxUniqueColors = Math.min(seriesCount, paletteSize);
  const availableIndices = new Set(
    Array.from({ length: paletteSize }, (_, index) => index).filter(
      (index) => index !== startIndex,
    ),
  );

  while (selectedIndices.length < maxUniqueColors) {
    let bestIndex = -1;
    let bestMinDistance = -1;
    let bestAverageDistance = -1;

    for (const candidateIndex of availableIndices) {
      const distances = selectedIndices.map((selectedIndex) =>
        getCircularDistance(candidateIndex, selectedIndex, paletteSize),
      );
      const minDistance = Math.min(...distances);
      const averageDistance =
        distances.reduce((total, distance) => total + distance, 0) /
        distances.length;

      if (
        minDistance > bestMinDistance ||
        (minDistance === bestMinDistance &&
          averageDistance > bestAverageDistance)
      ) {
        bestIndex = candidateIndex;
        bestMinDistance = minDistance;
        bestAverageDistance = averageDistance;
      }
    }

    selectedIndices.push(bestIndex);
    availableIndices.delete(bestIndex);
  }

  return Array.from(
    { length: seriesCount },
    (_, index) => bgColors[selectedIndices[index % selectedIndices.length]],
  );
};

export const getColorOffset = (colorSeed?: number) => {
  if (bgColors.length === 0) {
    return 0;
  }

  if (typeof colorSeed !== "number" || !Number.isFinite(colorSeed)) {
    return Math.floor(Math.random() * bgColors.length);
  }

  const seedText = colorSeed.toString();
  let hash = 0;
  for (let index = 0; index < seedText.length; index++) {
    hash = (hash * 31 + seedText.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % bgColors.length;
};

export const getBackgroundColor = (colorOffset: number) =>
  bgColors[colorOffset];

export const getRadarValueScale = (
  series: SpreadsheetSeries[],
  _labelsLength: number,
) => {
  const allValues = series.flatMap((s) =>
    s.values.map((value) => Math.max(0, value)),
  );
  const positiveValues = allValues.filter((value) => value > 0);
  const max = Math.max(1, ...allValues);
  const minPositive =
    positiveValues.length > 0 ? Math.min(...positiveValues) : 1;
  const useLogScale =
    series.length === 1 &&
    minPositive > 0 &&
    max / minPositive >= RADAR_SINGLE_SERIES_LOG_SCALE_THRESHOLD;

  return {
    renderSteps: false,
    normalize: (value: number, _axisIndex: number) => {
      const safeValue = Math.max(0, value);
      return useLogScale
        ? Math.log10(safeValue + 1) / Math.log10(max + 1)
        : safeValue / max;
    },
  };
};

const shouldWrapRadarText = (text: string) => /\s/.test(text.trim());

export const getRadarDisplayText = (
  text: string,
  fontString: ReturnType<typeof getFontString>,
  maxWidth: number,
) => {
  return shouldWrapRadarText(text)
    ? wrapText(text, fontString, maxWidth)
    : text;
};

export const createRadarAxisLabels = (
  labels: readonly string[],
  angles: readonly number[],
  centerX: number,
  centerY: number,
  radius: number,
  backgroundColor: string,
): {
  axisLabels: ChartElements;
  axisLabelTopY: number;
  axisLabelBottomY: number;
} => {
  const fontFamily = FONT_FAMILY.Excalifont;
  const fontSize = FONT_SIZES.sm;
  const lineHeight = getLineHeight(fontFamily);
  const fontString = getFontString({ fontFamily, fontSize });
  const baseLabelWidth = Math.min(
    RADAR_AXIS_LABEL_MAX_WIDTH,
    radius * (labels.length > 8 ? 0.56 : 0.72),
  );
  const minLabelWidth = getApproxMinLineWidth(fontString, lineHeight);

  const axisLabels = labels.map((label, index) => {
    const angle = angles[index];
    const longestWordWidth = Math.max(
      0,
      ...label
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => measureText(word, fontString, lineHeight).width),
    );
    const maxLabelWidth = Math.max(
      minLabelWidth,
      baseLabelWidth,
      longestWordWidth,
    );
    const displayLabel = getRadarDisplayText(label, fontString, maxLabelWidth);
    const metrics = measureText(displayLabel, fontString, lineHeight);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const textAlign: "left" | "center" | "right" =
      cos > RADAR_AXIS_LABEL_ALIGNMENT_THRESHOLD
        ? "left"
        : cos < -RADAR_AXIS_LABEL_ALIGNMENT_THRESHOLD
        ? "right"
        : "center";

    // Keep labels outside the radar ring by projecting text extents
    // onto the axis direction.
    const centerAlignedXExtent = textAlign === "center" ? metrics.width / 2 : 0;
    const projectedExtent =
      Math.abs(cos) * centerAlignedXExtent +
      Math.abs(sin) * (metrics.height / 2);
    const radialOffset =
      RADAR_LABEL_OFFSET + projectedExtent + RADAR_AXIS_LABEL_CLEARANCE;
    const anchorX = centerX + cos * (radius + radialOffset);
    const anchorY = centerY + sin * (radius + radialOffset);

    const yNudge =
      sin > RADAR_AXIS_LABEL_ALIGNMENT_THRESHOLD
        ? BAR_GAP / 3
        : sin < -RADAR_AXIS_LABEL_ALIGNMENT_THRESHOLD
        ? -BAR_GAP / 3
        : 0;

    return newTextElement({
      backgroundColor,
      ...commonProps,
      text: displayLabel,
      originalText: label,
      x: anchorX,
      y: anchorY + yNudge,
      fontFamily,
      fontSize,
      lineHeight,
      textAlign,
      verticalAlign: "middle",
    });
  });

  const axisLabelTopY = Math.min(...axisLabels.map((axisLabel) => axisLabel.y));
  const axisLabelBottomY = Math.max(
    ...axisLabels.map((axisLabel) => axisLabel.y + axisLabel.height),
  );
  return { axisLabels, axisLabelTopY, axisLabelBottomY };
};

export const createSeriesLegend = (
  series: SpreadsheetSeries[],
  seriesColors: readonly string[],
  centerX: number,
  minLegendTopY: number,
  fallbackLegendY: number,
  backgroundColor: string,
): ChartElements => {
  if (series.length <= 1) {
    return [];
  }

  const fontFamily = FONT_FAMILY["Lilita One"];
  const fontSize = FONT_SIZES.lg;
  const lineHeight = getLineHeight(fontFamily);
  const fontString = getFontString({ fontFamily, fontSize });
  const legendItems = series.map((seriesItem, index) => {
    const label = seriesItem.title?.trim() || `Series ${index + 1}`;
    const displayLabel = getRadarDisplayText(label, fontString, BAR_HEIGHT);
    const metrics = measureText(displayLabel, fontString, lineHeight);
    const itemWidth =
      RADAR_LEGEND_SWATCH_SIZE + RADAR_LEGEND_TEXT_GAP + metrics.width;
    return {
      label,
      displayLabel,
      color: seriesColors[index],
      width: itemWidth,
      height: metrics.height,
    };
  });
  const maxLegendHalfHeight = Math.max(
    RADAR_LEGEND_SWATCH_SIZE / 2,
    ...legendItems.map((item) => item.height / 2),
  );
  const legendY = Math.max(
    fallbackLegendY,
    minLegendTopY + maxLegendHalfHeight + RADAR_LABEL_OFFSET,
  );

  const pillPaddingX = RADAR_LEGEND_ITEM_GAP;
  const pillPaddingY = RADAR_LEGEND_SWATCH_SIZE * 0.6;
  const totalLegendWidth =
    legendItems.reduce((total, item) => total + item.width, 0) +
    RADAR_LEGEND_ITEM_GAP * Math.max(0, legendItems.length - 1);
  const pillWidth = totalLegendWidth + pillPaddingX * 2;
  const pillHeight = maxLegendHalfHeight * 2 + pillPaddingY * 2;

  const legendElements: NonDeletedExcalidrawElement[] = [];

  // rounded pill background
  legendElements.push(
    newElement({
      ...commonProps,
      backgroundColor: "transparent",
      type: "rectangle",
      fillStyle: "solid",
      strokeColor: COLOR_CHARCOAL_BLACK,
      x: centerX - pillWidth / 2,
      y: legendY - pillHeight / 2,
      width: pillWidth,
      height: pillHeight,
      roughness: ROUGHNESS.architect,
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    }),
  );

  let cursorX = centerX - totalLegendWidth / 2;

  legendItems.forEach((item) => {
    // solid filled swatch
    legendElements.push(
      newElement({
        ...commonProps,
        backgroundColor: item.color,
        type: "rectangle",
        x: cursorX,
        y: legendY - RADAR_LEGEND_SWATCH_SIZE / 2,
        width: RADAR_LEGEND_SWATCH_SIZE,
        height: RADAR_LEGEND_SWATCH_SIZE,
        fillStyle: "solid",
        strokeColor: item.color,
        roughness: ROUGHNESS.architect,
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      }),
    );

    // label in default (black) color
    legendElements.push(
      newTextElement({
        ...commonProps,
        text: item.displayLabel,
        originalText: item.label,
        autoResize: false,
        x: cursorX + RADAR_LEGEND_SWATCH_SIZE + RADAR_LEGEND_TEXT_GAP,
        y: legendY,
        fontFamily,
        fontSize,
        lineHeight,
        textAlign: "left",
        verticalAlign: "middle",
      }),
    );

    cursorX += item.width + RADAR_LEGEND_ITEM_GAP;
  });

  return legendElements;
};

const ellipsifyTextToWidth = (
  text: string,
  maxWidth: number,
  fontString: ReturnType<typeof getFontString>,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  if (measureText(text, fontString, lineHeight).width <= maxWidth) {
    return text;
  }

  let end = text.length;
  while (end > 1) {
    const candidate = `${text.slice(0, end)}...`;
    if (measureText(candidate, fontString, lineHeight).width <= maxWidth) {
      return candidate;
    }
    end--;
  }

  return text[0] ? `${text[0]}...` : text;
};

const wrapOrEllipsifyTextToWidth = (
  text: string,
  maxWidth: number,
  fontString: ReturnType<typeof getFontString>,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  if (measureText(text, fontString, lineHeight).width <= maxWidth) {
    return { wrapped: false, text };
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const hasLongWord = words.some((word) => {
      return measureText(word, fontString, lineHeight).width > maxWidth;
    });
    if (
      !hasLongWord &&
      maxWidth >= getApproxMinLineWidth(fontString, lineHeight)
    ) {
      return { wrapped: true, text: wrapText(text, fontString, maxWidth) };
    }
  }

  return {
    wrapped: false,
    text: ellipsifyTextToWidth(text, maxWidth, fontString, lineHeight),
  };
};

const getRotatedBoundingBox = (
  width: number,
  height: number,
  angle: number,
) => {
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
};

type CartesianAxisLabelSpec = {
  originalText: string;
  text: string;
  wrapped: boolean;
  metrics: ReturnType<typeof measureText>;
  rotatedWidth: number;
  rotatedHeight: number;
};

const isEllipsifiedLabel = (text: string) => text.includes("...");

const getCartesianAxisLabelSpec = (
  label: string,
  maxLabelWidth: number,
  maxRotatedWidth: number,
  fontString: ReturnType<typeof getFontString>,
  lineHeight: ExcalidrawTextElement["lineHeight"],
): CartesianAxisLabelSpec => {
  const minWidth = Math.max(
    CARTESIAN_LABEL_MIN_WIDTH,
    Math.ceil(getApproxMinLineWidth(fontString, lineHeight)),
  );
  const maxWidth = Math.max(minWidth, Math.floor(maxLabelWidth));
  const candidateWidths: number[] = [];
  for (let width = maxWidth; width >= minWidth; width -= 4) {
    candidateWidths.push(width);
  }
  if (candidateWidths[candidateWidths.length - 1] !== minWidth) {
    candidateWidths.push(minWidth);
  }

  const getRank = (spec: CartesianAxisLabelSpec) => {
    const ellipsified = isEllipsifiedLabel(spec.text);
    const visibleChars = spec.text
      .replace(/\.\.\./g, "")
      .replace(/\n/g, "").length;
    const lineCount = spec.text.split("\n").length;
    return {
      ellipsified,
      visibleChars,
      lineCount,
    };
  };

  const shouldPrefer = (
    candidate: CartesianAxisLabelSpec,
    current: CartesianAxisLabelSpec,
  ) => {
    const candidateRank = getRank(candidate);
    const currentRank = getRank(current);
    if (candidateRank.ellipsified !== currentRank.ellipsified) {
      return !candidateRank.ellipsified;
    }
    if (candidateRank.visibleChars !== currentRank.visibleChars) {
      return candidateRank.visibleChars > currentRank.visibleChars;
    }
    if (candidateRank.lineCount !== currentRank.lineCount) {
      return candidateRank.lineCount < currentRank.lineCount;
    }
    return candidate.rotatedHeight < current.rotatedHeight;
  };

  let bestFit: CartesianAxisLabelSpec | null = null;
  let bestOverflowAny: {
    overflow: number;
    spec: CartesianAxisLabelSpec;
  } | null = null;
  let bestOverflowNonEllipsified: {
    overflow: number;
    spec: CartesianAxisLabelSpec;
  } | null = null;

  for (const width of candidateWidths) {
    const { wrapped, text } = wrapOrEllipsifyTextToWidth(
      label,
      width,
      fontString,
      lineHeight,
    );
    const metrics = measureText(text, fontString, lineHeight);
    const rotated = getRotatedBoundingBox(
      metrics.width,
      metrics.height,
      CARTESIAN_LABEL_ROTATION,
    );
    const spec = {
      originalText: label,
      text,
      metrics,
      rotatedWidth: rotated.width,
      rotatedHeight: rotated.height,
      wrapped,
    };
    const overflow = rotated.width - maxRotatedWidth;
    if (overflow <= 0) {
      if (!bestFit || shouldPrefer(spec, bestFit)) {
        bestFit = spec;
      }
      continue;
    }
    if (
      !bestOverflowAny ||
      overflow < bestOverflowAny.overflow ||
      (overflow === bestOverflowAny.overflow &&
        shouldPrefer(spec, bestOverflowAny.spec))
    ) {
      bestOverflowAny = { overflow, spec };
    }
    if (
      !isEllipsifiedLabel(spec.text) &&
      (!bestOverflowNonEllipsified ||
        overflow < bestOverflowNonEllipsified.overflow ||
        (overflow === bestOverflowNonEllipsified.overflow &&
          shouldPrefer(spec, bestOverflowNonEllipsified.spec)))
    ) {
      bestOverflowNonEllipsified = { overflow, spec };
    }
  }

  if (bestFit) {
    return bestFit;
  }

  if (
    bestOverflowNonEllipsified &&
    bestOverflowAny &&
    bestOverflowNonEllipsified.overflow <=
      bestOverflowAny.overflow + CARTESIAN_LABEL_OVERFLOW_PREFERENCE_BUFFER
  ) {
    return bestOverflowNonEllipsified.spec;
  }

  return bestOverflowAny!.spec;
};

export const getRotatedTextElementBottom = (
  element: NonDeletedExcalidrawElement,
) => {
  if (element.type !== "text") {
    return element.y + element.height;
  }
  const rotated = getRotatedBoundingBox(
    element.width,
    element.height,
    element.angle,
  );
  return element.y + element.height / 2 + rotated.height / 2;
};

export const chartXLabels = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  backgroundColor: string,
  layout: CartesianChartLayout,
): ChartElements => {
  const fontFamily = commonProps.fontFamily;
  const fontSize = FONT_SIZES.sm;
  const lineHeight = getLineHeight(fontFamily);
  const fontString = getFontString({ fontFamily, fontSize });
  const maxRotatedWidth = Math.max(
    1,
    layout.slotWidth +
      layout.gap -
      CARTESIAN_LABEL_SLOT_PADDING * 2 +
      CARTESIAN_LABEL_ROTATED_WIDTH_BUFFER,
  );
  const axisY = y;

  return (
    spreadsheet.labels?.map((label, index) => {
      const labelSpec = getCartesianAxisLabelSpec(
        label,
        layout.xLabelMaxWidth,
        maxRotatedWidth,
        fontString,
        lineHeight,
      );
      const centerX =
        x +
        index * (layout.slotWidth + layout.gap) +
        layout.gap +
        layout.slotWidth / 2;
      const labelY =
        axisY +
        CARTESIAN_LABEL_AXIS_CLEARANCE +
        (labelSpec.rotatedHeight - labelSpec.metrics.height) / 2;

      return newTextElement({
        backgroundColor,
        ...commonProps,
        text: labelSpec.text,
        originalText: labelSpec.wrapped ? label : labelSpec.text,
        autoResize: !labelSpec.wrapped,
        x: centerX,
        y: labelY,
        angle: CARTESIAN_LABEL_ROTATION,
        fontSize,
        lineHeight,
        textAlign: "center",
        verticalAlign: "top",
      });
    }) || []
  );
};

const chartYLabels = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  backgroundColor: string,
  layout: CartesianChartLayout,
  maxValue = Math.max(...spreadsheet.series[0].values),
): ChartElements => {
  const minYLabel = newTextElement({
    backgroundColor,
    ...commonProps,
    x: x - layout.gap,
    y: y - layout.gap,
    text: "0",
    textAlign: "right",
  });

  const maxYLabel = newTextElement({
    backgroundColor,
    ...commonProps,
    x: x - layout.gap,
    y: y - layout.chartHeight - minYLabel.height / 2,
    text: maxValue.toLocaleString(),
    textAlign: "right",
  });

  return [minYLabel, maxYLabel];
};

const chartLines = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  backgroundColor: string,
  layout: CartesianChartLayout,
): ChartElements => {
  const { chartWidth, chartHeight } = getChartDimensions(spreadsheet, layout);
  const xLine = newLinearElement({
    backgroundColor,
    ...commonProps,
    type: "line",
    x,
    y,
    width: chartWidth,
    points: [pointFrom(0, 0), pointFrom(chartWidth, 0)],
  });

  const yLine = newLinearElement({
    backgroundColor,
    ...commonProps,
    type: "line",
    x,
    y,
    height: chartHeight,
    points: [pointFrom(0, 0), pointFrom(0, -chartHeight)],
  });

  const maxLine = newLinearElement({
    backgroundColor,
    ...commonProps,
    type: "line",
    x,
    y: y - layout.chartHeight - layout.gap,
    strokeStyle: "dotted",
    width: chartWidth,
    opacity: GRID_OPACITY,
    points: [pointFrom(0, 0), pointFrom(chartWidth, 0)],
  });

  return [xLine, yLine, maxLine];
};

// For the maths behind it https://excalidraw.com/#json=6320864370884608,O_5xfD-Agh32tytHpRJx1g
export const chartBaseElements = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  backgroundColor: string,
  layout: CartesianChartLayout,
  maxValue = Math.max(...spreadsheet.series[0].values),
  debug?: boolean,
): ChartElements => {
  const { chartWidth, chartHeight } = getChartDimensions(spreadsheet, layout);

  const title = spreadsheet.title
    ? newTextElement({
        backgroundColor,
        ...commonProps,
        text: spreadsheet.title,
        x: x + chartWidth / 2,
        y: y - layout.chartHeight - layout.gap * 2 - DEFAULT_FONT_SIZE,
        roundness: null,
        textAlign: "center",
        fontSize: FONT_SIZES.xl,
        fontFamily: FONT_FAMILY["Lilita One"],
      })
    : null;

  const debugRect = debug
    ? newElement({
        backgroundColor,
        ...commonProps,
        type: "rectangle",
        x,
        y: y - chartHeight,
        width: chartWidth,
        height: chartHeight,
        strokeColor: COLOR_CHARCOAL_BLACK,
        fillStyle: "solid",
        opacity: 6,
      })
    : null;

  return [
    ...(debugRect ? [debugRect] : []),
    ...(title ? [title] : []),
    ...chartXLabels(spreadsheet, x, y, backgroundColor, layout),
    ...chartYLabels(spreadsheet, x, y, backgroundColor, layout, maxValue),
    ...chartLines(spreadsheet, x, y, backgroundColor, layout),
  ];
};
