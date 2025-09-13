import { pointFrom } from "@excalidraw/math";

import {
  COLOR_PALETTE,
  DEFAULT_CHART_COLOR_INDEX,
  getAllColorsSpecificShade,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  VERTICAL_ALIGN,
  randomId,
  isDevEnv,
} from "@excalidraw/common";

import {
  newTextElement,
  newLinearElement,
  newElement,
} from "@excalidraw/element";

import type { Radians } from "@excalidraw/math";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

export type ChartElements = readonly NonDeletedExcalidrawElement[];

const BAR_WIDTH = 32;
const BAR_GAP = 12;
const BAR_HEIGHT = 256;
const GRID_OPACITY = 50;

export interface Spreadsheet {
  title: string | null;
  labels: string[] | null;
  // Support multiple series: each series has an optional name and an array of
  // numeric values (one value per label/row).
  series: { name: string | null; values: number[] }[];
}

export const NOT_SPREADSHEET = "NOT_SPREADSHEET";
export const VALID_SPREADSHEET = "VALID_SPREADSHEET";

type ParseSpreadsheetResult =
  | { type: typeof NOT_SPREADSHEET; reason: string }
  | { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet };

/**
 * @private exported for testing
 */
export const tryParseNumber = (s: string): number | null => {
  const match = /^([-+]?)[$€£¥₩]?([-+]?)([\d.,]+)[%]?$/.exec(s);
  if (!match) {
    return null;
  }
  return parseFloat(`${(match[1] || match[2]) + match[3]}`.replace(/,/g, ""));
};

const isNumericColumn = (lines: string[][], columnIndex: number) =>
  lines.slice(1).every((line) => tryParseNumber(line[columnIndex]) !== null);

/**
 * @private exported for testing
 */
export const tryParseCells = (cells: string[][]): ParseSpreadsheetResult => {
  const numCols = cells[0].length;

  if (numCols === 1) {
    if (!isNumericColumn(cells, 0)) {
      return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
    }

    const hasHeader = tryParseNumber(cells[0][0]) === null;
    const rows = hasHeader ? cells.slice(1) : cells;

    if (rows.length < 2) {
      return { type: NOT_SPREADSHEET, reason: "Less than two rows" };
    }

    return {
      type: VALID_SPREADSHEET,
      spreadsheet: {
        title: hasHeader ? cells[0][0] : null,
        labels: null,
        series: [
          { name: hasHeader ? cells[0][0] : null, values: rows.map((r) => tryParseNumber(r[0])!) },
        ],
      },
    };
  }

  // For multi-column input, detect numeric columns
  const numericCols = new Array<boolean>(numCols).fill(false).map((_, i) =>
    isNumericColumn(cells, i),
  );

  // If first column is non-numeric and there's at least one numeric column,
  // treat the first column as labels and the rest as series.
  if (!numericCols[0] && numericCols.some(Boolean)) {
    const firstNumericIndex = numericCols.findIndex(Boolean);
    const hasHeader = tryParseNumber(cells[0][firstNumericIndex]) === null;
    const rows = hasHeader ? cells.slice(1) : cells;

    if (rows.length < 2) {
      return { type: NOT_SPREADSHEET, reason: "Less than 2 rows" };
    }

    // labels come from the first column
    const labels = rows.map((row) => row[0]);

    const series: { name: string | null; values: number[] }[] = [];
    for (let col = 1; col < numCols; col++) {
      if (!numericCols[col]) {
        return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
      }
      const name = hasHeader ? cells[0][col] : null;
      const values = rows.map((row) => tryParseNumber(row[col]));
      if (values.some((v) => v === null)) {
        return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
      }
      series.push({ name, values: values as number[] });
    }

    const combinedTitle = hasHeader
      ? series
          .map((s) => s.name ?? "")
          .filter((n) => n.trim().length > 0)
          .join(", ") || null
      : null;

    return {
      type: VALID_SPREADSHEET,
      spreadsheet: {
        title: combinedTitle,
        labels,
        series,
      },
    };
  }

  // Otherwise expect all columns to be numeric (multiple series, no labels)
  if (!numericCols.some(Boolean)) {
    return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
  }

  const firstNumericIndex = numericCols.findIndex(Boolean);
  const hasHeader = tryParseNumber(cells[0][firstNumericIndex]) === null;
  const rows = hasHeader ? cells.slice(1) : cells;

  if (rows.length < 2) {
    return { type: NOT_SPREADSHEET, reason: "Less than 2 rows" };
  }

  const series: { name: string | null; values: number[] }[] = [];
  for (let col = 0; col < numCols; col++) {
    if (!numericCols[col]) {
      return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
    }
    const name = hasHeader ? cells[0][col] : null;
    const values = rows.map((row) => tryParseNumber(row[col]));
    if (values.some((v) => v === null)) {
      return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
    }
    series.push({ name, values: values as number[] });
  }

  const combinedTitle = hasHeader
    ? series
        .map((s) => s.name ?? "")
        .filter((n) => n.trim().length > 0)
        .join(", ") || null
    : null;

  return {
    type: VALID_SPREADSHEET,
    spreadsheet: {
      title: combinedTitle,
      labels: null,
      series,
    },
  };
};
const transposeCells = (cells: string[][]) => {
  const nextCells: string[][] = [];
  for (let col = 0; col < cells[0].length; col++) {
    const nextCellRow: string[] = [];
    for (let row = 0; row < cells.length; row++) {
      nextCellRow.push(cells[row][col]);
    }
    nextCells.push(nextCellRow);
  }
  return nextCells;
};

