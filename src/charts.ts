import { EVENT_MAGIC, trackEvent } from "./analytics";
import colors from "./colors";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "./constants";
import { newElement, newLinearElement, newTextElement } from "./element";
import { ExcalidrawElement } from "./element/types";
import { randomId } from "./random";

const BAR_WIDTH = 40;
const BAR_GAP = 10;
const BAR_HEIGHT = 256;

export interface Spreadsheet {
  title: string | null;
  labels: string[] | null;
  values: number[];
}

export const NOT_SPREADSHEET = "NOT_SPREADSHEET";
export const VALID_SPREADSHEET = "VALID_SPREADSHEET";

type ParseSpreadsheetResult =
  | { type: typeof NOT_SPREADSHEET; reason: string }
  | { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet };

const tryParseNumber = (s: string): number | null => {
  const match = /^[$€£¥₩]?([0-9,]+(\.[0-9]+)?)$/.exec(s);
  if (!match) {
    return null;
  }
  return parseFloat(match[1].replace(/,/g, ""));
};

const isNumericColumn = (lines: string[][], columnIndex: number) =>
  lines.slice(1).every((line) => tryParseNumber(line[columnIndex]) !== null);

const tryParseCells = (cells: string[][]): ParseSpreadsheetResult => {
  const numCols = cells[0].length;

  if (numCols > 2) {
    return { type: NOT_SPREADSHEET, reason: "More than 2 columns" };
  }

  if (numCols === 1) {
    if (!isNumericColumn(cells, 0)) {
      return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
    }

    const hasHeader = tryParseNumber(cells[0][0]) === null;
    const values = (hasHeader ? cells.slice(1) : cells).map((line) =>
      tryParseNumber(line[0]),
    );

    if (values.length < 2) {
      return { type: NOT_SPREADSHEET, reason: "Less than two rows" };
    }

    return {
      type: VALID_SPREADSHEET,
      spreadsheet: {
        title: hasHeader ? cells[0][0] : null,
        labels: null,
        values: values as number[],
      },
    };
  }

  const valueColumnIndex = isNumericColumn(cells, 0) ? 0 : 1;

  if (!isNumericColumn(cells, valueColumnIndex)) {
    return { type: NOT_SPREADSHEET, reason: "Value is not numeric" };
  }

  const labelColumnIndex = (valueColumnIndex + 1) % 2;
  const hasHeader = tryParseNumber(cells[0][valueColumnIndex]) === null;
  const rows = hasHeader ? cells.slice(1) : cells;

  if (rows.length < 2) {
    return { type: NOT_SPREADSHEET, reason: "Less than 2 rows" };
  }

  return {
    type: VALID_SPREADSHEET,
    spreadsheet: {
      title: hasHeader ? cells[0][valueColumnIndex] : null,
      labels: rows.map((row) => row[labelColumnIndex]),
      values: rows.map((row) => tryParseNumber(row[valueColumnIndex])!),
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
  // Copy/paste from excel, spreadhseets, tsv, csv.
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

const maxColors = colors.elementBackground.length;
const bgColors = colors.elementBackground.slice(2, maxColors);
// Put all the common properties here so when the whole chart is selected
// the properties dialog shows the correct selected values
const commonProps = {
  backgroundColor: bgColors[Math.floor(Math.random() * bgColors.length)],
  fillStyle: "hachure",
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  opacity: 100,
  roughness: 1,
  strokeColor: colors.elementStroke[0],
  strokeSharpness: "sharp",
  strokeStyle: "solid",
  strokeWidth: 1,
  verticalAlign: "middle",
} as const;

const renderSpreadsheetBase = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  groupId?: string,
): ExcalidrawElement[] => {
  const props = groupId ? { groupIds: [groupId], ...commonProps } : commonProps;
  const values = spreadsheet.values;
  const max = Math.max(...values);
  const chartHeight = BAR_HEIGHT + BAR_GAP * 2;
  const chartWidth = (BAR_WIDTH + BAR_GAP) * values.length + BAR_GAP;

  const minYLabel = newTextElement({
    ...props,
    x: x - BAR_GAP,
    y: y - BAR_GAP,
    text: "0",
    textAlign: "right",
  });

  const maxYLabel = newTextElement({
    ...props,
    x: x - BAR_GAP,
    y: y - BAR_HEIGHT - minYLabel.height / 2,
    text: max.toLocaleString(),
    textAlign: "right",
  });

  const xAxisLine = newLinearElement({
    type: "line",
    x,
    y,
    startArrowhead: null,
    endArrowhead: null,
    width: chartWidth,
    points: [
      [0, 0],
      [chartWidth, 0],
    ],
    ...props,
  });

  const yAxisLine = newLinearElement({
    type: "line",
    x,
    y,
    startArrowhead: null,
    endArrowhead: null,
    height: chartHeight,
    points: [
      [0, 0],
      [0, -chartHeight],
    ],
    ...props,
  });

  const maxValueLine = newLinearElement({
    type: "line",
    x,
    y: y - BAR_HEIGHT - BAR_GAP,
    startArrowhead: null,
    endArrowhead: null,
    ...props,
    strokeStyle: "dotted",
    width: chartWidth,
    points: [
      [0, 0],
      [chartWidth, 0],
    ],
  });

  const xLabels =
    spreadsheet.labels?.map((label, index) => {
      return newTextElement({
        ...props,
        text: label.length > 8 ? `${label.slice(0, 5)}...` : label,
        x: x + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP * 2,
        y: y + BAR_GAP / 2,
        width: BAR_WIDTH,
        angle: 5.87,
        fontSize: 16,
        textAlign: "center",
        verticalAlign: "top",
      });
    }) || [];

  const title = spreadsheet.title
    ? newTextElement({
        ...props,
        text: spreadsheet.title,
        x: x + chartWidth / 2,
        y: y - BAR_HEIGHT - BAR_GAP * 2 - maxYLabel.height,
        strokeSharpness: "sharp",
        strokeStyle: "solid",
        textAlign: "center",
      })
    : null;

  return [
    title,
    ...xLabels,
    xAxisLine,
    yAxisLine,
    maxValueLine,
    minYLabel,
    maxYLabel,
  ].filter((element) => element !== null) as ExcalidrawElement[];
};

const renderSpreadsheetLine = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ExcalidrawElement[] => {
  const max = Math.max(...spreadsheet.values);
  const groupId = randomId();
  const props = { groupIds: [groupId], ...commonProps };

  let index = 0;
  const points = [[0, 0]];
  for (const value of spreadsheet.values) {
    const cx = index * (BAR_WIDTH + BAR_GAP) + BAR_GAP + BAR_WIDTH / 2;
    const cy = -(value / max) * BAR_HEIGHT - BAR_GAP;
    points.push([cx, cy]);
    console.info("####", value, index);
    index++;
  }

  const maxX = Math.max(...points.map((element) => element[0]));
  const maxY = Math.max(...points.map((element) => element[1]));

  console.info("####", points, maxX, maxY);

  const line = newLinearElement({
    type: "line",
    x,
    y,
    // x: x + points[0][0],
    // y: y + points[0][1],

    startArrowhead: null,
    endArrowhead: null,
    ...props,
    height: 10,
    width: 10,
    strokeStyle: "solid",
    strokeWidth: 2,
    points: points as any,
  });

  const bars = spreadsheet.values.map((value, index) => {
    const barHeight = (value / max) * BAR_HEIGHT;
    return newElement({
      ...props,
      type: "rectangle",
      x: x + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP,
      y: y - barHeight - BAR_GAP,
      width: BAR_WIDTH,
      height: barHeight,
      opacity: 5,
    });
  });

  return [line, ...bars, ...renderSpreadsheetBase(spreadsheet, x, y, groupId)];
};

const renderSpreadsheetBar = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ExcalidrawElement[] => {
  const max = Math.max(...spreadsheet.values);
  const groupId = randomId();
  const props = { groupIds: [groupId], ...commonProps };

  const bars = spreadsheet.values.map((value, index) => {
    const barHeight = (value / max) * BAR_HEIGHT;
    return newElement({
      ...props,
      type: "rectangle",
      x: x + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP,
      y: y - barHeight - BAR_GAP,
      width: BAR_WIDTH,
      height: barHeight,
    });
  });

  return [...bars, ...renderSpreadsheetBase(spreadsheet, x, y, groupId)];
};

// For the maths behind it https://excalidraw.com/#json=6320864370884608,O_5xfD-Agh32tytHpRJx1g
export const renderSpreadsheet = (
  chartType: string,
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ExcalidrawElement[] => {
  let chart: ExcalidrawElement[];
  if (chartType === "line") {
    chart = renderSpreadsheetLine(spreadsheet, x, y);
  } else {
    chart = renderSpreadsheetBar(spreadsheet, x, y);
  }
  trackEvent(EVENT_MAGIC, "chart", chartType, chart.length);
  return chart;
};
