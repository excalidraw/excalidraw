/**
 * table.ts — helpers for generating and mutating tables in Excalidraw.
 *
 * A "table" is composed of existing primitive element types:
 *   - 1 outer border rectangle
 *   - rows × cols cell rectangles
 *   - rows × cols text elements (one per cell, bound to its container rect)
 *
 * All elements share the same groupId and contain metadata in `customData`
 * ({ isTable: true, tableId, row, col, rows, cols }) so that row/column operations
 * can seamlessly insert, delete, and rearrange grid elements.
 */

import { nanoid } from "nanoid";

import {
  newElement,
  newTextElement,
  newElementWith,
  getNonDeletedElements,
} from "@excalidraw/element";

import type { AppState, UIAppState } from "./types";
import type {
  ExcalidrawElement,
  NonDeleted,
  ExcalidrawRectangleElement,
  ExcalidrawTextElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

export type TableCustomData = {
  isTable: true;
  tableId: string;
  isTableBorder?: boolean;
  isTableCell?: boolean;
  isTableText?: boolean;
  row?: number;
  col?: number;
  rows: number;
  cols: number;
};

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
  const numRows = Math.max(1, Math.min(rows, 30));
  const numCols = Math.max(1, Math.min(cols, 30));

  // Clamp to sensible minimum dimensions
  const tableWidth = Math.max(width, numCols * 40);
  const tableHeight = Math.max(height, numRows * 30);

  const cellWidth = tableWidth / numCols;
  const cellHeight = tableHeight / numRows;

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
    customData: {
      isTable: true,
      tableId: groupId,
      isTableBorder: true,
      rows: numRows,
      cols: numCols,
    },
  }) as NonDeleted<ExcalidrawRectangleElement>;
  elements.push(border);

  // ─── Cell rectangles + text elements ─────────────────────────────────────
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
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
        strokeWidth: 1,
        customData: {
          isTable: true,
          tableId: groupId,
          isTableCell: true,
          row,
          col,
          rows: numRows,
          cols: numCols,
        },
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
        customData: {
          isTable: true,
          tableId: groupId,
          isTableText: true,
          row,
          col,
          rows: numRows,
          cols: numCols,
        },
      }) as NonDeleted<ExcalidrawTextElement>;
      elements.push(textEl);

      // Bind the text back to the cell rectangle
      (cellRect as any).boundElements = [{ type: "text", id: textEl.id }];
    }
  }

  return elements;
};

/**
 * Checks if an element belongs to a Table
 */
export const isTableElement = (
  element: ExcalidrawElement | null | undefined,
): boolean => {
  return Boolean(element?.customData?.isTable);
};

/**
 * Checks if any currently selected element belongs to a Table
 */
export const isSomeTableElementSelected = (
  elements: readonly ExcalidrawElement[],
  appState: UIAppState,
): boolean => {
  const selectedIds = Object.keys(appState.selectedElementIds || {});
  if (!selectedIds.length) {
    return false;
  }
  const elementsMap = new Map(elements.map((el) => [el.id, el]));
  return selectedIds.some((id) => isTableElement(elementsMap.get(id)));
};

type TableStructure = {
  tableId: string;
  border: ExcalidrawRectangleElement | null;
  cells: Map<string, ExcalidrawRectangleElement>; // key: `${row}_${col}`
  texts: Map<string, ExcalidrawTextElement>; // key: `${row}_${col}`
  rows: number;
  cols: number;
  targetRow: number;
  targetCol: number;
  cellWidth: number;
  cellHeight: number;
  allTableElements: ExcalidrawElement[];
};

/**
 * Extracts table structure & indices from the selection
 */
