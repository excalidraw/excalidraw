import React from "react";
import { vi } from "vitest";

import { reseed } from "@excalidraw/common";

import { ShapeCache, mutateElement } from "@excalidraw/element";

import type { ExcalidrawTableElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import * as InteractiveScene from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";
import * as restore from "../data/restore";
import {
  actionAddTableRow,
  actionAddTableColumn,
  actionDeleteTableRow,
  actionDeleteTableColumn,
  actionChangeTextAlign,
  actionChangeVerticalAlign,
  actionToggleTableRowAutoResize,
} from "../actions";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { render, fireEvent, unmountComponent, act } from "./test-utils";

unmountComponent();

const renderInteractiveScene = vi.spyOn(
  InteractiveScene,
  "renderInteractiveScene",
);
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

beforeEach(() => {
  localStorage.clear();
  renderInteractiveScene.mockClear();
  renderStaticScene.mockClear();
  reseed(7);
});

const { h } = window;

const sum = (values: readonly number[]) =>
  values.reduce((acc, value) => acc + value, 0);

describe("table element", () => {
  it("drag-creates a default 3x3 table sized to the drag rectangle", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);

    fireEvent.click(getByToolName("table"));

    const canvas = container.querySelector("canvas.interactive")!;

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(canvas);

    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);

    const table = h.elements[0] as ExcalidrawTableElement;
    expect(table.type).toEqual("table");
    expect(table.x).toEqual(30);
    expect(table.y).toEqual(20);
    expect(table.width).toEqual(30); // 60 - 30
    expect(table.height).toEqual(50); // 70 - 20
    expect(table.rows).toEqual(3);
    expect(table.cols).toEqual(3);

    // grid invariants
    expect(table.columnWidths.length).toEqual(table.cols);
    expect(table.rowHeights.length).toEqual(table.rows);
    expect(table.cells.length).toEqual(table.rows);
    table.cells.forEach((row) => expect(row.length).toEqual(table.cols));

    // column widths / row heights sum to the element size
    expect(sum(table.columnWidths)).toBeCloseTo(table.width);
    expect(sum(table.rowHeights)).toBeCloseTo(table.height);

    expect(table).toMatchSnapshot();
  });

  it("does not add a table when the drag is too small", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);

    fireEvent.click(getByToolName("table"));

    const canvas = container.querySelector("canvas.interactive")!;

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(0);
  });

  it("rescales the grid proportionally on resize", async () => {
    await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    const before = table.get();
    expect(before.width).toEqual(300);
    expect(sum(before.columnWidths)).toBeCloseTo(300);
    expect(sum(before.rowHeights)).toBeCloseTo(150);

    // double the width and height via the bottom-right handle
    UI.resize(table.get(), "se", [300, 150]);

    const after = table.get();
    expect(after.width).toBeCloseTo(600);
    expect(after.height).toBeCloseTo(300);
    // grid still sums to the (new) element size
    expect(sum(after.columnWidths)).toBeCloseTo(after.width);
    expect(sum(after.rowHeights)).toBeCloseTo(after.height);
  });

  it("restores a table with missing fields by filling defaults (migration)", async () => {
    // a hand-authored / older table element missing columnWidths/rowHeights/cells
    const partial = {
      type: "table",
      id: "table-partial",
      x: 10,
      y: 10,
      width: 300,
      height: 120,
      rows: 2,
      cols: 3,
    } as any;

    const [restored] = restore.restoreElements([partial], null);

    expect(restored.type).toEqual("table");
    const table = restored as ExcalidrawTableElement;
    expect(table.rows).toEqual(2);
    expect(table.cols).toEqual(3);
    expect(table.columnWidths.length).toEqual(3);
    expect(table.rowHeights.length).toEqual(2);
    expect(sum(table.columnWidths)).toBeCloseTo(300);
    expect(sum(table.rowHeights)).toBeCloseTo(120);
    expect(table.cells.length).toEqual(2);
    table.cells.forEach((row) => {
      expect(row.length).toEqual(3);
      row.forEach((cell) => {
        expect(cell.text).toEqual("");
        expect(cell.textAlign).toEqual("left");
        expect(cell.verticalAlign).toEqual("top");
      });
    });
  });

  it("preserves existing cell text on restore round-trip", async () => {
    const original = API.createElement({
      type: "table",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      rows: 2,
      cols: 2,
    });
    const withText: ExcalidrawTableElement = {
      ...original,
      cells: [
        [
          { text: "A1", textAlign: "left", verticalAlign: "top" },
          { text: "B1", textAlign: "center", verticalAlign: "middle" },
        ],
        [
          { text: "A2", textAlign: "right", verticalAlign: "bottom" },
          { text: "", textAlign: "left", verticalAlign: "top" },
        ],
      ],
    };

    const [restored] = restore.restoreElements([withText], null);
    const table = restored as ExcalidrawTableElement;

    expect(table.cells[0][0].text).toEqual("A1");
    expect(table.cells[0][1].text).toEqual("B1");
    expect(table.cells[0][1].textAlign).toEqual("center");
    expect(table.cells[1][0].text).toEqual("A2");
    expect(table.cells[1][0].verticalAlign).toEqual("bottom");
  });

  it("edits a cell's text via the inline editor on double-click", async () => {
    const { container } = await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    const canvas = container.querySelector("canvas.interactive")!;

    // double-click roughly in the middle cell (col 1, row 1) of a 3x3 table
    fireEvent.dblClick(canvas, { clientX: 150, clientY: 75 });

    const editor = document.querySelector<HTMLTextAreaElement>(
      "[data-testid='table-cell-editor']",
    );
    expect(editor).not.toBeNull();

    act(() => {
      editor!.value = "hello";
      fireEvent.input(editor!, { target: { value: "hello" } });
      editor!.blur();
    });

    const updated = table.get();
    const hasText = updated.cells.flat().some((cell) => cell.text === "hello");
    expect(hasText).toBe(true);
  });

  it("invalidates the cached shape/canvas when cell text changes", async () => {
    await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    const element = table.get();
    const elementsMap = h.app.scene.getNonDeletedElementsMap();
    ShapeCache.generateElementShape(element, null);
    expect(ShapeCache.get(element, null)).not.toBeUndefined();

    const nextCells = element.cells.map((row, r) =>
      row.map((cell, c) =>
        r === 0 && c === 0 ? { ...cell, text: "x" } : cell,
      ),
    );
    // low-level mutate (no re-render) so we can observe the cache drop directly
    mutateElement(element, elementsMap, { cells: nextCells });

    // mutating cells must drop the cached shape so the new text re-renders
    expect(ShapeCache.get(element, null)).toBeUndefined();
  });

  it("adds and removes rows via actions, growing/shrinking height", async () => {
    await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    API.setSelectedElements([table.get()]);
    const before = table.get();

    API.executeAction(actionAddTableRow);
    let after = table.get();
    expect(after.rows).toEqual(before.rows + 1);
    expect(after.rowHeights.length).toEqual(before.rows + 1);
    expect(after.cells.length).toEqual(before.rows + 1);
    expect(after.cells[after.rows - 1].length).toEqual(after.cols);
    expect(after.height).toBeGreaterThan(before.height);

    API.setSelectedElements([table.get()]);
    API.executeAction(actionDeleteTableRow);
    after = table.get();
    expect(after.rows).toEqual(before.rows);
    expect(after.height).toBeCloseTo(before.height);
  });

  it("adds and removes columns via actions, growing/shrinking width", async () => {
    await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    API.setSelectedElements([table.get()]);
    const before = table.get();

    API.executeAction(actionAddTableColumn);
    let after = table.get();
    expect(after.cols).toEqual(before.cols + 1);
    expect(after.columnWidths.length).toEqual(before.cols + 1);
    after.cells.forEach((row) => expect(row.length).toEqual(before.cols + 1));
    expect(after.width).toBeGreaterThan(before.width);

    API.setSelectedElements([table.get()]);
    API.executeAction(actionDeleteTableColumn);
    after = table.get();
    expect(after.cols).toEqual(before.cols);
    expect(after.width).toBeCloseTo(before.width);
  });

  it("does not delete the last remaining row/column", async () => {
    await render(<Excalidraw />);

    const table = API.createElement({
      type: "table",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rows: 1,
      cols: 1,
    });
    API.setElements([table]);
    API.setSelectedElements([table]);

    API.executeAction(actionDeleteTableRow);
    API.executeAction(actionDeleteTableColumn);

    const after = h.elements[0] as ExcalidrawTableElement;
    expect(after.rows).toEqual(1);
    expect(after.cols).toEqual(1);
  });

  it("auto-grows a row to fit multi-line cell text on commit", async () => {
    const { container } = await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    // capture primitives up front (the proxy reflects live mutations)
    const beforeHeight = table.get().height;
    const beforeRow0 = table.get().rowHeights[0];
    const beforeRow1 = table.get().rowHeights[1];
    const beforeColumnWidths = [...table.get().columnWidths];

    const canvas = container.querySelector("canvas.interactive")!;
    // edit the top-left cell (col 0, row 0)
    fireEvent.dblClick(canvas, { clientX: 50, clientY: 25 });
    const editor = document.querySelector<HTMLTextAreaElement>(
      "[data-testid='table-cell-editor']",
    );
    expect(editor).not.toBeNull();

    act(() => {
      const value = "a\nb\nc\nd";
      editor!.value = value;
      fireEvent.input(editor!, { target: { value } });
      editor!.blur();
    });

    const after = table.get();
    // the edited row grew to fit four lines...
    expect(after.rowHeights[0]).toBeGreaterThan(beforeRow0);
    // ...other rows are untouched, columns unchanged...
    expect(after.rowHeights[1]).toBeCloseTo(beforeRow1);
    expect(after.columnWidths).toEqual(beforeColumnWidths);
    // ...and the element height still equals the sum of row heights
    expect(sum(after.rowHeights)).toBeCloseTo(after.height);
    expect(after.height).toBeGreaterThan(beforeHeight);
  });

  it("toggles between fit-rows and fixed-row-height (clip) modes", async () => {
    const { container } = await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    // tables default to auto-resize (fit) mode
    expect(table.get().autoResizeRows).toBe(true);

    // switch to fixed-row-height (clip) mode
    API.setSelectedElements([table.get()]);
    API.executeAction(actionToggleTableRowAutoResize);
    expect(table.get().autoResizeRows).toBe(false);

    const fixedHeight = table.get().height;
    const fixedRow0 = table.get().rowHeights[0];

    // editing a tall cell must NOT grow the row in fixed mode (text is clipped)
    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.dblClick(canvas, { clientX: 50, clientY: 25 });
    const editor = document.querySelector<HTMLTextAreaElement>(
      "[data-testid='table-cell-editor']",
    );
    act(() => {
      const value = "a\nb\nc\nd\ne";
      editor!.value = value;
      fireEvent.input(editor!, { target: { value } });
      editor!.blur();
    });
    expect(table.get().rowHeights[0]).toBeCloseTo(fixedRow0);
    expect(table.get().height).toBeCloseTo(fixedHeight);

    // switching back to fit mode re-grows rows to fit the existing text
    API.setSelectedElements([table.get()]);
    API.executeAction(actionToggleTableRowAutoResize);
    expect(table.get().autoResizeRows).toBe(true);
    expect(table.get().rowHeights[0]).toBeGreaterThan(fixedRow0);
  });

  it("centers cell text horizontally and vertically via actions", async () => {
    await render(<Excalidraw />);

    const table = UI.createElement("table", {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    }) as unknown as ExcalidrawTableElement & { get(): ExcalidrawTableElement };

    API.setSelectedElements([table.get()]);
    act(() => {
      h.app.actionManager.executeAction(actionChangeTextAlign, "api", "center");
    });

    API.setSelectedElements([table.get()]);
    act(() => {
      h.app.actionManager.executeAction(
        actionChangeVerticalAlign,
        "api",
        "middle",
      );
    });

    const after = table.get();
    const allCells = after.cells.flat();
    expect(allCells.every((cell) => cell.textAlign === "center")).toBe(true);
    expect(allCells.every((cell) => cell.verticalAlign === "middle")).toBe(
      true,
    );
  });
});