export const tryParseSpreadsheet = (text: string): ParseSpreadsheetResult => {
  // Copy/paste from excel, spreadsheets, tsv, csv.
  // Accept any number of columns. Try common delimiters (tab, comma, semicolon)
  // and pick the one that yields a consistent column count across rows.

  const rawLines = text.trim().split("\n").map((l) => l.trim());
  if (rawLines.length === 0 || (rawLines.length === 1 && rawLines[0] === "")) {
    return { type: NOT_SPREADSHEET, reason: "No values" };
  }

  const delimiters = ["\t", ",", ";"];
  let lines: string[][] | null = null;

  for (const delim of delimiters) {
    const candidate = rawLines.map((line) => line.split(delim));
    const numColsFirstLine = candidate[0].length;
    const isSpreadsheet = candidate.every((line) => line.length === numColsFirstLine);
    if (isSpreadsheet && numColsFirstLine > 0) {
      lines = candidate;
      break;
    }
  }

  if (!lines) {
    return {
      type: NOT_SPREADSHEET,
      reason: "All rows don't have same number of columns",
    };
  }

  const result = tryParseCells(lines);
  if (result.type !== VALID_SPREADSHEET) {
    const transposedResults = tryParseCells(transposeCells(lines));
    if (transposedResults.type === VALID_SPREADSHEET) {
      return transposedResults;
    }
  }
  return result;
};

const bgColors = getAllColorsSpecificShade(DEFAULT_CHART_COLOR_INDEX);

// Put all the common properties here so when the whole chart is selected
// the properties dialog shows the correct selected values
const commonProps = {
  fillStyle: "hachure",
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  opacity: 100,
  roughness: 1,
  strokeColor: COLOR_PALETTE.black,
  roundness: null,
  strokeStyle: "solid",
  strokeWidth: 1,
  verticalAlign: VERTICAL_ALIGN.MIDDLE,
  locked: false,
} as const;

const getChartDimensions = (spreadsheet: Spreadsheet) => {
  // number of categories (labels) is either labels.length or values.length
  const categories = (spreadsheet.labels ?? spreadsheet.series[0].values).length;
  // For grouped bars we keep BAR_WIDTH per series and use half BAR_GAP between series
  // within a category and BAR_GAP between categories as before.
  const numSeries = spreadsheet.series.length;
  const categoryBlockWidth = numSeries * BAR_WIDTH + (numSeries - 1) * BAR_GAP;
  const chartWidth = categoryBlockWidth * categories + BAR_GAP;
  const chartHeight = BAR_HEIGHT + BAR_GAP * 2;
  return { chartWidth, chartHeight };
};