export const getTableStructure = (
  elements: readonly ExcalidrawElement[],
  targetElement: ExcalidrawElement,
): TableStructure | null => {
  if (!isTableElement(targetElement)) {
    return null;
  }

  const tableId = targetElement.customData?.tableId;
  if (!tableId) {
    return null;
  }

  const allTableElements = elements.filter(
    (el) => !el.isDeleted && el.customData?.tableId === tableId,
  );

  let border: ExcalidrawRectangleElement | null = null;
  const cells = new Map<string, ExcalidrawRectangleElement>();
  const texts = new Map<string, ExcalidrawTextElement>();

  let maxRow = 0;
  let maxCol = 0;

  for (const el of allTableElements) {
    const data = el.customData as TableCustomData | undefined;
    if (!data) {
      continue;
    }
    if (data.isTableBorder) {
      border = el as ExcalidrawRectangleElement;
    } else if (data.isTableCell && data.row !== undefined && data.col !== undefined) {
      cells.set(`${data.row}_${data.col}`, el as ExcalidrawRectangleElement);
      maxRow = Math.max(maxRow, data.row);
      maxCol = Math.max(maxCol, data.col);
    } else if (data.isTableText && data.row !== undefined && data.col !== undefined) {
      texts.set(`${data.row}_${data.col}`, el as ExcalidrawTextElement);
    }
  }

  const rows = maxRow + 1;
  const cols = maxCol + 1;

  const targetData = targetElement.customData as TableCustomData | undefined;
  const targetRow = targetData?.row !== undefined ? targetData.row : rows - 1;
  const targetCol = targetData?.col !== undefined ? targetData.col : cols - 1;

  const firstCell = cells.get("0_0");
  const cellWidth = firstCell?.width || (border ? border.width / cols : 80);
  const cellHeight = firstCell?.height || (border ? border.height / rows : 40);

  return {
    tableId,
    border,
    cells,
    texts,
    rows,
    cols,
    targetRow,
    targetCol,
    cellWidth,
    cellHeight,
    allTableElements,
  };
};

/**
 * Inserts a row into an existing table
 */
export const insertTableRow = (
  elements: readonly OrderedExcalidrawElement[],
  targetElement: ExcalidrawElement,
  position: "above" | "below",
  appState: AppState,
): { elements: OrderedExcalidrawElement[]; appState: AppState } => {
  const info = getTableStructure(elements, targetElement);
  if (!info || !info.border) {
    return { elements: elements as OrderedExcalidrawElement[], appState };
  }

  const {
    tableId,
    border,
    cells,
    texts,
    rows,
    cols,
    targetRow,
    cellWidth,
    cellHeight,
  } = info;

  const insertIndex = position === "above" ? targetRow : targetRow + 1;
  const newRows = rows + 1;

  // New elements to add
  const newElementsToAdd: NonDeleted<ExcalidrawElement>[] = [];
  const mutatedElementsMap = new Map<string, ExcalidrawElement>();

  // Shift rows below insertIndex down
  for (let r = rows - 1; r >= insertIndex; r--) {
    for (let c = 0; c < cols; c++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      const nextR = r + 1;

      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            y: cell.y + cellHeight,
            customData: {
              ...cell.customData,
              row: nextR,
              rows: newRows,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            y: text.y + cellHeight,
            customData: {
              ...text.customData,
              row: nextR,
              rows: newRows,
            },
          }),
        );
      }
    }
  }

  // Update rows for unchanged cells
  for (let r = 0; r < insertIndex; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            customData: {
              ...cell.customData,
              rows: newRows,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            customData: {
              ...text.customData,
              rows: newRows,
            },
          }),
        );
      }
    }
  }

  // Create new cells for the new row
  const rowY = border.y + insertIndex * cellHeight;
  for (let c = 0; c < cols; c++) {
    const cellX = border.x + c * cellWidth;

    const newCell = newElement({
      type: "rectangle",
      x: cellX,
      y: rowY,
      width: cellWidth,
      height: cellHeight,
      strokeColor: border.strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: border.opacity,
      roundness: null,
      locked: false,
      frameId: border.frameId,
      groupIds: [tableId],
      customData: {
        isTable: true,
        tableId,
        isTableCell: true,
        row: insertIndex,
        col: c,
        rows: newRows,
        cols,
      },
    }) as NonDeleted<ExcalidrawRectangleElement>;

    const newText = newTextElement({
      x: cellX + cellWidth / 2,
      y: rowY + cellHeight / 2,
      text: "",
      fontSize: appState.currentItemFontSize,
      fontFamily: appState.currentItemFontFamily,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: border.strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: border.opacity,
      roundness: null,
      locked: false,
      frameId: border.frameId,
      groupIds: [tableId],
      containerId: newCell.id,
      autoResize: true,
      customData: {
        isTable: true,
        tableId,
        isTableText: true,
        row: insertIndex,
        col: c,
        rows: newRows,
        cols,
      },
    }) as NonDeleted<ExcalidrawTextElement>;

    (newCell as any).boundElements = [{ type: "text", id: newText.id }];

    newElementsToAdd.push(newCell, newText);
  }

  // Update outer border height
  mutatedElementsMap.set(
    border.id,
    newElementWith(border, {
      height: border.height + cellHeight,
      customData: {
        ...border.customData,
        rows: newRows,
      },
    }),
  );

  const nextElements = elements.map((el) => {
    return mutatedElementsMap.get(el.id) || el;
  }) as OrderedExcalidrawElement[];

  return {
    elements: [...nextElements, ...(newElementsToAdd as OrderedExcalidrawElement[])],
    appState,
  };
};

