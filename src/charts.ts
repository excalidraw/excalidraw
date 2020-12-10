import { EVENT_MAGIC, trackEvent } from "./analytics";
import colors from "./colors";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "./constants";
import { newElement, newTextElement, newLinearElement } from "./element";
import { mutateElement } from "./element/mutateElement";
import {
  ExcalidrawElement,
  FillStyle,
  FontFamily,
  StrokeSharpness,
  StrokeStyle,
  VerticalAlign,
} from "./element/types";
import { randomId } from "./random";

const BAR_WIDTH = 32;
const BAR_GAP = 12;
const BAR_HEIGHT = 256;

export interface Spreadsheet {
  title: string | null;
  labels: string[] | null;
  values: number[];
}

export const NOT_SPREADSHEET = "NOT_SPREADSHEET";
export const VALID_SPREADSHEET = "VALID_SPREADSHEET";

type ParseSpreadsheetResult =
  | { type: typeof NOT_SPREADSHEET }
  | { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet };

const tryParseNumber = (s: string): number | null => {
  const match = /^[$€£¥₩]?([0-9]+(\.[0-9]+)?)$/.exec(s);
  if (!match) {
    return null;
  }
  return parseFloat(match[1]);
};

const isNumericColumn = (lines: string[][], columnIndex: number) =>
  lines.slice(1).every((line) => tryParseNumber(line[columnIndex]) !== null);

const tryParseCells = (cells: string[][]): ParseSpreadsheetResult => {
  const numCols = cells[0].length;

  if (numCols > 2) {
    return { type: NOT_SPREADSHEET };
  }

  if (numCols === 1) {
    if (!isNumericColumn(cells, 0)) {
      return { type: NOT_SPREADSHEET };
    }

    const hasHeader = tryParseNumber(cells[0][0]) === null;
    const values = (hasHeader ? cells.slice(1) : cells).map((line) =>
      tryParseNumber(line[0]),
    );

    if (values.length < 2) {
      return { type: NOT_SPREADSHEET };
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
    return { type: NOT_SPREADSHEET };
  }

  const labelColumnIndex = (valueColumnIndex + 1) % 2;
  const hasHeader = tryParseNumber(cells[0][valueColumnIndex]) === null;
  const rows = hasHeader ? cells.slice(1) : cells;

  if (rows.length < 2) {
    return { type: NOT_SPREADSHEET };
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

  // Check for tab separeted values
  let lines = text
    .trim()
    .split("\n")
    .map((line) => line.trim().split("\t"));

  // Check for comma separeted files
  if (lines.length !== 0 && lines[0].length !== 2) {
    lines = text
      .trim()
      .split("\n")
      .map((line) => line.trim().split(","));
  }

  if (lines.length === 0) {
    return { type: NOT_SPREADSHEET };
  }

  const numColsFirstLine = lines[0].length;
  const isSpreadsheet = lines.every((line) => line.length === numColsFirstLine);

  if (!isSpreadsheet) {
    return { type: NOT_SPREADSHEET };
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

// For the maths behind it https://excalidraw.com/#json=6320864370884608,O_5xfD-Agh32tytHpRJx1g
export const renderSpreadsheet = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ExcalidrawElement[] => {
  const values = spreadsheet.values;
  const max = Math.max(...values);
  const chartHeight = BAR_HEIGHT + BAR_GAP * 2;
  const chartWidth = (BAR_WIDTH + BAR_GAP) * values.length + BAR_GAP;
  const maxColors = colors.elementBackground.length;
  const bgColors = colors.elementBackground.slice(2, maxColors);

  // Put all the common properties here so when the whole chart is selected
  // the properties dialog shows the correct selected values
  const commonProps: {
    backgroundColor: string;
    fillStyle: FillStyle;
    fontFamily: FontFamily;
    fontSize: number;
    groupIds: any;
    opacity: number;
    roughness: number;
    strokeColor: string;
    strokeSharpness: StrokeSharpness;
    strokeStyle: StrokeStyle;
    strokeWidth: number;
    verticalAlign: VerticalAlign;
  } = {
    backgroundColor: bgColors[Math.floor(Math.random() * bgColors.length)],
    fillStyle: "hachure",
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    groupIds: [randomId()],
    opacity: 100,
    roughness: 1,
    strokeColor: colors.elementStroke[0],
    strokeSharpness: "sharp",
    strokeStyle: "solid",
    strokeWidth: 1,
    verticalAlign: "middle",
  };

  const minYLabel = newTextElement({
    ...commonProps,
    x: x - BAR_GAP,
    y: y - BAR_GAP,
    text: "0",
    textAlign: "right",
  });

  const maxYLabel = newTextElement({
    ...commonProps,
    x: x - BAR_GAP,
    y: y - BAR_HEIGHT - minYLabel.height / 2,
    text: max.toLocaleString(),
    textAlign: "right",
  });

  const axesLine = newLinearElement({
    type: "line",
    x,
    y,
    startArrowhead: null,
    endArrowhead: null,
    ...commonProps,
  });
  mutateElement(axesLine, {
    points: [
      [0, -chartHeight],
      [0, 0],
      [chartWidth, 0],
    ],
  });

  const maxValueLine = newLinearElement({
    type: "line",
    x,
    y: y - BAR_HEIGHT - BAR_GAP,
    startArrowhead: null,
    endArrowhead: null,
    ...commonProps,
  });
  mutateElement(maxValueLine, {
    points: [
      [0, 0],
      [chartWidth, 0],
    ],
    strokeStyle: "dotted",
  });

  const bars = values.map((value, index) => {
    const barHeight = (value / max) * BAR_HEIGHT;
    return newElement({
      ...commonProps,
      type: "rectangle",
      x: x + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP,
      y: y - barHeight - BAR_GAP,
      width: BAR_WIDTH,
      height: barHeight,
    });
  });

  const xLabels =
    spreadsheet.labels?.map((label, index) => {
      return newTextElement({
        ...commonProps,
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
        ...commonProps,
        text: spreadsheet.title,
        x: x + chartWidth / 2,
        y: y - BAR_HEIGHT - BAR_GAP * 2 - maxYLabel.height,
        strokeSharpness: "sharp",
        strokeStyle: "solid",
        textAlign: "center",
      })
    : null;

  trackEvent(EVENT_MAGIC, "chart", "bars", bars.length);
  return [
    title,
    ...bars,
    ...xLabels,
    axesLine,
    maxValueLine,
    minYLabel,
    maxYLabel,
  ].filter((element) => element !== null) as ExcalidrawElement[];
};
