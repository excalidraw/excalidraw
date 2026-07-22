import React from "react";
import {
  newElement,
  newTextElement,
  newElementWith,
  CaptureUpdateAction,
  Scene,
} from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import { randomId } from "@excalidraw/common";
import { register } from "./register";
import { t } from "../i18n";
import type { AppClassProperties, UIAppState, AppState } from "../types";

// Define a type for Table Cell elements that guarantees customData structure
export type TableCellElement = ExcalidrawElement & {
  customData: {
    isTableCell: boolean;
    tableId: string;
    row: number;
    col: number;
  };
};

export type TableCellTextElement = ExcalidrawTextElement & {
  customData: {
    isTableCellText: boolean;
    tableId: string;
    row: number;
    col: number;
  };
};

// --- Icons ---

const InsertRowAboveIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <line x1="3" y1="16" x2="21" y2="16" />
    <path d="M12 2v6m-3-3l3-3 3 3" />
  </svg>
);

const InsertRowBelowIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="10" rx="2" />
    <line x1="3" y1="8" x2="21" y2="8" />
    <path d="M12 22v-6m-3 3l3 3 3-3" />
  </svg>
);

const InsertColLeftIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="11" y="3" width="10" height="18" rx="2" />
    <line x1="16" y1="3" x2="16" y2="21" />
    <path d="M2 12h6M5 9l-3 3 3 3" />
  </svg>
);

const InsertColRightIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="10" height="18" rx="2" />
    <line x1="8" y1="3" x2="8" y2="21" />
    <path d="M22 12h-6m3-3l3 3-3 3" />
  </svg>
);

const DeleteRowIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="8" y1="7" x2="16" y2="15" stroke="red" strokeWidth="2.5" />
    <line x1="16" y1="7" x2="8" y2="15" stroke="red" strokeWidth="2.5" />
  </svg>
);

const DeleteColIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="7" y1="8" x2="17" y2="16" stroke="red" strokeWidth="2.5" />
    <line x1="17" y1="8" x2="7" y2="16" stroke="red" strokeWidth="2.5" />
  </svg>
);

// --- Helpers ---

export const getSelectedTableCellElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState | UIAppState,
): TableCellElement[] => {
  const selectedIds = appState.selectedElementIds;
  return elements.filter(
    (el) => !el.isDeleted && el.type === "rectangle" && el.customData?.isTableCell && selectedIds[el.id]
  ) as TableCellElement[];
};

export const getTableLayout = (
  x0: number,
  y0: number,
  colWidths: number[],
  rowHeights: number[],
) => {
  const cellX = (c: number) => {
    let offset = 0;
    for (let i = 0; i < c; i++) offset += colWidths[i];
    return x0 + offset;
  };
  const cellY = (r: number) => {
    let offset = 0;
    for (let i = 0; i < r; i++) offset += rowHeights[i];
    return y0 + offset;
  };
  return { cellX, cellY };
};

export const createTableElements = (
  x0: number,
  y0: number,
  rows: number,
  cols: number,
  colWidth = 120,
  rowHeight = 40,
  styles?: Partial<ExcalidrawElement>,
) => {
  const tableId = randomId();
  const tableElements: ExcalidrawElement[] = [];

  const colWidths = Array(cols).fill(colWidth);
  const rowHeights = Array(rows).fill(rowHeight);
  const { cellX, cellY } = getTableLayout(x0, y0, colWidths, rowHeights);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = newElement({
        type: "rectangle",
        x: cellX(c),
        y: cellY(r),
        width: colWidths[c],
        height: rowHeights[r],
        strokeColor: styles?.strokeColor || "#1e1e1e",
        backgroundColor: styles?.backgroundColor || "transparent",
        fillStyle: styles?.fillStyle || "solid",
        strokeWidth: styles?.strokeWidth || 1,
        strokeStyle: styles?.strokeStyle || "solid",
        roughness: styles?.roughness || 0,
        opacity: styles?.opacity || 100,
        roundness: styles?.roundness || null,
        groupIds: [tableId],
        customData: {
          isTableCell: true,
          tableId,
          row: r,
          col: c,
        },
      });

      const text = newTextElement({
        text: "",
        x: cell.x + cell.width / 2,
        y: cell.y + cell.height / 2 - 10,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: cell.id,
        strokeColor: styles?.strokeColor || "#1e1e1e",
        groupIds: [tableId],
        customData: {
          isTableCellText: true,
          tableId,
          row: r,
          col: c,
        },
      });

      Object.assign(cell, {
        boundElements: [{ type: "text", id: text.id }],
      });

      tableElements.push(cell, text);
    }
  }

  return tableElements;
};

