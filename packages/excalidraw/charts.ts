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
  // Backwards-compatible single-series values array. When parsing multi-series
  // spreadsheets this will be set to the first series so existing code that
  // expects `values` continues to work until renderers are updated.
  values?: number[];
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
        values: rows.map((r) => tryParseNumber(r[0])!),
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

    return {
      type: VALID_SPREADSHEET,
      spreadsheet: {
        title: hasHeader ? cells[0][firstNumericIndex] : null,
        labels,
        series,
        values: series[0].values,
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

  return {
    type: VALID_SPREADSHEET,
    spreadsheet: {
      title: null,
      labels: null,
      series,
      values: series[0].values,
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
  // For now we only accept 2 columns with an optional header

  // Check for tab separated values
  let lines = text
    .trim()
    .split("\n")
    .map((line) => line.trim().split("\t"));

  // Check for comma separated files
  if (lines.length && lines[0].length !== 2) {
    lines = text
      .trim()
      .split("\n")
      .map((line) => line.trim().split(","));
  }

  if (lines.length === 0) {
    return { type: NOT_SPREADSHEET, reason: "No values" };
  }

  const numColsFirstLine = lines[0].length;
  const isSpreadsheet = lines.every((line) => line.length === numColsFirstLine);

  if (!isSpreadsheet) {
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
  const values = spreadsheet.values ?? spreadsheet.series[0].values;
  const chartWidth = (BAR_WIDTH + BAR_GAP) * values.length + BAR_GAP;
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
  return (
    spreadsheet.labels?.map((label, index) => {
      return newTextElement({
        groupIds: [groupId],
        backgroundColor,
        ...commonProps,
        text: label.length > 8 ? `${label.slice(0, 5)}...` : label,
        x: x + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP * 2,
        y: y + BAR_GAP / 2,
        width: BAR_WIDTH,
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

  const maxYLabel = newTextElement({
    groupIds: [groupId],
    backgroundColor,
    ...commonProps,
    x: x - BAR_GAP,
    y: y - BAR_HEIGHT - minYLabel.height / 2,
    text: Math.max(...(spreadsheet.values ?? spreadsheet.series[0].values)).toLocaleString(),
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
  const values = spreadsheet.values ?? spreadsheet.series[0].values;
  const max = Math.max(...values);
  const groupId = randomId();
  const backgroundColor = bgColors[Math.floor(Math.random() * bgColors.length)];
  const bars = values.map((value, index) => {
    const barHeight = (value / max) * BAR_HEIGHT;
    return newElement({
      backgroundColor,
      groupIds: [groupId],
      ...commonProps,
      type: "rectangle",
      x: x + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP,
      y: y - barHeight - BAR_GAP,
      width: BAR_WIDTH,
      height: barHeight,
    });
  });

  return [
    ...bars,
    ...chartBaseElements(
      spreadsheet,
      x,
      y,
      groupId,
      backgroundColor,
      isDevEnv(),
    ),
  ];
};

const chartTypeLine = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ChartElements => {
  const values = spreadsheet.values ?? spreadsheet.series[0].values;
  const max = Math.max(...values);
  const groupId = randomId();
  const backgroundColor = bgColors[Math.floor(Math.random() * bgColors.length)];

  let index = 0;
  const points = [];
  for (const value of values) {
    const cx = index * (BAR_WIDTH + BAR_GAP);
    const cy = -(value / max) * BAR_HEIGHT;
    points.push([cx, cy]);
    index++;
  }

  const maxX = Math.max(...points.map((element) => element[0]));
  const maxY = Math.max(...points.map((element) => element[1]));
  const minX = Math.min(...points.map((element) => element[0]));
  const minY = Math.min(...points.map((element) => element[1]));

  const line = newLinearElement({
    backgroundColor,
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

  const dots = values.map((value, index) => {
    const cx = index * (BAR_WIDTH + BAR_GAP) + BAR_GAP / 2;
    const cy = -(value / max) * BAR_HEIGHT + BAR_GAP / 2;
    return newElement({
      backgroundColor,
      groupIds: [groupId],
      ...commonProps,
      fillStyle: "solid",
      strokeWidth: 2,
      type: "ellipse",
      x: x + cx + BAR_WIDTH / 2,
      y: y + cy - BAR_GAP * 2,
      width: BAR_GAP,
      height: BAR_GAP,
    });
  });

  const lines = values.map((value, index) => {
    const cx = index * (BAR_WIDTH + BAR_GAP) + BAR_GAP / 2;
    const cy = (value / max) * BAR_HEIGHT + BAR_GAP / 2 + BAR_GAP;
    return newLinearElement({
      backgroundColor,
      groupIds: [groupId],
      ...commonProps,
      type: "line",
      x: x + cx + BAR_WIDTH / 2 + BAR_GAP / 2,
      y: y - cy,
      height: cy,
      strokeStyle: "dotted",
      opacity: GRID_OPACITY,
      points: [pointFrom(0, 0), pointFrom(0, cy)],
    });
  });

  return [
    ...chartBaseElements(
      spreadsheet,
      x,
      y,
      groupId,
      backgroundColor,
      isDevEnv(),
    ),
    line,
    ...lines,
    ...dots,
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
