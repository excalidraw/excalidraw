/**
 * table.ts — helpers for generating a table as a group of Excalidraw elements.
 *
 * A "table" is composed of existing primitive element types:
 *   - 1 outer border rectangle
 *   - rows × cols cell rectangles
 *   - rows × cols text elements (one per cell, bound to its container rect)
 *
 * All elements share the same groupId so they behave as a single object.
 * Using existing primitives means undo/redo, collaboration, and export work
 * without any renderer or serialiser changes.
 */

import { nanoid } from "nanoid";

import { newElement, newTextElement } from "@excalidraw/element";

import type { AppState } from "./types";
import type {
  ExcalidrawElement,
  NonDeleted,
  ExcalidrawRectangleElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

export type CreateTableOptions = {
  /** Top-left x in scene coords */
  x: number;
  /** Top-left y in scene coords */
  y: number;
  /** Total table width */
  width: number;
  /** Total table height */
  height: number;
  /** Number of rows (default: 3) */
  rows?: number;
  /** Number of columns (default: 3) */
  cols?: number;
  /** Current app style state for stroke/fill colours etc. */
  appState: Pick<
    AppState,
    | "currentItemStrokeColor"
    | "currentItemBackgroundColor"
    | "currentItemFillStyle"
    | "currentItemStrokeStyle"
    | "currentItemRoughness"
    | "currentItemOpacity"
    | "currentItemFontFamily"
    | "currentItemFontSize"
  >;
  frameId?: string | null;
};

/**
 * Creates all elements for a table and returns them as an ordered array.
 * The caller should insert them into the scene via `insertNewElements`.
 */
export const createTableElements = ({
  x,
  y,
  width,
  height,
  rows = 3,
  cols = 3,
  appState,
  frameId = null,
}: CreateTableOptions): NonDeleted<ExcalidrawElement>[] => {
  // Clamp to sensible minimum dimensions
  const tableWidth = Math.max(width, cols * 40);
  const tableHeight = Math.max(height, rows * 30);

  const cellWidth = tableWidth / cols;
  const cellHeight = tableHeight / rows;

  // Shared group id so the whole table moves/deletes as one unit
  const groupId = nanoid();

  const commonStyle = {
    strokeColor: appState.currentItemStrokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid" as const,
    strokeWidth: 2,
    strokeStyle: "solid" as const,
    roughness: 0,
    opacity: appState.currentItemOpacity,
    roundness: null,
    locked: false,
    frameId,
    groupIds: [groupId],
  };

  const elements: NonDeleted<ExcalidrawElement>[] = [];

  // ─── Outer border ────────────────────────────────────────────────────────
  const border = newElement({
    type: "rectangle",
    x,
    y,
    width: tableWidth,
    height: tableHeight,
    ...commonStyle,
  }) as NonDeleted<ExcalidrawRectangleElement>;
  elements.push(border);

  // ─── Cell rectangles + text elements ─────────────────────────────────────
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = x + col * cellWidth;
      const cellY = y + row * cellHeight;

      // Cell border rectangle
      const cellRect = newElement({
        type: "rectangle",
        x: cellX,
        y: cellY,
        width: cellWidth,
        height: cellHeight,
        ...commonStyle,
      }) as NonDeleted<ExcalidrawRectangleElement>;
      elements.push(cellRect);

      // Text element bound to the cell rectangle
      const textEl = newTextElement({
        x: cellX + cellWidth / 2,
        y: cellY + cellHeight / 2,
        text: "",
        fontSize: appState.currentItemFontSize,
        fontFamily: appState.currentItemFontFamily,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: appState.currentItemStrokeColor,
        backgroundColor: "transparent",
        fillStyle: "solid" as const,
        strokeWidth: 1,
        strokeStyle: "solid" as const,
        roughness: 0,
        opacity: appState.currentItemOpacity,
        roundness: null,
        locked: false,
        frameId,
        groupIds: [groupId],
        containerId: cellRect.id,
        autoResize: true,
      }) as NonDeleted<ExcalidrawTextElement>;
      elements.push(textEl);

      // Bind the text back to the cell rectangle
      (cellRect as any).boundElements = [{ type: "text", id: textEl.id }];
    }
  }

  return elements;
};