export const replaceTableElements = <T extends ExcalidrawElement>(
  allElements: readonly T[],
  tableId: string,
  newTableElements: T[],
): T[] => {
  const firstIndex = allElements.findIndex(
    (el) => el.customData?.tableId === tableId,
  );
  const filtered = allElements.filter(
    (el) => el.customData?.tableId !== tableId,
  );

  if (firstIndex === -1) {
    return [...filtered, ...newTableElements];
  }

  const result = [...filtered];
  result.splice(firstIndex, 0, ...newTableElements);
  return result;
};

export const alignTableInElements = <T extends ExcalidrawElement>(
  elements: readonly T[],
  tableId: string,
  scene: Scene,
): T[] => {
  const tableElements = elements.filter(
    (el) => !el.isDeleted && el.customData?.tableId === tableId,
  );
  const cells = tableElements.filter(
    (el) => el.type === "rectangle" && el.customData?.isTableCell,
  ) as TableCellElement[];
  if (cells.length === 0) return [...elements];

  const R = Math.max(...cells.map((c) => c.customData.row)) + 1;
  const C = Math.max(...cells.map((c) => c.customData.col)) + 1;

  const grid: TableCellElement[][] = Array.from({ length: R }, () => Array(C));
  for (const cell of cells) {
    grid[cell.customData.row][cell.customData.col] = cell;
  }

  const colWidths = Array(C).fill(120);
  const rowHeights = Array(R).fill(40);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        colWidths[c] = cell.width;
        rowHeights[r] = cell.height;
      }
    }
  }

  let x0 = Infinity;
  let y0 = Infinity;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        x0 = Math.min(x0, cell.x);
        y0 = Math.min(y0, cell.y);
      }
    }
  }
  if (x0 === Infinity) x0 = 0;
  if (y0 === Infinity) y0 = 0;

  const { cellX, cellY } = getTableLayout(x0, y0, colWidths, rowHeights);

  return elements.map((el) => {
    if (el.customData?.tableId !== tableId || el.isDeleted) return el;

    if (el.type === "rectangle" && el.customData?.isTableCell) {
      const r = el.customData.row as number;
      const c = el.customData.col as number;

      return newElementWith(el as any, {
        x: cellX(c),
        y: cellY(r),
        width: colWidths[c],
        height: rowHeights[r],
      } as any) as T;
    }

    if (el.type === "text" && el.customData?.isTableCellText) {
      const r = el.customData.row as number;
      const c = el.customData.col as number;

      const targetX = cellX(c);
      const targetY = cellY(r);
      const targetW = colWidths[c];
      const targetH = rowHeights[r];

      const textElement = el as ExcalidrawTextElement;
      const textX = targetX + targetW / 2 - textElement.width / 2;
      const textY = targetY + targetH / 2 - textElement.height / 2;

      return newElementWith(el as any, {
        x: textX,
        y: textY,
      } as any) as T;
    }

    return el;
  });
};

// --- Actions Logic ---

