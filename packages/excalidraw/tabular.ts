import { FONT_FAMILY } from "@excalidraw/common";
import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_PADDING = 10;
const CELL_HEIGHT = 36;
const MIN_CELL_WIDTH = 60;
const CHAR_WIDTH_ESTIMATE = 8; // rough px-per-char for 16px font
const FONT_SIZE = 16;
const STROKE_COLOR = "#1e1e1e";
const BG_COLOR = "transparent";
const HEADER_BG = "#e3e2fe"; // light indigo tint for the first row

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the string looks like tab-separated values — at least two
 * rows and at least two columns.  We intentionally keep the heuristic tight so
 * that random text with a stray tab character is not misinterpreted.
 */
export const isTabSeparatedData = (text: string): boolean => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    return false;
  }
  // Every non-empty line must contain at least one tab
  const meaningful = lines.filter((l) => l.trim().length > 0);
  if (meaningful.length < 2) {
    return false;
  }
  return meaningful.every((line) => line.includes("\t"));
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

type Cell = string;
type Row = Cell[];

const parseRows = (text: string): Row[] =>
  text
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split("\t").map((cell) => cell.trim()));

// ---------------------------------------------------------------------------
// Element creation
// ---------------------------------------------------------------------------

/**
 * Turn tab-separated text into a grid of rectangle + text element pairs that
 * looks like a rough hand-drawn table on the Excalidraw canvas.
 *
 * `x0` / `y0` anchor the top-left corner (default 0, 0 — the caller can
 * reposition afterward).
 */
export const renderTabularData = (
  text: string,
  x0 = 0,
  y0 = 0,
): ExcalidrawElement[] | null => {
  if (!isTabSeparatedData(text)) {
    return null;
  }

  const rows = parseRows(text);
  if (rows.length === 0) {
    return null;
  }

  const colCount = Math.max(...rows.map((r) => r.length));

  // Determine column widths: use the widest cell content in each column,
  // clamped to a minimum.
  const colWidths: number[] = Array.from({ length: colCount }, (_, col) => {
    let maxLen = 0;
    for (const row of rows) {
      const cell = row[col] ?? "";
      if (cell.length > maxLen) {
        maxLen = cell.length;
      }
    }
    return Math.max(MIN_CELL_WIDTH, maxLen * CHAR_WIDTH_ESTIMATE + CELL_PADDING * 2);
  });

  // Build element skeletons — one rectangle and one text per cell.
  const skeletons: Parameters<typeof convertToExcalidrawElements>[0] = [];

  let curY = y0;
  for (let r = 0; r < rows.length; r++) {
    let curX = x0;
    const isHeader = r === 0;

    for (let c = 0; c < colCount; c++) {
      const cellText = rows[r]?.[c] ?? "";
      const w = colWidths[c];

      // Rectangle
      skeletons.push({
        type: "rectangle",
        x: curX,
        y: curY,
        width: w,
        height: CELL_HEIGHT,
        strokeColor: STROKE_COLOR,
        backgroundColor: isHeader ? HEADER_BG : BG_COLOR,
        fillStyle: isHeader ? "solid" : "hachure",
        roughness: 1,
        opacity: 100,
        strokeWidth: 1,
      });

      // Text (centered inside the rectangle)
      skeletons.push({
        type: "text",
        x: curX + CELL_PADDING,
        y: curY + (CELL_HEIGHT - FONT_SIZE) / 2,
        width: w - CELL_PADDING * 2,
        height: FONT_SIZE,
        text: cellText,
        fontSize: FONT_SIZE,
        fontFamily: FONT_FAMILY.Excalifont,
        textAlign: "left",
        verticalAlign: "middle",
        strokeColor: STROKE_COLOR,
        opacity: 100,
      });

      curX += w;
    }

    curY += CELL_HEIGHT;
  }

  return convertToExcalidrawElements(skeletons);
};
