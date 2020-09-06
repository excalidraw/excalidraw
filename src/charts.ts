import { ExcalidrawElement } from "./element/types";
import { newElement, newTextElement } from "./element";
import { AppState } from "./types";
import { t } from "./i18n";
import { DEFAULT_VERTICAL_ALIGN } from "./constants";

export interface Spreadsheet {
  yAxisLabel: string | null;
  labels: string[] | null;
  values: number[];
}

export const NOT_SPREADSHEET = "NOT_SPREADSHEET";
export const MALFORMED_SPREADSHEET = "MALFORMED_SPREADSHEET";
export const VALID_SPREADSHEET = "VALID_SPREADSHEET";

type ParseSpreadsheetResult =
  | {
      type: typeof NOT_SPREADSHEET;
    }
  | { type: typeof VALID_SPREADSHEET; spreadsheet: Spreadsheet }
  | {
      type: typeof MALFORMED_SPREADSHEET;
      error: string;
    };

function tryParseNumber(s: string): number | null {
  const match = /^[$€£¥₩]?([0-9]+(\.[0-9]+)?)$/.exec(s);
  if (!match) {
    return null;
  }
  return parseFloat(match[1]);
}

function isNumericColumn(lines: string[][], columnIndex: number) {
  return lines
    .slice(1)
    .every((line) => tryParseNumber(line[columnIndex]) !== null);
}

function tryParseCells(cells: string[][]): ParseSpreadsheetResult {
  const numCols = cells[0].length;

  if (numCols > 2) {
    return { type: MALFORMED_SPREADSHEET, error: t("charts.tooManyColumns") };
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
        yAxisLabel: hasHeader ? cells[0][0] : null,
        labels: null,
        values: values as number[],
      },
    };
  }

  const valueColumnIndex = isNumericColumn(cells, 0) ? 0 : 1;

  if (!isNumericColumn(cells, valueColumnIndex)) {
    return {
      type: MALFORMED_SPREADSHEET,
      error: t("charts.noNumericColumn"),
    };
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
      yAxisLabel: hasHeader ? cells[0][valueColumnIndex] : null,
      labels: rows.map((row) => row[labelColumnIndex]),
      values: rows.map((row) => tryParseNumber(row[valueColumnIndex])!),
    },
  };
}

function transposeCells(cells: string[][]) {
  const nextCells: string[][] = [];
  for (let col = 0; col < cells[0].length; col++) {
    const nextCellRow: string[] = [];
    for (let row = 0; row < cells.length; row++) {
      nextCellRow.push(cells[row][col]);
    }
    nextCells.push(nextCellRow);
  }

  return nextCells;
}

export function tryParseSpreadsheet(text: string): ParseSpreadsheetResult {
  // copy/paste from excel, in-browser excel, and google sheets is tsv
  // for now we only accept 2 columns with an optional header
  const lines = text
    .trim()
    .split("\n")
    .map((line) => line.trim().split("\t"));

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
}

const BAR_WIDTH = 32;
const BAR_SPACING = 12;
const BAR_HEIGHT = 192;
const LABEL_SPACING = 3 * BAR_SPACING;
const Y_AXIS_LABEL_SPACING = LABEL_SPACING;
const ANGLE = 5.87;