const insertRowAt = <T extends ExcalidrawElement>(
  elements: readonly T[],
  tableId: string,
  rNew: number,
  scene: Scene,
): T[] => {
  const tableElements = elements.filter(
    (el) => !el.isDeleted && el.customData?.tableId === tableId,
  );
  const cells = tableElements.filter(
    (el) => el.type === "rectangle" && el.customData?.isTableCell,
  ) as TableCellElement[];
  if (cells.length === 0) return [...elements];

  const R = Math.max(...cells.map((c) => c.customData.row)) + 1;
  const C = Math.max(...cells.map((c) => c.customData.col)) + 1;

  const grid: TableCellElement[][] = Array.from({ length: R }, () => Array(C));
  for (const cell of cells) {
    grid[cell.customData.row][cell.customData.col] = cell;
  }

  const colWidths = Array(C).fill(120);
  const rowHeights = Array(R).fill(40);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        colWidths[c] = cell.width;
        rowHeights[r] = cell.height;
      }
    }
  }

  const templateRow = rNew > 0 ? rNew - 1 : 0;
  const newRowHeight = rowHeights[templateRow] || 40;
  rowHeights.splice(rNew, 0, newRowHeight);

  let x0 = Infinity;
  let y0 = Infinity;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        x0 = Math.min(x0, cell.x);
        y0 = Math.min(y0, cell.y);
      }
    }
  }
  if (x0 === Infinity) x0 = 0;
  if (y0 === Infinity) y0 = 0;

  const { cellX, cellY } = getTableLayout(x0, y0, colWidths, rowHeights);
  const templateCell = grid[templateRow]?.[0] || cells[0];
  const newCells: ExcalidrawElement[] = [];

  const updatedElements = elements.map((el) => {
    if (el.customData?.tableId !== tableId || el.isDeleted) return el;

    const oldRow = el.customData.row as number;
    const c = el.customData.col as number;
    const isText = el.type === "text" && el.customData?.isTableCellText;
    const isRect = el.type === "rectangle" && el.customData?.isTableCell;

    if (isRect || isText) {
      const nextRow = oldRow >= rNew ? oldRow + 1 : oldRow;
      const customData = { ...el.customData, row: nextRow };

      if (isRect) {
        return newElementWith(el as any, {
          x: cellX(c),
          y: cellY(nextRow),
          width: colWidths[c],
          height: rowHeights[nextRow],
          customData,
        } as any) as T;
      } else {
        const textElement = el as ExcalidrawTextElement;
        const textX = cellX(c) + colWidths[c] / 2 - textElement.width / 2;
        const textY = cellY(nextRow) + rowHeights[nextRow] / 2 - textElement.height / 2;
        return newElementWith(el as any, {
          x: textX,
          y: textY,
          customData,
        } as any) as T;
      }
    }
    return el;
  });

  for (let c = 0; c < C; c++) {
    const cell = newElement({
      type: "rectangle",
      x: cellX(c),
      y: cellY(rNew),
      width: colWidths[c],
      height: rowHeights[rNew],
      strokeColor: templateCell.strokeColor,
      backgroundColor: templateCell.backgroundColor,
      fillStyle: templateCell.fillStyle,
      strokeWidth: templateCell.strokeWidth,
      strokeStyle: templateCell.strokeStyle,
      roughness: templateCell.roughness,
      opacity: templateCell.opacity,
      roundness: templateCell.roundness,
      groupIds: [tableId],
      customData: {
        isTableCell: true,
        tableId,
        row: rNew,
        col: c,
      },
    });

    const text = newTextElement({
      text: "",
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height / 2 - 10,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: cell.id,
      strokeColor: templateCell.strokeColor,
      groupIds: [tableId],
      customData: {
        isTableCellText: true,
        tableId,
        row: rNew,
        col: c,
      },
    });

    Object.assign(cell, {
      boundElements: [{ type: "text", id: text.id }],
    });

    newCells.push(cell, text);
  }

  const shiftedTableElements = updatedElements.filter(
    (el) => el.customData?.tableId === tableId,
  ) as T[];
  const allNewTableElements = [...shiftedTableElements, ...newCells] as T[];
  return replaceTableElements(updatedElements, tableId, allNewTableElements);
};

