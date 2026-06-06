import React from "react";
import { vi } from "vitest";

import { reseed } from "@excalidraw/common";

import type { ExcalidrawTableElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import * as InteractiveScene from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";
import * as restore from "../data/restore";

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
});