export function renderSpreadsheet(
  appState: AppState,
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
): ExcalidrawElement[] {
  const max = Math.max(...spreadsheet.values);
  const min = Math.min(0, ...spreadsheet.values);
  const range = max - min;

  const minYLabel = newTextElement({
    x: x,
    y: y + BAR_HEIGHT,
    strokeColor: appState.currentItemStrokeColor,
    backgroundColor: appState.currentItemBackgroundColor,
    fillStyle: appState.currentItemFillStyle,
    strokeWidth: appState.currentItemStrokeWidth,
    strokeStyle: appState.currentItemStrokeStyle,
    roughness: appState.currentItemRoughness,
    opacity: appState.currentItemOpacity,
    strokeSharpness: appState.currentItemStrokeSharpness,
    text: min.toLocaleString(),
    fontSize: 16,
    fontFamily: appState.currentItemFontFamily,
    textAlign: appState.currentItemTextAlign,
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
  });

  const maxYLabel = newTextElement({
    x: x,
    y: y,
    strokeColor: appState.currentItemStrokeColor,
    backgroundColor: appState.currentItemBackgroundColor,
    fillStyle: appState.currentItemFillStyle,
    strokeWidth: appState.currentItemStrokeWidth,
    strokeStyle: appState.currentItemStrokeStyle,
    roughness: appState.currentItemRoughness,
    opacity: appState.currentItemOpacity,
    strokeSharpness: appState.currentItemStrokeSharpness,
    text: max.toLocaleString(),
    fontSize: 16,
    fontFamily: appState.currentItemFontFamily,
    textAlign: appState.currentItemTextAlign,
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
  });

  const bars = spreadsheet.values.map((value, i) => {
    const valueBarHeight = value - min;
    const percentBarHeight = valueBarHeight / range;
    const barHeight = percentBarHeight * BAR_HEIGHT;
    const barX = i * (BAR_WIDTH + BAR_SPACING) + LABEL_SPACING;
    const barY = BAR_HEIGHT - barHeight;
    return newElement({
      type: "rectangle",
      x: barX + x,
      y: barY + y,
      width: BAR_WIDTH,
      height: barHeight,
      strokeColor: appState.currentItemStrokeColor,
      backgroundColor: appState.currentItemBackgroundColor,
      fillStyle: appState.currentItemFillStyle,
      strokeWidth: appState.currentItemStrokeWidth,
      strokeStyle: appState.currentItemStrokeStyle,
      roughness: appState.currentItemRoughness,
      opacity: appState.currentItemOpacity,
      strokeSharpness: appState.currentItemStrokeSharpness,
    });
  });

  const xLabels =
    spreadsheet.labels?.map((label, i) => {
      const labelX =
        i * (BAR_WIDTH + BAR_SPACING) + LABEL_SPACING + BAR_SPACING;
      const labelY = BAR_HEIGHT + BAR_SPACING;
      return newTextElement({
        text: label.length > 8 ? `${label.slice(0, 5)}...` : label,
        x: x + labelX,
        y: y + labelY,
        strokeColor: appState.currentItemStrokeColor,
        backgroundColor: appState.currentItemBackgroundColor,
        fillStyle: appState.currentItemFillStyle,
        strokeWidth: appState.currentItemStrokeWidth,
        strokeStyle: appState.currentItemStrokeStyle,
        roughness: appState.currentItemRoughness,
        opacity: appState.currentItemOpacity,
        strokeSharpness: appState.currentItemStrokeSharpness,
        fontSize: 16,
        fontFamily: appState.currentItemFontFamily,
        textAlign: "center",
        verticalAlign: DEFAULT_VERTICAL_ALIGN,
        width: BAR_WIDTH,
        angle: ANGLE,
      });
    }) || [];

  const yAxisLabel = spreadsheet.yAxisLabel
    ? newTextElement({
        text: spreadsheet.yAxisLabel,
        x: x - Y_AXIS_LABEL_SPACING,
        y: y + BAR_HEIGHT / 2 - 10,
        strokeColor: appState.currentItemStrokeColor,
        backgroundColor: appState.currentItemBackgroundColor,
        fillStyle: appState.currentItemFillStyle,
        strokeWidth: appState.currentItemStrokeWidth,
        strokeStyle: appState.currentItemStrokeStyle,
        roughness: appState.currentItemRoughness,
        opacity: appState.currentItemOpacity,
        strokeSharpness: appState.currentItemStrokeSharpness,
        fontSize: 20,
        fontFamily: appState.currentItemFontFamily,
        textAlign: "center",
        verticalAlign: DEFAULT_VERTICAL_ALIGN,
        width: BAR_WIDTH,
        angle: ANGLE,
      })
    : null;

  return [...bars, yAxisLabel, minYLabel, maxYLabel, ...xLabels].filter(
    (element) => element !== null,
  ) as ExcalidrawElement[];
}