const deleteRowAt = <T extends ExcalidrawElement>(
  elements: readonly T[],
  tableId: string,
  rDel: number,
  scene: Scene,
): T[] => {
  const tableElements = elements.filter(
    (el) => !el.isDeleted && el.customData?.tableId === tableId,
  );
  const cells = tableElements.filter(
    (el) => el.type === "rectangle" && el.customData?.isTableCell,
  ) as TableCellElement[];
  if (cells.length === 0) return [...elements];

  const R = Math.max(...cells.map((c) => c.customData.row)) + 1;
  const C = Math.max(...cells.map((c) => c.customData.col)) + 1;

  if (R <= 1) {
    return elements.map((el) => {
      if (el.customData?.tableId === tableId) {
        return newElementWith(el as any, { isDeleted: true } as any) as T;
      }
      return el;
    });
  }

  const grid: TableCellElement[][] = Array.from({ length: R }, () => Array(C));
  for (const cell of cells) {
    grid[cell.customData.row][cell.customData.col] = cell;
  }

  const colWidths = Array(C).fill(120);
  const rowHeights = Array(R).fill(40);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        colWidths[c] = cell.width;
        rowHeights[r] = cell.height;
      }
    }
  }

  rowHeights.splice(rDel, 1);

  let x0 = Infinity;
  let y0 = Infinity;
  for (let r = 0; r < R; r++) {
    if (r === rDel) continue;
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        x0 = Math.min(x0, cell.x);
        y0 = Math.min(y0, cell.y);
      }
    }
  }
  if (x0 === Infinity) x0 = 0;
  if (y0 === Infinity) y0 = 0;

  const { cellX, cellY } = getTableLayout(x0, y0, colWidths, rowHeights);

  return elements.map((el) => {
    if (el.customData?.tableId !== tableId) return el;

    const row = el.customData.row as number;
    const c = el.customData.col as number;

    if (row === rDel) {
      return newElementWith(el as any, { isDeleted: true } as any) as T;
    }

    const isText = el.type === "text" && el.customData?.isTableCellText;
    const isRect = el.type === "rectangle" && el.customData?.isTableCell;

    if (isRect || isText) {
      const nextRow = row > rDel ? row - 1 : row;
      const customData = { ...el.customData, row: nextRow };

      if (isRect) {
        return newElementWith(el as any, {
          x: cellX(c),
          y: cellY(nextRow),
          width: colWidths[c],
          height: rowHeights[nextRow],
          customData,
        } as any) as T;
      } else {
        const textElement = el as ExcalidrawTextElement;
        const textX = cellX(c) + colWidths[c] / 2 - textElement.width / 2;
        const textY = cellY(nextRow) + rowHeights[nextRow] / 2 - textElement.height / 2;
        return newElementWith(el as any, {
          x: textX,
          y: textY,
          customData,
        } as any) as T;
      }
    }
    return el;
  });
};

const insertColAt = <T extends ExcalidrawElement>(
  elements: readonly T[],
  tableId: string,
  cNew: number,
  scene: Scene,
): T[] => {
  const tableElements = elements.filter(
    (el) => !el.isDeleted && el.customData?.tableId === tableId,
  );
  const cells = tableElements.filter(
    (el) => el.type === "rectangle" && el.customData?.isTableCell,
  ) as TableCellElement[];
  if (cells.length === 0) return [...elements];

  const R = Math.max(...cells.map((c) => c.customData.row)) + 1;
  const C = Math.max(...cells.map((c) => c.customData.col)) + 1;

  const grid: TableCellElement[][] = Array.from({ length: R }, () => Array(C));
  for (const cell of cells) {
    grid[cell.customData.row][cell.customData.col] = cell;
  }

  const colWidths = Array(C).fill(120);
  const rowHeights = Array(R).fill(40);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        colWidths[c] = cell.width;
        rowHeights[r] = cell.height;
      }
    }
  }

  const templateCol = cNew > 0 ? cNew - 1 : 0;
  const newColWidth = colWidths[templateCol] || 120;
  colWidths.splice(cNew, 0, newColWidth);

  let x0 = Infinity;
  let y0 = Infinity;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        x0 = Math.min(x0, cell.x);
        y0 = Math.min(y0, cell.y);
      }
    }
  }
  if (x0 === Infinity) x0 = 0;
  if (y0 === Infinity) y0 = 0;

  const { cellX, cellY } = getTableLayout(x0, y0, colWidths, rowHeights);
  const templateCell = grid[0]?.[templateCol] || cells[0];
  const newCells: ExcalidrawElement[] = [];

  const updatedElements = elements.map((el) => {
    if (el.customData?.tableId !== tableId || el.isDeleted) return el;

    const r = el.customData.row as number;
    const oldCol = el.customData.col as number;
    const isText = el.type === "text" && el.customData?.isTableCellText;
    const isRect = el.type === "rectangle" && el.customData?.isTableCell;

    if (isRect || isText) {
      const nextCol = oldCol >= cNew ? oldCol + 1 : oldCol;
      const customData = { ...el.customData, col: nextCol };

      if (isRect) {
        return newElementWith(el as any, {
          x: cellX(nextCol),
          y: cellY(r),
          width: colWidths[nextCol],
          height: rowHeights[r],
          customData,
        } as any) as T;
      } else {
        const textElement = el as ExcalidrawTextElement;
        const textX = cellX(nextCol) + colWidths[nextCol] / 2 - textElement.width / 2;
        const textY = cellY(r) + rowHeights[r] / 2 - textElement.height / 2;
        return newElementWith(el as any, {
          x: textX,
          y: textY,
          customData,
        } as any) as T;
      }
    }
    return el;
  });

  for (let r = 0; r < R; r++) {
    const cell = newElement({
      type: "rectangle",
      x: cellX(cNew),
      y: cellY(r),
      width: colWidths[cNew],
      height: rowHeights[r],
      strokeColor: templateCell.strokeColor,
      backgroundColor: templateCell.backgroundColor,
      fillStyle: templateCell.fillStyle,
      strokeWidth: templateCell.strokeWidth,
      strokeStyle: templateCell.strokeStyle,
      roughness: templateCell.roughness,
      opacity: templateCell.opacity,
      roundness: templateCell.roundness,
      groupIds: [tableId],
      customData: {
        isTableCell: true,
        tableId,
        row: r,
        col: cNew,
      },
    });

    const text = newTextElement({
      text: "",
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height / 2 - 10,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: cell.id,
      strokeColor: templateCell.strokeColor,
      groupIds: [tableId],
      customData: {
        isTableCellText: true,
        tableId,
        row: r,
        col: cNew,
      },
    });

    Object.assign(cell, {
      boundElements: [{ type: "text", id: text.id }],
    });

    newCells.push(cell, text);
  }

  const shiftedTableElements = updatedElements.filter(
    (el) => el.customData?.tableId === tableId,
  ) as T[];
  const allNewTableElements = [...shiftedTableElements, ...newCells] as T[];
  return replaceTableElements(updatedElements, tableId, allNewTableElements);
};

