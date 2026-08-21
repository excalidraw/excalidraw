import { randomId } from "@excalidraw/common";
import { newElement, newLinearElement } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { ElementConstructorOpts } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

export const MIN_TABLE_SIZE = 1;
export const MAX_TABLE_SIZE = 50;
export const DEFAULT_TABLE_ROWS = 3;
export const DEFAULT_TABLE_COLS = 3;
export const TABLE_CELL_WIDTH = 120;
export const TABLE_CELL_HEIGHT = 48;

export type TableElementStyles = Pick<
  ElementConstructorOpts,
  | "strokeColor"
  | "backgroundColor"
  | "fillStyle"
  | "strokeWidth"
  | "strokeStyle"
  | "roughness"
  | "opacity"
>;

export type CreateTableOptions = {
  rows: number;
  cols: number;
  x?: number;
  y?: number;
  cellWidth?: number;
  cellHeight?: number;
  styles?: TableElementStyles;
};

export const clampTableDimension = (value: number): number =>
  Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, Math.floor(value)));

export const parseTableDimension = (raw: string, fallback: number): number => {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clampTableDimension(parsed);
};

/**
 * Builds a table from a single outer rectangle and internal grid lines,
 * grouped so it can be moved as one object.
 */
export const createTableElements = ({
  rows,
  cols,
  x = 0,
  y = 0,
  cellWidth = TABLE_CELL_WIDTH,
  cellHeight = TABLE_CELL_HEIGHT,
  styles = {},
}: CreateTableOptions): NonDeletedExcalidrawElement[] => {
  const safeRows = clampTableDimension(rows);
  const safeCols = clampTableDimension(cols);
  const width = safeCols * cellWidth;
  const height = safeRows * cellHeight;
  const groupId = randomId();
  const groupIds: ExcalidrawElement["groupIds"] = [groupId];

  const sharedProps = {
    ...styles,
    groupIds,
    roundness: null,
  };

  const elements: NonDeletedExcalidrawElement[] = [
    newElement({
      ...sharedProps,
      type: "rectangle",
      x,
      y,
      width,
      height,
    }),
  ];

  for (let col = 1; col < safeCols; col++) {
    const lineX = x + col * cellWidth;
    elements.push(
      newLinearElement({
        ...sharedProps,
        type: "line",
        x: lineX,
        y,
        width: 0,
        height,
        points: [pointFrom(0, 0), pointFrom(0, height)],
      }),
    );
  }

  for (let row = 1; row < safeRows; row++) {
    const lineY = y + row * cellHeight;
    elements.push(
      newLinearElement({
        ...sharedProps,
        type: "line",
        x,
        y: lineY,
        width,
        height: 0,
        points: [pointFrom(0, 0), pointFrom(width, 0)],
      }),
    );
  }

  return elements;
};
