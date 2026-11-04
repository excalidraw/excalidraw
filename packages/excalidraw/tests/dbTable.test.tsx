import React from "react";

import { KEYS, reseed } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import {
  getTableCellAtPoint,
  getTableLayout,
  getTransformHandles,
  isPointOnTableToggle,
  newTableElement,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawTableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { exportScene } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, fireEvent, render } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const getTable = (id: string) =>
  h.elements.find(
    (element) => element.id === id,
  ) as NonDeleted<ExcalidrawTableElement>;

const getEditorInputs = () =>
  [
    ...document.querySelectorAll<HTMLInputElement>(
      ".excalidraw-table-editor__input",
    ),
  ] as HTMLInputElement[];

const getTitleInput = () =>
  document.querySelector<HTMLInputElement>(".excalidraw-table-editor__title")!;

const type = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } });
};

const createTable = (
  opts: Partial<Parameters<typeof newTableElement>[0]> = {},
) =>
  newTableElement({
    type: "table",
    x: 100,
    y: 100,
    backgroundColor: "#a5d8ff",
    ...opts,
  });

describe("table element", () => {
  beforeEach(async () => {
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  describe("layout", () => {
    it("derives its size from the content", () => {
      const table = createTable({
        title: "t",
        rows: [{ key: "PK", name: "id" }],
      });
      const layout = getTableLayout(table);
      expect(table.width).toBe(layout.width);
      expect(table.height).toBe(layout.height);

      const longName = createTable({
        title: "t",
        rows: [{ key: "PK", name: "a_very_long_column_name_indeed" }],
      });
      expect(longName.width).toBeGreaterThan(table.width);
      expect(longName.height).toBe(table.height);

      const moreRows = createTable({
        title: "t",
        rows: [
          { key: "PK", name: "id" },
          { key: "", name: "name" },
        ],
      });
      expect(moreRows.height).toBeGreaterThan(table.height);
      expect(moreRows.width).toBe(table.width);
    });

    it("keeps the title centered and clear of the toggle", () => {
      const table = createTable({ title: "a_long_table_name_here" });
      const layout = getTableLayout(table);
      expect(layout.title.x).toBeGreaterThan(
        layout.toggle.x + layout.toggle.width,
      );
      expect(layout.title.x + layout.title.width / 2).toBe(table.width / 2);
    });

    it("lays out a strict two-column body", () => {
      const table = createTable({
        rows: [
          { key: "PK", name: "id" },
          { key: "varchar", name: "email" },
        ],
      });
      const layout = getTableLayout(table);
      for (const row of layout.rows) {
        expect(row.key.x).toBe(0);
        expect(row.name.x).toBe(layout.keyColumnWidth);
        expect(row.key.width + row.name.width).toBe(table.width);
      }
    });

    it("shows only the header when collapsed", () => {
      const table = createTable({ collapsed: true });
      const layout = getTableLayout(table);
      expect(table.height).toBe(Math.ceil(layout.header.height));
      expect(layout.body).toBeNull();
      expect(layout.rows).toHaveLength(0);
    });

    it("scales with its font size", () => {
      const small = createTable({ fontSize: 20 });
      const large = createTable({ fontSize: 40 });
      expect(large.width / small.width).toBeCloseTo(2, 0);
      expect(large.height / small.height).toBeCloseTo(2, 0);
    });
  });

  describe("hit testing", () => {
    it("finds the toggle and the cells, also when rotated", () => {
      const table = createTable({
        rows: [{ key: "PK", name: "id" }],
      });
      const layout = getTableLayout(table);
      const toggleCenter = {
        x: table.x + layout.toggle.x + layout.toggle.width / 2,
        y: table.y + layout.toggle.y + layout.toggle.height / 2,
      };
      expect(isPointOnTableToggle(table, toggleCenter)).toBe(true);
      expect(
        isPointOnTableToggle(table, {
          x: table.x + table.width / 2,
          y: table.y + layout.header.height / 2,
        }),
      ).toBe(false);

      const [row] = layout.rows;
      expect(
        getTableCellAtPoint(table, {
          x: table.x + row.name.x + 5,
          y: table.y + row.name.y + 5,
        }),
      ).toEqual({ type: "name", rowId: row.row.id });
      expect(
        getTableCellAtPoint(table, {
          x: table.x + row.key.x + 5,
          y: table.y + row.key.y + 5,
        }),
      ).toEqual({ type: "key", rowId: row.row.id });

      // rotated half a turn, the toggle sits at the opposite corner
      const rotated = { ...table, angle: Math.PI } as typeof table;
      expect(
        isPointOnTableToggle(rotated, {
          x: table.x + table.width - (toggleCenter.x - table.x),
          y: table.y + table.height - (toggleCenter.y - table.y),
        }),
      ).toBe(true);
    });

    it("only offers the rotation handle (its size follows the content)", () => {
      const table = createTable();
      const handles = getTransformHandles(table, h.state.zoom, new Map());
      expect(
        Object.entries(handles)
          .filter(([, handle]) => handle)
          .map(([type]) => type),
      ).toEqual(["rotation"]);
    });
  });

  describe("tool and in-place editing", () => {
    it("places a table on click and starts editing its name", async () => {
      UI.clickTool("table");
      mouse.clickAt(200, 200);

      const [table] = h.elements as ExcalidrawTableElement[];
      expect(table.type).toBe("table");
      expect(table.x).toBe(200);
      expect(table.y).toBe(200);
      expect(h.state.editingTableId).toBe(table.id);
      expect(h.state.selectedElementIds).toEqual({ [table.id]: true });
      expect(h.state.activeTool.type).toBe("selection");

      await act(async () => {});
      expect(document.activeElement).toBe(getTitleInput());
    });

    it("grows the table as the user types and adds rows on Enter", async () => {
      const table = createTable({ rows: [{ key: "PK", name: "id" }] });
      API.setElements([table]);
      act(() => h.app.table.startEditing(table, { type: "title" }));
      await act(async () => {});

      const widthBefore = getTable(table.id).width;
      type(getTitleInput(), "a_much_longer_table_name_than_before");
      expect(getTable(table.id).title).toBe(
        "a_much_longer_table_name_than_before",
      );
      expect(getTable(table.id).width).toBeGreaterThan(widthBefore);

      const heightBefore = getTable(table.id).height;
      const nameInput = getEditorInputs().find((input) =>
        input.classList.contains("excalidraw-table-editor__name"),
      )!;
      Keyboard.keyPress(KEYS.ENTER, nameInput);
      await act(async () => {});
      expect(getTable(table.id).rows).toHaveLength(2);
      expect(getTable(table.id).height).toBeGreaterThan(heightBefore);

      // the new row is focused
      const focused = document.activeElement as HTMLInputElement;
      type(focused, "created_at");
      expect(getTable(table.id).rows[1].name).toBe("created_at");
    });

    it("drops untouched empty rows when editing finishes, as one undo step", async () => {
      const table = createTable({ rows: [{ key: "PK", name: "id" }] });
      API.setElements([table]);
      act(() => h.app.table.startEditing(table, { type: "title" }));
      await act(async () => {});

      type(getTitleInput(), "users");
      fireEvent.click(document.querySelector(".excalidraw-table-editor__add")!);
      await act(async () => {});
      expect(getTable(table.id).rows).toHaveLength(2);

      Keyboard.keyPress(KEYS.ESCAPE, document.activeElement as HTMLElement);
      await act(async () => {});
      expect(h.state.editingTableId).toBe(null);
      expect(getTable(table.id).rows).toHaveLength(1);
      expect(getTable(table.id).title).toBe("users");

      Keyboard.undo();
      expect(getTable(table.id).title).toBe(table.title);
    });

    it("edits the double-clicked cell", async () => {
      const table = createTable({
        rows: [
          { key: "PK", name: "id" },
          { key: "", name: "email" },
        ],
      });
      API.setElements([table]);
      const row = getTableLayout(table).rows[1];

      mouse.doubleClickAt(
        table.x + row.name.x + row.name.width / 2,
        table.y + row.name.y + row.name.height / 2,
      );
      await act(async () => {});

      expect(h.state.editingTableId).toBe(table.id);
      expect((document.activeElement as HTMLInputElement).value).toBe("email");
    });
  });

  describe("collapse toggle and bindings", () => {
    it("collapses on toggle click and keeps bound arrows attached", () => {
      const table = createTable({
        rows: [
          { key: "PK", name: "id" },
          { key: "", name: "name" },
          { key: "", name: "email" },
        ],
      });
      const arrow = API.createElement({
        type: "arrow",
        id: "arrow",
        x: table.x + table.width / 2,
        // pointing up at the bottom edge
        y: table.y + table.height + 100,
        width: 0,
        height: -100,
        points: [pointFrom(0, 0), pointFrom(0, -100)],
        endBinding: {
          elementId: table.id,
          fixedPoint: [0.5, 1],
          mode: "orbit",
        },
      });
      // (through the store, so that undo starts from this scene)
      act(() =>
        h.app.updateScene({
          elements: [
            { ...table, boundElements: [{ id: arrow.id, type: "arrow" }] },
            arrow,
          ],
          captureUpdate: CaptureUpdateAction.NEVER,
        }),
      );

      const endY = () => {
        const a = h.elements.find(
          (e) => e.id === "arrow",
        ) as ExcalidrawArrowElement;
        return a.y + a.points[a.points.length - 1][1];
      };
      const endBefore = endY();
      const heightBefore = getTable(table.id).height;

      const layout = getTableLayout(table);
      mouse.clickAt(
        table.x + layout.toggle.x + layout.toggle.width / 2,
        table.y + layout.toggle.y + layout.toggle.height / 2,
      );

      const collapsed = getTable(table.id);
      expect(collapsed.collapsed).toBe(true);
      expect(collapsed.height).toBeLessThan(heightBefore);
      // the arrow followed the bottom edge up (orbit gap → tolerance)
      const shrink = heightBefore - collapsed.height;
      expect(Math.abs(endBefore - endY() - shrink)).toBeLessThan(10);

      Keyboard.undo();
      expect(getTable(table.id).collapsed).toBe(false);
      expect(getTable(table.id).height).toBe(heightBefore);
    });

    it("is a bindable, single selectable element", () => {
      const table = createTable();
      API.setElements([table]);
      mouse.clickAt(table.x + table.width / 2, table.y + table.height - 4);
      expect(h.state.selectedElementIds).toEqual({ [table.id]: true });
    });
  });

  describe("serialization", () => {
    it("restores tables, sanitizing rows and re-deriving the size", () => {
      const [restored] = restoreElements(
        [
          {
            ...createTable(),
            width: 1,
            height: 1,
            title: 42,
            rows: [
              { id: "a", key: "PK", name: "id" },
              { id: "a", key: "FK", name: "dup_id" },
              { key: 1, name: "no_id" },
              null,
              "junk",
            ],
            fontSize: -5,
          } as any,
        ],
        null,
      ) as ExcalidrawTableElement[];

      expect(restored.type).toBe("table");
      expect(restored.title).toBe("");
      expect(restored.fontSize).toBe(20);
      expect(restored.rows.map((row) => [row.key, row.name])).toEqual([
        ["PK", "id"],
        ["FK", "dup_id"],
        ["", "no_id"],
      ]);
      expect(new Set(restored.rows.map((row) => row.id)).size).toBe(3);
      expect(restored.width).toBe(getTableLayout(restored).width);
      expect(restored.height).toBe(getTableLayout(restored).height);
    });

    it("exports its text to SVG", async () => {
      const table = createTable({
        title: "orders",
        rows: [
          { key: "PK", name: "id" },
          { key: "FK", name: "user_id" },
        ],
      });
      const svg = await exportScene({
        type: "svg",
        data: { elements: [table], files: {} },
        config: { canvasBackgroundColor: false },
      });
      expect(
        [...svg.querySelectorAll("text")].map((text) => text.textContent),
      ).toEqual(["orders", "PK", "id", "FK", "user_id"]);
    });
  });
});