const deleteColAt = <T extends ExcalidrawElement>(
  elements: readonly T[],
  tableId: string,
  cDel: number,
  scene: Scene,
): T[] => {
  const tableElements = elements.filter(
    (el) => !el.isDeleted && el.customData?.tableId === tableId,
  );
  const cells = tableElements.filter(
    (el) => el.type === "rectangle" && el.customData?.isTableCell,
  ) as TableCellElement[];
  if (cells.length === 0) return [...elements];

  const R = Math.max(...cells.map((c) => c.customData.row)) + 1;
  const C = Math.max(...cells.map((c) => c.customData.col)) + 1;

  if (C <= 1) {
    return elements.map((el) => {
      if (el.customData?.tableId === tableId) {
        return newElementWith(el as any, { isDeleted: true } as any) as T;
      }
      return el;
    });
  }

  const grid: TableCellElement[][] = Array.from({ length: R }, () => Array(C));
  for (const cell of cells) {
    grid[cell.customData.row][cell.customData.col] = cell;
  }

  const colWidths = Array(C).fill(120);
  const rowHeights = Array(R).fill(40);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = grid[r][c];
      if (cell) {
        colWidths[c] = cell.width;
        rowHeights[r] = cell.height;
      }
    }
  }

  colWidths.splice(cDel, 1);

  let x0 = Infinity;
  let y0 = Infinity;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (c === cDel) continue;
      const cell = grid[r][c];
      if (cell) {
        x0 = Math.min(x0, cell.x);
        y0 = Math.min(y0, cell.y);
      }
    }
  }
  if (x0 === Infinity) x0 = 0;
  if (y0 === Infinity) y0 = 0;

  const { cellX, cellY } = getTableLayout(x0, y0, colWidths, rowHeights);

  return elements.map((el) => {
    if (el.customData?.tableId !== tableId) return el;

    const r = el.customData.row as number;
    const col = el.customData.col as number;

    if (col === cDel) {
      return newElementWith(el as any, { isDeleted: true } as any) as T;
    }

    const isText = el.type === "text" && el.customData?.isTableCellText;
    const isRect = el.type === "rectangle" && el.customData?.isTableCell;

    if (isRect || isText) {
      const nextCol = col > cDel ? col - 1 : col;
      const customData = { ...el.customData, col: nextCol };

      if (isRect) {
        return newElementWith(el as any, {
          x: cellX(nextCol),
          y: cellY(r),
          width: colWidths[nextCol],
          height: rowHeights[r],
          customData,
        } as any) as T;
      } else {
        const textElement = el as ExcalidrawTextElement;
        const textX = cellX(nextCol) + colWidths[nextCol] / 2 - textElement.width / 2;
        const textY = cellY(r) + rowHeights[r] / 2 - textElement.height / 2;
        return newElementWith(el as any, {
          x: textX,
          y: textY,
          customData,
        } as any) as T;
      }
    }
    return el;
  });
};