/**
 * Inserts a column into an existing table
 */
export const insertTableColumn = (
  elements: readonly OrderedExcalidrawElement[],
  targetElement: ExcalidrawElement,
  position: "left" | "right",
  appState: AppState,
): { elements: OrderedExcalidrawElement[]; appState: AppState } => {
  const info = getTableStructure(elements, targetElement);
  if (!info || !info.border) {
    return { elements: elements as OrderedExcalidrawElement[], appState };
  }

  const {
    tableId,
    border,
    cells,
    texts,
    rows,
    cols,
    targetCol,
    cellWidth,
    cellHeight,
  } = info;

  const insertIndex = position === "left" ? targetCol : targetCol + 1;
  const newCols = cols + 1;

  const newElementsToAdd: NonDeleted<ExcalidrawElement>[] = [];
  const mutatedElementsMap = new Map<string, ExcalidrawElement>();

  // Shift columns to the right of insertIndex
  for (let c = cols - 1; c >= insertIndex; c--) {
    for (let r = 0; r < rows; r++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      const nextC = c + 1;

      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            x: cell.x + cellWidth,
            customData: {
              ...cell.customData,
              col: nextC,
              cols: newCols,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            x: text.x + cellWidth,
            customData: {
              ...text.customData,
              col: nextC,
              cols: newCols,
            },
          }),
        );
      }
    }
  }

  // Update cols for unchanged cells
  for (let c = 0; c < insertIndex; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            customData: {
              ...cell.customData,
              cols: newCols,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            customData: {
              ...text.customData,
              cols: newCols,
            },
          }),
        );
      }
    }
  }

  // Create new cells for the new column
  const colX = border.x + insertIndex * cellWidth;
  for (let r = 0; r < rows; r++) {
    const cellY = border.y + r * cellHeight;

    const newCell = newElement({
      type: "rectangle",
      x: colX,
      y: cellY,
      width: cellWidth,
      height: cellHeight,
      strokeColor: border.strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: border.opacity,
      roundness: null,
      locked: false,
      frameId: border.frameId,
      groupIds: [tableId],
      customData: {
        isTable: true,
        tableId,
        isTableCell: true,
        row: r,
        col: insertIndex,
        rows,
        cols: newCols,
      },
    }) as NonDeleted<ExcalidrawRectangleElement>;

    const newText = newTextElement({
      x: colX + cellWidth / 2,
      y: cellY + cellHeight / 2,
      text: "",
      fontSize: appState.currentItemFontSize,
      fontFamily: appState.currentItemFontFamily,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: border.strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: border.opacity,
      roundness: null,
      locked: false,
      frameId: border.frameId,
      groupIds: [tableId],
      containerId: newCell.id,
      autoResize: true,
      customData: {
        isTable: true,
        tableId,
        isTableText: true,
        row: r,
        col: insertIndex,
        rows,
        cols: newCols,
      },
    }) as NonDeleted<ExcalidrawTextElement>;

    (newCell as any).boundElements = [{ type: "text", id: newText.id }];

    newElementsToAdd.push(newCell, newText);
  }

  // Update outer border width
  mutatedElementsMap.set(
    border.id,
    newElementWith(border, {
      width: border.width + cellWidth,
      customData: {
        ...border.customData,
        cols: newCols,
      },
    }),
  );

  const nextElements = elements.map((el) => {
    return mutatedElementsMap.get(el.id) || el;
  }) as OrderedExcalidrawElement[];

  return {
    elements: [...nextElements, ...(newElementsToAdd as OrderedExcalidrawElement[])],
    appState,
  };
};

/**
 * Deletes a row from an existing table
 */
