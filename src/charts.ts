import { EVENT_MAGIC, trackEvent } from "./analytics";
import colors from "./colors";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "./constants";
import { newElement, newTextElement } from "./element";
import {
  ExcalidrawElement,
  FillStyle,
  FontFamily,
  StrokeSharpness,
  StrokeStyle,
  VerticalAlign,
} from "./element/types";
import { randomId } from "./random";

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

const isNumericColumn = (lines: string[][], columnIndex: number) => {
  return lines
    .slice(1)
    .every((line) => tryParseNumber(line[columnIndex]) !== null);
};

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
  // copy/paste from excel, in-browser excel, google sheets is tsv
  // we also check for csv
  // for now we only accept 2 columns with an optional header
  // TODO: Try maybe something smarter to understand if we can parse it
  // Check for Tab separeted values
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
  const isASpreadsheet = lines.every(
    (line) => line.length === numColsFirstLine,
  );

  if (!isASpreadsheet) {
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

const BAR_WIDTH = 32;
const BAR_GAP = 12;
const BAR_HEIGHT = 256;

const ANGLE = 5.87;

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
  const backgrounds = colors.elementBackground.slice(2, maxColors);
  const color = backgrounds[Math.floor(Math.random() * backgrounds.length)];
  const groupIds = [randomId()];

  // Put all the common properties here so when the whole chart is selected
  // the properties dialog shows the correct selected values
  const commonProps: {
    backgroundColor: string;
    fontFamily: FontFamily;
    fontSize: number;
    groupIds: any;
    opacity: number;
    roughness: number;
    strokeWidth: number;
    fillStyle: FillStyle;
    strokeStyle: StrokeStyle;
    strokeSharpness: StrokeSharpness;
    verticalAlign: VerticalAlign;
  } = {
    backgroundColor: color,
    fillStyle: "hachure",
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    groupIds,
    opacity: 100,
    roughness: 1,
    strokeSharpness: "sharp",
    strokeStyle: "solid",
    strokeWidth: 1,
    verticalAlign: "middle",
  };

  // Min value label
  const minYLabel = newTextElement({
    ...commonProps,
    x: x - BAR_GAP,
    y: y - BAR_GAP,
    strokeColor: colors.elementStroke[0],
    text: "0",
    textAlign: "right",
  });

  // Max value label
  const maxYLabel = newTextElement({
    ...commonProps,
    x: x - BAR_GAP,
    y: y - BAR_HEIGHT - minYLabel.height / 2,
    strokeColor: colors.elementStroke[0],
    text: max.toLocaleString(),
    textAlign: "right",
  });

  // TODO: X-axis arrow: Start: [x, y], End: [x + chartWidth + BAR_GAP * 2, y]
  // TODO: Y-axis arrow: Start: [x, y], End: [x, y - chartHeight - BAR_GAP * 2]
  // TODO: Dashed horizontal line for max value:
  //       Start [x, y - BAR_HEIGHT - BAR_GAP]
  //       End:  [x + chartWidth, y - BAR_HEIGHT - BAR_GAP]

  const bars = values.map((value, index) => {
    const barHeight = (value / max) * BAR_HEIGHT;
    return newElement({
      ...commonProps,
      type: "rectangle",
      x: x + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP,
      y: y - barHeight - BAR_GAP,
      width: BAR_WIDTH,
      height: barHeight,
      strokeColor: colors.elementStroke[0],
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
        angle: ANGLE,
        fontSize: 16,
        strokeColor: colors.elementStroke[0],
        textAlign: "center",
        verticalAlign: "top",
      });
    }) || [];

  // Title on top of the chart in the middle
  const title = spreadsheet.title
    ? newTextElement({
        ...commonProps,
        text: spreadsheet.title,
        x: x + chartWidth / 2,
        y: y - BAR_HEIGHT - BAR_GAP * 3 - maxYLabel.height,
        strokeColor: colors.elementStroke[0],
        strokeSharpness: "sharp",
        strokeStyle: "solid",
        textAlign: "center",
      })
    : null;

  // TODO: delete this element
  const testRect = newElement({
    ...commonProps,
    type: "rectangle",
    x,
    y: y - chartHeight,
    width: chartWidth,
    height: chartHeight,
    strokeColor: colors.elementStroke[0],
    fillStyle: "solid",
    opacity: 6,
  });

  trackEvent(EVENT_MAGIC, "chart", "bars", bars.length);
  return [...bars, title, minYLabel, maxYLabel, ...xLabels, testRect].filter(
    (element) => element !== null,
  ) as ExcalidrawElement[];
};