// --- Actions Registrations ---

export const actionInsertRowAbove = register({
  name: "insertRowAbove",
  label: "labels.insertRowAbove",
  icon: <InsertRowAboveIcon />,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedCells = getSelectedTableCellElements(elements, appState);
    if (selectedCells.length === 0) return false;

    const targetCell = selectedCells[0];
    const tableId = targetCell.customData.tableId;
    const rSel = targetCell.customData.row;

    const newElements = insertRowAt(elements, tableId, rSel, app.scene);

    return {
      elements: newElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    return getSelectedTableCellElements(elements, appState).length > 0;
  },
});

export const actionInsertRowBelow = register({
  name: "insertRowBelow",
  label: "labels.insertRowBelow",
  icon: <InsertRowBelowIcon />,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedCells = getSelectedTableCellElements(elements, appState);
    if (selectedCells.length === 0) return false;

    const targetCell = selectedCells[0];
    const tableId = targetCell.customData.tableId;
    const rSel = targetCell.customData.row;

    const newElements = insertRowAt(elements, tableId, rSel + 1, app.scene);

    return {
      elements: newElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    return getSelectedTableCellElements(elements, appState).length > 0;
  },
});

export const actionInsertColLeft = register({
  name: "insertColLeft",
  label: "labels.insertColLeft",
  icon: <InsertColLeftIcon />,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedCells = getSelectedTableCellElements(elements, appState);
    if (selectedCells.length === 0) return false;

    const targetCell = selectedCells[0];
    const tableId = targetCell.customData.tableId;
    const cSel = targetCell.customData.col;

    const newElements = insertColAt(elements, tableId, cSel, app.scene);

    return {
      elements: newElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    return getSelectedTableCellElements(elements, appState).length > 0;
  },
});

export const actionInsertColRight = register({
  name: "insertColRight",
  label: "labels.insertColRight",
  icon: <InsertColRightIcon />,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedCells = getSelectedTableCellElements(elements, appState);
    if (selectedCells.length === 0) return false;

    const targetCell = selectedCells[0];
    const tableId = targetCell.customData.tableId;
    const cSel = targetCell.customData.col;

    const newElements = insertColAt(elements, tableId, cSel + 1, app.scene);

    return {
      elements: newElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    return getSelectedTableCellElements(elements, appState).length > 0;
  },
});

export const actionDeleteRow = register({
  name: "deleteRow",
  label: "labels.deleteRow",
  icon: <DeleteRowIcon />,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedCells = getSelectedTableCellElements(elements, appState);
    if (selectedCells.length === 0) return false;

    const targetCell = selectedCells[0];
    const tableId = targetCell.customData.tableId;
    const rSel = targetCell.customData.row;

    const newElements = deleteRowAt(elements, tableId, rSel, app.scene);

    const selectedElementIds = { ...appState.selectedElementIds };
    selectedCells.forEach((c) => {
      if (c.customData.row === rSel) delete selectedElementIds[c.id];
    });

    return {
      elements: newElements,
      appState: { ...appState, selectedElementIds },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    return getSelectedTableCellElements(elements, appState).length > 0;
  },
});

export const actionDeleteCol = register({
  name: "deleteCol",
  label: "labels.deleteCol",
  icon: <DeleteColIcon />,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedCells = getSelectedTableCellElements(elements, appState);
    if (selectedCells.length === 0) return false;

    const targetCell = selectedCells[0];
    const tableId = targetCell.customData.tableId;
    const cSel = targetCell.customData.col;

    const newElements = deleteColAt(elements, tableId, cSel, app.scene);

    const selectedElementIds = { ...appState.selectedElementIds };
    selectedCells.forEach((c) => {
      if (c.customData.col === cSel) delete selectedElementIds[c.id];
    });

    return {
      elements: newElements,
      appState: { ...appState, selectedElementIds },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) => {
    return getSelectedTableCellElements(elements, appState).length > 0;
  },
});