const chartXLabels = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  groupId: string,
  backgroundColor: string,
): ChartElements => {
  const categories = spreadsheet.labels ?? spreadsheet.series[0].values.map((_: number, i: number) => String(i + 1));

  const numSeries = spreadsheet.series.length;
  const categoryBlockWidth = numSeries * BAR_WIDTH + (numSeries - 1) * BAR_GAP;

  return (
    categories.map((label, index) => {
      // center the label under the category block
      const categoryX = x + index * categoryBlockWidth + BAR_GAP;
      const labelX = categoryX + categoryBlockWidth / 2;
      return newTextElement({
        groupIds: [groupId],
        backgroundColor,
        ...commonProps,
        text: label.length > 8 ? `${label.slice(0, 5)}...` : label,
        x: labelX,
        y: y + BAR_GAP / 2,
        width: categoryBlockWidth,
        angle: 5.87 as Radians,
        fontSize: 16,
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
  groupId: string,
  backgroundColor: string,
): ChartElements => {
  const minYLabel = newTextElement({
    groupIds: [groupId],
    backgroundColor,
    ...commonProps,
    x: x - BAR_GAP,
    y: y - BAR_GAP,
    text: "0",
    textAlign: "right",
  });

  const maxVal = Math.max(
    ...spreadsheet.series.reduce((acc, s) => acc.concat(s.values), [] as number[]),
  );
  const maxYLabel = newTextElement({
    groupIds: [groupId],
    backgroundColor,
    ...commonProps,
    x: x - BAR_GAP,
    y: y - BAR_HEIGHT - minYLabel.height / 2,
    text: maxVal.toLocaleString(),
    textAlign: "right",
  });

  return [minYLabel, maxYLabel];
};

const chartLines = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  groupId: string,
  backgroundColor: string,
): ChartElements => {
  const { chartWidth, chartHeight } = getChartDimensions(spreadsheet);
  const xLine = newLinearElement({
    backgroundColor,
    groupIds: [groupId],
    ...commonProps,
    type: "line",
    x,
    y,
    width: chartWidth,
    points: [pointFrom(0, 0), pointFrom(chartWidth, 0)],
  });

  const yLine = newLinearElement({
    backgroundColor,
    groupIds: [groupId],
    ...commonProps,
    type: "line",
    x,
    y,
    height: chartHeight,
    points: [pointFrom(0, 0), pointFrom(0, -chartHeight)],
  });

  const maxLine = newLinearElement({
    backgroundColor,
    groupIds: [groupId],
    ...commonProps,
    type: "line",
    x,
    y: y - BAR_HEIGHT - BAR_GAP,
    strokeStyle: "dotted",
    width: chartWidth,
    opacity: GRID_OPACITY,
    points: [pointFrom(0, 0), pointFrom(chartWidth, 0)],
  });

  return [xLine, yLine, maxLine];
};

// For the maths behind it https://excalidraw.com/#json=6320864370884608,O_5xfD-Agh32tytHpRJx1g
const chartBaseElements = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  groupId: string,
  backgroundColor: string,
  debug?: boolean,
): ChartElements => {
  const { chartWidth, chartHeight } = getChartDimensions(spreadsheet);

  const title = spreadsheet.title
    ? newTextElement({
        backgroundColor,
        groupIds: [groupId],
        ...commonProps,
        text: spreadsheet.title,
        x: x + chartWidth / 2,
        y: y - BAR_HEIGHT - BAR_GAP * 2 - DEFAULT_FONT_SIZE,
        roundness: null,
        textAlign: "center",
      })
    : null;

  const debugRect = debug
    ? newElement({
        backgroundColor,
        groupIds: [groupId],
        ...commonProps,
        type: "rectangle",
        x,
        y: y - chartHeight,
        width: chartWidth,
        height: chartHeight,
        strokeColor: COLOR_PALETTE.black,
        fillStyle: "solid",
        opacity: 6,
      })
    : null;

  return [
    ...(debugRect ? [debugRect] : []),
    ...(title ? [title] : []),
    ...chartXLabels(spreadsheet, x, y, groupId, backgroundColor),
    ...chartYLabels(spreadsheet, x, y, groupId, backgroundColor),
    ...chartLines(spreadsheet, x, y, groupId, backgroundColor),
  ];
};

const chartTypeBar = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ChartElements => {
  const groupId = randomId();
  const numSeries = spreadsheet.series.length;
  const categories = (spreadsheet.labels ?? spreadsheet.series[0].values).length;

  // global max across all series
  const max = Math.max(
    ...spreadsheet.series.reduce((acc, s) => acc.concat(s.values), [] as number[]),
  );

  const categoryBlockWidth = numSeries * BAR_WIDTH + (numSeries - 1) * BAR_GAP;

  const bars: NonDeletedExcalidrawElement[] = [];
  for (let cat = 0; cat < categories; cat++) {
    const categoryX = x + cat * categoryBlockWidth + BAR_GAP;
    for (let s = 0; s < numSeries; s++) {
      const series = spreadsheet.series[s];
      const value = series.values[cat];
      const barHeight = (value / max) * BAR_HEIGHT;
      const seriesColor = bgColors[s % bgColors.length];
      const barX = categoryX + s * (BAR_WIDTH + BAR_GAP);
      bars.push(
        newElement({
          backgroundColor: seriesColor,
          groupIds: [groupId],
          ...commonProps,
          type: "rectangle",
          x: barX,
          y: y - barHeight - BAR_GAP,
          width: BAR_WIDTH,
          height: barHeight,
        }),
      );
    }
  }

  return [
    ...bars,
    ...chartBaseElements(spreadsheet, x, y, groupId, bgColors[0], isDevEnv()),
  ];
};

const chartTypeLine = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ChartElements => {
  const groupId = randomId();
  const numSeries = spreadsheet.series.length;
  const categories = (spreadsheet.labels ?? spreadsheet.series[0].values).length;

  // global max across all series
  const max = Math.max(
    ...spreadsheet.series.reduce((acc, s) => acc.concat(s.values), [] as number[]),
  );

  const categoryBlockWidth = numSeries * BAR_WIDTH + (numSeries - 1) * BAR_GAP;

  const elements: NonDeletedExcalidrawElement[] = [];

  for (let s = 0; s < numSeries; s++) {
    const series = spreadsheet.series[s];
    const seriesColor = bgColors[s % bgColors.length];

    let index = 0;
    const points: [number, number][] = [];
    for (let cat = 0; cat < categories; cat++) {
      const value = series.values[cat];
      const cx = cat * categoryBlockWidth + s * (BAR_WIDTH + BAR_GAP);
      const cy = -(value / max) * BAR_HEIGHT;
      points.push([cx, cy]);
      index++;
    }

    const maxX = Math.max(...points.map((element) => element[0]));
    const maxY = Math.max(...points.map((element) => element[1]));
    const minX = Math.min(...points.map((element) => element[0]));
    const minY = Math.min(...points.map((element) => element[1]));

    const line = newLinearElement({
      backgroundColor: seriesColor,
      groupIds: [groupId],
      ...commonProps,
      type: "line",
      x: x + BAR_GAP + BAR_WIDTH / 2,
      y: y - BAR_GAP,
      height: maxY - minY,
      width: maxX - minX,
      strokeWidth: 2,
      points: points as any,
    });

    elements.push(line);

    // dotted vertical grid lines per point
    for (let i = 0; i < points.length; i++) {
      const cx = points[i][0] + BAR_GAP / 2 + BAR_WIDTH / 2;
      const value = series.values[i];
      const cy = (value / max) * BAR_HEIGHT + BAR_GAP / 2 + BAR_GAP;
      elements.push(
        newLinearElement({
          backgroundColor: seriesColor,
          groupIds: [groupId],
          ...commonProps,
          type: "line",
          x: x + cx + BAR_GAP / 2,
          y: y - cy,
          height: cy,
          strokeStyle: "dotted",
          opacity: GRID_OPACITY,
          points: [pointFrom(0, 0), pointFrom(0, cy)],
        }),
      );
    }

    // dots
    for (let i = 0; i < points.length; i++) {
      const cx = points[i][0] + BAR_GAP / 2 + BAR_WIDTH / 2;
      const value = series.values[i];
      const cy = -(value / max) * BAR_HEIGHT + BAR_GAP / 2;
      elements.push(
        newElement({
          backgroundColor: seriesColor,
          groupIds: [groupId],
          ...commonProps,
          fillStyle: "solid",
          strokeWidth: 2,
          type: "ellipse",
          x: x + cx + BAR_WIDTH / 2,
          y: y + cy - BAR_GAP * 2,
          width: BAR_GAP,
          height: BAR_GAP,
        }),
      );
    }
  }

  return [
    ...chartBaseElements(spreadsheet, x, y, groupId, bgColors[0], isDevEnv()),
    ...elements,
  ];
};

export const renderSpreadsheet = (
  chartType: string,
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ChartElements => {
  if (chartType === "line") {
    return chartTypeLine(spreadsheet, x, y);
  }
  return chartTypeBar(spreadsheet, x, y);
};
