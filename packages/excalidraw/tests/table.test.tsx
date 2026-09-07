import { describe, it, expect } from "vitest";
import { Scene } from "@excalidraw/element";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import { getDefaultAppState } from "../appState";
import {
  createTableElements,
  syncTableLayout,
  insertTableRow,
  deleteTableRow,
  insertTableColumn,
  deleteTableColumn,
  isTableElement,
  getTableStructure,
} from "../table";
import type { AppState } from "../types";

describe("table functionality", () => {
  const defaultAppState: AppState = {
    ...getDefaultAppState(),
    width: 1000,
    height: 800,
    offsetTop: 0,
    offsetLeft: 0,
  };

  it("createTableElements creates properly structured cells with base dimensions", () => {
    const tableElements = createTableElements({
      x: 100,
      y: 100,
      width: 300,
      height: 150,
      rows: 3,
      cols: 3,
      appState: defaultAppState,
    });

    expect(tableElements.length).toBe(9);

    const firstCell = tableElements[0];
    expect(isTableElement(firstCell)).toBe(true);
    expect(firstCell.customData?.rows).toBe(3);
    expect(firstCell.customData?.cols).toBe(3);
    expect(firstCell.customData?.baseWidth).toBe(100);
    expect(firstCell.customData?.baseHeight).toBe(50);
    expect(firstCell.width).toBe(100);
    expect(firstCell.height).toBe(50);

    // Verify grid layout coordinates
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = tableElements.find(
          (el) =>
            el.customData?.row === r && el.customData?.col === c,
        );
        expect(cell).toBeDefined();
        expect(cell!.x).toBeCloseTo(100 + c * 100);
        expect(cell!.y).toBeCloseTo(100 + r * 50);
        expect(cell!.width).toBeCloseTo(100);
        expect(cell!.height).toBeCloseTo(50);
      }
    }
  });

  it("syncTableLayout synchronizes row heights and shifts lower rows when a cell expands (video issue fix)", () => {
    const tableElements = createTableElements({
      x: 100,
      y: 100,
      width: 300,
      height: 120, // 3 rows of 40px each
      rows: 3,
      cols: 3,
      appState: defaultAppState,
    });

    const scene = new Scene(tableElements as OrderedExcalidrawElement[], {
      skipValidation: true,
    });

    // Find cell (1, 0) (row 1, col 0)
    const cell_1_0 = tableElements.find(
      (el) => el.customData?.row === 1 && el.customData?.col === 0,
    )!;

    // Simulate multi-line text expansion in cell (1, 0): target height becomes 80px
    const changed = syncTableLayout(cell_1_0, scene, {
      targetCellId: cell_1_0.id,
      targetCellHeight: 80,
    });

    expect(changed).toBe(true);

    const updatedElements = scene.getNonDeletedElements();

    // Check Row 0 cells (should remain at original y: 100 and height: 40)
    for (let c = 0; c < 3; c++) {
      const cell = updatedElements.find(
        (el) => el.customData?.row === 0 && el.customData?.col === c,
      )!;
      expect(cell.y).toBeCloseTo(100);
      expect(cell.height).toBeCloseTo(40);
    }

    // Check Row 1 cells: ALL 3 cells in row 1 must now have height = 80!
    for (let c = 0; c < 3; c++) {
      const cell = updatedElements.find(
        (el) => el.customData?.row === 1 && el.customData?.col === c,
      )!;
      expect(cell.y).toBeCloseTo(140); // 100 + 40
      expect(cell.height).toBeCloseTo(80); // Synchronized row height
    }

    // Check Row 2 cells: must shift down by 40px so y = 140 + 80 = 220!
    for (let c = 0; c < 3; c++) {
      const cell = updatedElements.find(
        (el) => el.customData?.row === 2 && el.customData?.col === c,
      )!;
      expect(cell.y).toBeCloseTo(220); // 140 + 80
      expect(cell.height).toBeCloseTo(40); // original height
    }

    // Verify row 1 bottom and row 2 top coincide exactly (NO OVERLAP, NO GAP)
    const row1_col0 = updatedElements.find(
      (el) => el.customData?.row === 1 && el.customData?.col === 0,
    )!;
    const row2_col0 = updatedElements.find(
      (el) => el.customData?.row === 2 && el.customData?.col === 0,
    )!;
    expect(row1_col0.y + row1_col0.height).toBeCloseTo(row2_col0.y);

    const row1_col2 = updatedElements.find(
      (el) => el.customData?.row === 1 && el.customData?.col === 2,
    )!;
    const row2_col2 = updatedElements.find(
      (el) => el.customData?.row === 2 && el.customData?.col === 2,
    )!;
    expect(row1_col2.y + row1_col2.height).toBeCloseTo(row2_col2.y);
  });

  it("syncTableLayout shrinks row and pulls lower rows up when text is removed", () => {
    const tableElements = createTableElements({
      x: 100,
      y: 100,
      width: 300,
      height: 120, // 40px per row
      rows: 3,
      cols: 3,
      appState: defaultAppState,
    });

    const scene = new Scene(tableElements as OrderedExcalidrawElement[], {
      skipValidation: true,
    });
    const cell_1_0 = tableElements.find(
      (el) => el.customData?.row === 1 && el.customData?.col === 0,
    )!;

    // Expand to 90px
    syncTableLayout(cell_1_0, scene, {
      targetCellId: cell_1_0.id,
      targetCellHeight: 90,
    });

    let updatedElements = scene.getNonDeletedElements();
    let row2_cell = updatedElements.find(
      (el) => el.customData?.row === 2 && el.customData?.col === 0,
    )!;
    expect(row2_cell.y).toBeCloseTo(100 + 40 + 90); // 230

    // Shrink back to base height (40px)
    syncTableLayout(cell_1_0, scene, {
      targetCellId: cell_1_0.id,
      targetCellHeight: 40,
    });

    updatedElements = scene.getNonDeletedElements();
    const row1_cell = updatedElements.find(
      (el) => el.customData?.row === 1 && el.customData?.col === 0,
    )!;
    expect(row1_cell.height).toBeCloseTo(40);

    row2_cell = updatedElements.find(
      (el) => el.customData?.row === 2 && el.customData?.col === 0,
    )!;
    expect(row2_cell.y).toBeCloseTo(100 + 40 + 40); // 180 (original position)
  });

  it("insertTableRow and deleteTableRow maintain exact contiguous alignment", () => {
    const tableElements = createTableElements({
      x: 50,
      y: 50,
      width: 300,
      height: 120, // 3 rows, 40px each
      rows: 3,
      cols: 3,
      appState: defaultAppState,
    }) as OrderedExcalidrawElement[];

    const targetCell = tableElements[0];
    const insertResult = insertTableRow(tableElements, targetCell, "below", defaultAppState);

    // Should now have 4 rows x 3 cols = 12 cells
    expect(insertResult.elements.length).toBe(12);

    const info = getTableStructure(insertResult.elements, targetCell);
    expect(info?.rows).toBe(4);
    expect(info?.cols).toBe(3);

    // Verify every row starts exactly where the previous row ends
    for (let r = 0; r < 3; r++) {
      const currentRowCell = insertResult.elements.find(
        (el) => el.customData?.row === r && el.customData?.col === 0,
      )!;
      const nextRowCell = insertResult.elements.find(
        (el) => el.customData?.row === r + 1 && el.customData?.col === 0,
      )!;
      expect(currentRowCell.y + currentRowCell.height).toBeCloseTo(nextRowCell.y);
    }

    // Now delete a row
    const deleteResult = deleteTableRow(insertResult.elements, targetCell, defaultAppState);
    expect(deleteResult.elements.length).toBe(9);
    const deleteInfo = getTableStructure(deleteResult.elements, deleteResult.elements[0]);
    expect(deleteInfo?.rows).toBe(3);
  });

  it("insertTableColumn and deleteTableColumn maintain contiguous horizontal layout", () => {
    const tableElements = createTableElements({
      x: 0,
      y: 0,
      width: 300,
      height: 150,
      rows: 3,
      cols: 3,
      appState: defaultAppState,
    }) as OrderedExcalidrawElement[];

    const targetCell = tableElements[0];
    const insertResult = insertTableColumn(tableElements, targetCell, "right", defaultAppState);

    // Should now have 3 rows x 4 cols = 12 cells
    expect(insertResult.elements.length).toBe(12);

    // Verify columns tile horizontally without gap or overlap
    for (let c = 0; c < 3; c++) {
      const currentColCell = insertResult.elements.find(
        (el) => el.customData?.row === 0 && el.customData?.col === c,
      )!;
      const nextColCell = insertResult.elements.find(
        (el) => el.customData?.row === 0 && el.customData?.col === c + 1,
      )!;
      expect(currentColCell.x + currentColCell.width).toBeCloseTo(nextColCell.x);
    }

    // Delete a column
    const deleteResult = deleteTableColumn(insertResult.elements, targetCell, defaultAppState);
    expect(deleteResult.elements.length).toBe(9);
    const deleteInfo = getTableStructure(deleteResult.elements, deleteResult.elements[0]);
    expect(deleteInfo?.cols).toBe(3);
  });

  it("handles sequential edits across multiple cells in the same row (dwelle video scenario)", () => {
    const tableElements = createTableElements({
      x: 0,
      y: 0,
      width: 300,
      height: 120, // 40px per row
      rows: 3,
      cols: 3,
      appState: defaultAppState,
    });

    const scene = new Scene(tableElements as OrderedExcalidrawElement[], {
      skipValidation: true,
    });

    const cell_1_0 = tableElements.find(
      (el) => el.customData?.row === 1 && el.customData?.col === 0,
    )!;
    const cell_1_1 = tableElements.find(
      (el) => el.customData?.row === 1 && el.customData?.col === 1,
    )!;

    // Step 1: User types in cell (1, 0) -> height expands to 60px
    syncTableLayout(cell_1_0, scene, {
      targetCellId: cell_1_0.id,
      targetCellHeight: 60,
    });

    let elements = scene.getNonDeletedElements();
    for (let c = 0; c < 3; c++) {
      const cell = elements.find(
        (el) => el.customData?.row === 1 && el.customData?.col === c,
      )!;
      expect(cell.height).toBeCloseTo(60);
    }

    // Step 2: User types in cell (1, 1) -> height expands to 75px
    syncTableLayout(cell_1_1, scene, {
      targetCellId: cell_1_1.id,
      targetCellHeight: 75,
    });

    elements = scene.getNonDeletedElements();
    for (let c = 0; c < 3; c++) {
      const cell = elements.find(
        (el) => el.customData?.row === 1 && el.customData?.col === c,
      )!;
      expect(cell.height).toBeCloseTo(75);
    }

    // Row 2 cells should be at y = 40 + 75 = 115
    for (let c = 0; c < 3; c++) {
      const cell = elements.find(
        (el) => el.customData?.row === 2 && el.customData?.col === c,
      )!;
      expect(cell.y).toBeCloseTo(115);
      expect(cell.height).toBeCloseTo(40);
    }
  });
});