export const deleteTableRow = (
  elements: readonly OrderedExcalidrawElement[],
  targetElement: ExcalidrawElement,
  appState: AppState,
): { elements: OrderedExcalidrawElement[]; appState: AppState } => {
  const info = getTableStructure(elements, targetElement);
  if (!info || !info.border || info.rows <= 1) {
    return { elements: elements as OrderedExcalidrawElement[], appState };
  }

  const {
    border,
    cells,
    texts,
    rows,
    cols,
    targetRow,
    cellHeight,
  } = info;

  const newRows = rows - 1;
  const deletedIds = new Set<string>();
  const mutatedElementsMap = new Map<string, ExcalidrawElement>();

  // Mark target row cells and texts as deleted
  for (let c = 0; c < cols; c++) {
    const cell = cells.get(`${targetRow}_${c}`);
    const text = texts.get(`${targetRow}_${c}`);
    if (cell) {
      deletedIds.add(cell.id);
    }
    if (text) {
      deletedIds.add(text.id);
    }
  }

  // Shift rows below targetRow up
  for (let r = targetRow + 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      const nextR = r - 1;

      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            y: cell.y - cellHeight,
            customData: {
              ...cell.customData,
              row: nextR,
              rows: newRows,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            y: text.y - cellHeight,
            customData: {
              ...text.customData,
              row: nextR,
              rows: newRows,
            },
          }),
        );
      }
    }
  }

  // Update unchanged rows above targetRow
  for (let r = 0; r < targetRow; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            customData: {
              ...cell.customData,
              rows: newRows,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            customData: {
              ...text.customData,
              rows: newRows,
            },
          }),
        );
      }
    }
  }

  // Update border height
  mutatedElementsMap.set(
    border.id,
    newElementWith(border, {
      height: Math.max(cellHeight, border.height - cellHeight),
      customData: {
        ...border.customData,
        rows: newRows,
      },
    }),
  );

  const nextElements = elements
    .filter((el) => !deletedIds.has(el.id))
    .map((el) => mutatedElementsMap.get(el.id) || el) as OrderedExcalidrawElement[];

  return {
    elements: nextElements,
    appState,
  };
};

/**
 * Deletes a column from an existing table
 */
export const deleteTableColumn = (
  elements: readonly OrderedExcalidrawElement[],
  targetElement: ExcalidrawElement,
  appState: AppState,
): { elements: OrderedExcalidrawElement[]; appState: AppState } => {
  const info = getTableStructure(elements, targetElement);
  if (!info || !info.border || info.cols <= 1) {
    return { elements: elements as OrderedExcalidrawElement[], appState };
  }

  const {
    border,
    cells,
    texts,
    rows,
    cols,
    targetCol,
    cellWidth,
  } = info;

  const newCols = cols - 1;
  const deletedIds = new Set<string>();
  const mutatedElementsMap = new Map<string, ExcalidrawElement>();

  // Mark target column cells and texts as deleted
  for (let r = 0; r < rows; r++) {
    const cell = cells.get(`${r}_${targetCol}`);
    const text = texts.get(`${r}_${targetCol}`);
    if (cell) {
      deletedIds.add(cell.id);
    }
    if (text) {
      deletedIds.add(text.id);
    }
  }

  // Shift columns to the right of targetCol left
  for (let c = targetCol + 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      const nextC = c - 1;

      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            x: cell.x - cellWidth,
            customData: {
              ...cell.customData,
              col: nextC,
              cols: newCols,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            x: text.x - cellWidth,
            customData: {
              ...text.customData,
              col: nextC,
              cols: newCols,
            },
          }),
        );
      }
    }
  }

  // Update unchanged columns
  for (let c = 0; c < targetCol; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = cells.get(`${r}_${c}`);
      const text = texts.get(`${r}_${c}`);
      if (cell) {
        mutatedElementsMap.set(
          cell.id,
          newElementWith(cell, {
            customData: {
              ...cell.customData,
              cols: newCols,
            },
          }),
        );
      }
      if (text) {
        mutatedElementsMap.set(
          text.id,
          newElementWith(text, {
            customData: {
              ...text.customData,
              cols: newCols,
            },
          }),
        );
      }
    }
  }

  // Update border width
  mutatedElementsMap.set(
    border.id,
    newElementWith(border, {
      width: Math.max(cellWidth, border.width - cellWidth),
      customData: {
        ...border.customData,
        cols: newCols,
      },
    }),
  );

  const nextElements = elements
    .filter((el) => !deletedIds.has(el.id))
    .map((el) => mutatedElementsMap.get(el.id) || el) as OrderedExcalidrawElement[];

  return {
    elements: nextElements,
    appState,
  };
};
