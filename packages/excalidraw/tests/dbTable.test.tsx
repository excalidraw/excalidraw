import React from "react";

import { KEYS, reseed } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import {
  getBindingGap,
  getDBTableCellAtPoint,
  getDBTableLayout,
  getTransformHandles,
  isPointOnDBTableToggle,
  newDBTableElement,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawDBTableElement,
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

const getDBTable = (id: string) =>
  h.elements.find(
    (element) => element.id === id,
  ) as NonDeleted<ExcalidrawDBTableElement>;

const getEditorInputs = () =>
  [
    ...document.querySelectorAll<HTMLInputElement>(
      ".excalidraw-dbtable-editor__input",
    ),
  ] as HTMLInputElement[];

const getTitleInput = () =>
  document.querySelector<HTMLInputElement>(
    ".excalidraw-dbtable-editor__title",
  )!;

const type = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } });
};

const createDBTable = (
  opts: Partial<Parameters<typeof newDBTableElement>[0]> = {},
) =>
  newDBTableElement({
    type: "dbtable",
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
      const table = createDBTable({
        title: "t",
        rows: [{ key: "PK", name: "id" }],
      });
      const layout = getDBTableLayout(table);
      expect(table.width).toBe(layout.width);
      expect(table.height).toBe(layout.height);

      const longName = createDBTable({
        title: "t",
        rows: [{ key: "PK", name: "a_very_long_column_name_indeed" }],
      });
      expect(longName.width).toBeGreaterThan(table.width);
      expect(longName.height).toBe(table.height);

      const moreRows = createDBTable({
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
      const table = createDBTable({ title: "a_long_table_name_here" });
      const layout = getDBTableLayout(table);
      expect(layout.title.x).toBeGreaterThan(
        layout.toggle.x + layout.toggle.width,
      );
      expect(layout.title.x + layout.title.width / 2).toBe(table.width / 2);
    });

    it("lays out a strict two-column body", () => {
      const table = createDBTable({
        rows: [
          { key: "PK", name: "id" },
          { key: "varchar", name: "email" },
        ],
      });
      const layout = getDBTableLayout(table);
      for (const row of layout.rows) {
        expect(row.key.x).toBe(0);
        expect(row.name.x).toBe(layout.keyColumnWidth);
        expect(row.key.width + row.name.width).toBe(table.width);
      }
    });

    it("shows only the header when collapsed", () => {
      const table = createDBTable({ collapsed: true });
      const layout = getDBTableLayout(table);
      expect(table.height).toBe(Math.ceil(layout.header.height));
      expect(layout.body).toBeNull();
      expect(layout.rows).toHaveLength(0);
    });

    it("scales with its font size", () => {
      const small = createDBTable({ fontSize: 20 });
      const large = createDBTable({ fontSize: 40 });
      expect(large.width / small.width).toBeCloseTo(2, 0);
      expect(large.height / small.height).toBeCloseTo(2, 0);
    });
  });

  describe("hit testing", () => {
    it("finds the toggle and the cells, also when rotated", () => {
      const table = createDBTable({
        rows: [{ key: "PK", name: "id" }],
      });
      const layout = getDBTableLayout(table);
      const toggleCenter = {
        x: table.x + layout.toggle.x + layout.toggle.width / 2,
        y: table.y + layout.toggle.y + layout.toggle.height / 2,
      };
      expect(isPointOnDBTableToggle(table, toggleCenter)).toBe(true);
      expect(
        isPointOnDBTableToggle(table, {
          x: table.x + table.width / 2,
          y: table.y + layout.header.height / 2,
        }),
      ).toBe(false);

      const [row] = layout.rows;
      expect(
        getDBTableCellAtPoint(table, {
          x: table.x + row.name.x + 5,
          y: table.y + row.name.y + 5,
        }),
      ).toEqual({ type: "name", rowId: row.row.id });
      expect(
        getDBTableCellAtPoint(table, {
          x: table.x + row.key.x + 5,
          y: table.y + row.key.y + 5,
        }),
      ).toEqual({ type: "key", rowId: row.row.id });

      // rotated half a turn, the toggle sits at the opposite corner
      const rotated = { ...table, angle: Math.PI } as typeof table;
      expect(
        isPointOnDBTableToggle(rotated, {
          x: table.x + table.width - (toggleCenter.x - table.x),
          y: table.y + table.height - (toggleCenter.y - table.y),
        }),
      ).toBe(true);
    });

    it("only offers rotation and side handles (its height follows the content)", () => {
      const table = createDBTable();
      const handles = getTransformHandles(table, h.state.zoom, new Map());
      expect(
        Object.entries(handles)
          .filter(([, handle]) => handle)
          .map(([type]) => type),
      ).toEqual(["rotation", "w", "e"]);
    });
  });

  describe("tool and in-place editing", () => {
    it("places a table on click and starts editing its name", async () => {
      UI.clickTool("dbtable");
      mouse.clickAt(200, 200);

      const [table] = h.elements as ExcalidrawDBTableElement[];
      expect(table.type).toBe("dbtable");
      expect(table.x).toBe(200);
      expect(table.y).toBe(200);
      expect(h.state.editingDBTableId).toBe(table.id);
      expect(h.state.selectedElementIds).toEqual({ [table.id]: true });
      expect(h.state.activeTool.type).toBe("selection");

      await act(async () => {});
      expect(document.activeElement).toBe(getTitleInput());
    });

    it("grows the table as the user types and adds rows on Enter", async () => {
      const table = createDBTable({ rows: [{ key: "PK", name: "id" }] });
      API.setElements([table]);
      act(() => h.app.dbTable.startEditing(table, { type: "title" }));
      await act(async () => {});

      const widthBefore = getDBTable(table.id).width;
      type(getTitleInput(), "a_much_longer_table_name_than_before");
      expect(getDBTable(table.id).title).toBe(
        "a_much_longer_table_name_than_before",
      );
      expect(getDBTable(table.id).width).toBeGreaterThan(widthBefore);

      const heightBefore = getDBTable(table.id).height;
      const nameInput = getEditorInputs().find((input) =>
        input.classList.contains("excalidraw-dbtable-editor__name"),
      )!;
      Keyboard.keyPress(KEYS.ENTER, nameInput);
      await act(async () => {});
      expect(getDBTable(table.id).rows).toHaveLength(2);
      expect(getDBTable(table.id).height).toBeGreaterThan(heightBefore);

      // the new row is focused
      const focused = document.activeElement as HTMLInputElement;
      type(focused, "created_at");
      expect(getDBTable(table.id).rows[1].name).toBe("created_at");
    });

    it("drops untouched empty rows when editing finishes, as one undo step", async () => {
      const table = createDBTable({ rows: [{ key: "PK", name: "id" }] });
      API.setElements([table]);
      act(() => h.app.dbTable.startEditing(table, { type: "title" }));
      await act(async () => {});

      type(getTitleInput(), "users");
      fireEvent.click(
        document.querySelector(".excalidraw-dbtable-editor__add")!,
      );
      await act(async () => {});
      expect(getDBTable(table.id).rows).toHaveLength(2);

      Keyboard.keyPress(KEYS.ESCAPE, document.activeElement as HTMLElement);
      await act(async () => {});
      expect(h.state.editingDBTableId).toBe(null);
      expect(getDBTable(table.id).rows).toHaveLength(1);
      expect(getDBTable(table.id).title).toBe("users");

      Keyboard.undo();
      expect(getDBTable(table.id).title).toBe(table.title);
    });

    it("edits the double-clicked cell", async () => {
      const table = createDBTable({
        rows: [
          { key: "PK", name: "id" },
          { key: "", name: "email" },
        ],
      });
      API.setElements([table]);
      const row = getDBTableLayout(table).rows[1];

      mouse.doubleClickAt(
        table.x + row.name.x + row.name.width / 2,
        table.y + row.name.y + row.name.height / 2,
      );
      await act(async () => {});

      expect(h.state.editingDBTableId).toBe(table.id);
      expect((document.activeElement as HTMLInputElement).value).toBe("email");
    });
  });

  describe("collapse toggle and bindings", () => {
    it("collapses on toggle click, moving header connections along", () => {
      const table = createDBTable({
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
      const heightBefore = getDBTable(table.id).height;

      const layout = getDBTableLayout(table);
      mouse.clickAt(
        table.x + layout.toggle.x + layout.toggle.width / 2,
        table.y + layout.toggle.y + layout.toggle.height / 2,
      );

      const collapsed = getDBTable(table.id);
      expect(collapsed.collapsed).toBe(true);
      expect(collapsed.height).toBeLessThan(heightBefore);
      // a connection without a row attaches at the header's center line
      expect(endY()).toBeCloseTo(collapsed.y + collapsed.height / 2, 0);

      Keyboard.undo();
      expect(getDBTable(table.id).collapsed).toBe(false);
      expect(getDBTable(table.id).height).toBe(heightBefore);
    });

    it("is a bindable, single selectable element", () => {
      const table = createDBTable();
      API.setElements([table]);
      mouse.clickAt(table.x + table.width / 2, table.y + table.height - 4);
      expect(h.state.selectedElementIds).toEqual({ [table.id]: true });
    });
  });

  describe("row connections", () => {
    const rowCenterY = (table: ExcalidrawDBTableElement, rowName: string) => {
      const row = getDBTableLayout(table).rows.find(
        (row) => row.row.name === rowName,
      )!;
      return table.y + row.rect.y + row.rect.height / 2;
    };
    const getArrow = () =>
      h.elements.find(
        (e) => e.type === "arrow" && !e.isDeleted,
      ) as NonDeleted<ExcalidrawArrowElement>;
    const endPoint = (arrow: ExcalidrawArrowElement, index: 0 | -1) => {
      const point = arrow.points.at(index)!;
      return { x: arrow.x + point[0], y: arrow.y + point[1] };
    };

    let users: NonDeleted<ExcalidrawDBTableElement>;
    let orders: NonDeleted<ExcalidrawDBTableElement>;

    beforeEach(() => {
      users = createDBTable({
        x: 100,
        y: 100,
        title: "users",
        rows: [
          { key: "PK", name: "id" },
          { key: "", name: "email" },
        ],
      });
      orders = createDBTable({
        x: 600,
        y: 400,
        title: "orders",
        rows: [
          { key: "PK", name: "id" },
          { key: "FK", name: "user_id" },
          { key: "", name: "total" },
        ],
      });
      act(() =>
        h.app.updateScene({
          elements: [users, orders],
          captureUpdate: CaptureUpdateAction.NEVER,
        }),
      );
      act(() => h.setState({ currentItemArrowType: "round" }));

      // users.email → orders.user_id, from users' right half to orders' left
      UI.clickTool("arrow");
      mouse.downAt(users.x + users.width - 20, rowCenterY(users, "email") + 3);
      mouse.moveTo(orders.x + 30, rowCenterY(orders, "user_id") - 4);
      mouse.upAt(orders.x + 30, rowCenterY(orders, "user_id") - 4);
    });

    const getUsers = () => getDBTable(users.id);
    const getOrders = () => getDBTable(orders.id);

    it("binds each end to the row it was dropped on", () => {
      const arrow = getArrow();
      expect(arrow.startBinding?.elementId).toBe(users.id);
      expect(arrow.startBinding?.rowId).toBe(
        users.rows.find((row) => row.name === "email")!.id,
      );
      expect(arrow.endBinding?.elementId).toBe(orders.id);
      expect(arrow.endBinding?.rowId).toBe(
        orders.rows.find((row) => row.name === "user_id")!.id,
      );
    });

    it("attaches at the row's center line on the facing edges", () => {
      const arrow = getArrow();
      const gap = getBindingGap(users);
      const start = endPoint(arrow, 0);
      const end = endPoint(arrow, -1);
      expect(start.y).toBeCloseTo(rowCenterY(getUsers(), "email"), 0);
      expect(start.x).toBeCloseTo(users.x + users.width + gap, 0);
      expect(end.y).toBeCloseTo(rowCenterY(getOrders(), "user_id"), 0);
      expect(end.x).toBeCloseTo(orders.x - gap, 0);
    });

    it("follows its row when rows are added, removed or reordered", () => {
      act(() =>
        h.app.dbTable.updateContent(getOrders(), {
          rows: [
            { id: "a", key: "", name: "created_at" },
            { id: "b", key: "", name: "status" },
            ...getOrders().rows,
          ],
        }),
      );
      expect(endPoint(getArrow(), -1).y).toBeCloseTo(
        rowCenterY(getOrders(), "user_id"),
        0,
      );

      act(() =>
        h.app.dbTable.updateContent(getOrders(), {
          rows: [...getOrders().rows].reverse(),
        }),
      );
      expect(endPoint(getArrow(), -1).y).toBeCloseTo(
        rowCenterY(getOrders(), "user_id"),
        0,
      );
    });

    it("attaches at the header while collapsed and returns to its row", () => {
      act(() => h.app.dbTable.toggleCollapsed(getOrders()));
      expect(endPoint(getArrow(), -1).y).toBeCloseTo(
        getOrders().y + getOrders().height / 2,
        0,
      );

      act(() => h.app.dbTable.toggleCollapsed(getOrders()));
      expect(endPoint(getArrow(), -1).y).toBeCloseTo(
        rowCenterY(getOrders(), "user_id"),
        0,
      );
    });

    it("keeps the side chosen while drawing the arrow", () => {
      UI.clickTool("arrow");
      // start on the LEFT half of users' row, although orders is to the right
      mouse.downAt(users.x + 20, rowCenterY(users, "id") + 3);
      mouse.moveTo(orders.x + 30, rowCenterY(orders, "total") - 4);
      mouse.upAt(orders.x + 30, rowCenterY(orders, "total") - 4);
      const arrows = h.elements.filter(
        (el) => el.type === "arrow",
      ) as ExcalidrawArrowElement[];
      const drawn = arrows[arrows.length - 1];
      expect(endPoint(drawn, 0).x).toBeCloseTo(
        users.x - getBindingGap(users),
        0,
      );
    });

    it("keeps its sides when the tables move past each other", () => {
      UI.clickTool("selection");
      // drag `users` by its header to the right of `orders`
      const grab = { x: users.x + users.width / 2, y: users.y + 8 };
      mouse.downAt(grab.x, grab.y);
      mouse.moveTo(grab.x + 900, grab.y);
      mouse.upAt(grab.x + 900, grab.y);

      const movedUsers = getUsers();
      expect(movedUsers.x).toBeGreaterThan(orders.x + orders.width);
      const gap = getBindingGap(users);
      const arrow = getArrow();
      expect(endPoint(arrow, 0).x).toBeCloseTo(
        movedUsers.x + movedUsers.width + gap,
        0,
      );
      expect(endPoint(arrow, -1).x).toBeCloseTo(orders.x - gap, 0);
      // still on the same rows
      expect(endPoint(arrow, 0).y).toBeCloseTo(
        rowCenterY(movedUsers, "email"),
        0,
      );
    });

    it("keeps the side the user moved an end to", () => {
      UI.clickTool("selection");
      const arrow = getArrow();
      const gap = getBindingGap(orders);
      expect(endPoint(arrow, -1).x).toBeCloseTo(orders.x - gap, 0);

      // select the arrow and re-drop its end on the right half of the row
      mouse.clickAt(
        (endPoint(arrow, 0).x + endPoint(arrow, -1).x) / 2,
        (endPoint(arrow, 0).y + endPoint(arrow, -1).y) / 2,
      );
      const from = endPoint(getArrow(), -1);
      const to = {
        x: orders.x + orders.width - 20,
        y: rowCenterY(getOrders(), "user_id"),
      };
      mouse.downAt(from.x, from.y);
      mouse.moveTo(to.x, to.y);
      mouse.upAt(to.x, to.y);

      const moved = getArrow();
      expect(moved.endBinding?.elementId).toBe(orders.id);
      expect(endPoint(moved, -1).x).toBeCloseTo(
        orders.x + orders.width + gap,
        0,
      );

      // and it stays there when the tables move
      act(() => h.app.dbTable.toggleCollapsed(getOrders()));
      act(() => h.app.dbTable.toggleCollapsed(getOrders()));
      expect(endPoint(getArrow(), -1).x).toBeCloseTo(
        orders.x + orders.width + gap,
        0,
      );
    });

    it("resizes horizontally from its side handles, never below its content", () => {
      UI.clickTool("selection");
      mouse.clickAt(users.x + 20, users.y + 8);
      const gap = getBindingGap(users);
      const minWidth = users.width;

      // widen from the right edge: the arrow follows the new edge
      const edge = { x: users.x + users.width, y: users.y + users.height / 2 };
      mouse.downAt(edge.x, edge.y);
      mouse.moveTo(edge.x + 100, edge.y);
      mouse.upAt(edge.x + 100, edge.y);
      expect(getUsers().width).toBeCloseTo(minWidth + 100, 0);
      expect(getUsers().customWidth).toBeCloseTo(minWidth + 100, 0);
      expect(getUsers().height).toBe(users.height);
      expect(endPoint(getArrow(), 0).x).toBeCloseTo(
        users.x + minWidth + 100 + gap,
        0,
      );

      // shrinking stops at the content's width
      const edge2 = { x: users.x + getUsers().width, y: edge.y };
      mouse.downAt(edge2.x, edge2.y);
      mouse.moveTo(edge2.x - 400, edge2.y);
      mouse.upAt(edge2.x - 400, edge2.y);
      expect(getUsers().width).toBe(minWidth);

      // survives save and load
      const [restored] = restoreElements(
        [{ ...getUsers(), customWidth: 400 }],
        null,
      ) as ExcalidrawDBTableElement[];
      expect(restored.width).toBe(400);
    });

    it("keeps the row through save and load", () => {
      const [restored] = restoreElements(
        [getArrow()],
        null,
      ) as ExcalidrawArrowElement[];
      expect(restored.startBinding?.rowId).toBe(getArrow().startBinding?.rowId);
      expect(restored.endBinding?.rowId).toBe(getArrow().endBinding?.rowId);
    });
  });

  describe("serialization", () => {
    it("restores tables, sanitizing rows and re-deriving the size", () => {
      const [restored] = restoreElements(
        [
          {
            ...createDBTable(),
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
      ) as ExcalidrawDBTableElement[];

      expect(restored.type).toBe("dbtable");
      expect(restored.title).toBe("");
      expect(restored.fontSize).toBe(20);
      expect(restored.rows.map((row) => [row.key, row.name])).toEqual([
        ["PK", "id"],
        ["FK", "dup_id"],
        ["", "no_id"],
      ]);
      expect(new Set(restored.rows.map((row) => row.id)).size).toBe(3);
      expect(restored.width).toBe(getDBTableLayout(restored).width);
      expect(restored.height).toBe(getDBTableLayout(restored).height);
    });

    it("exports its text to SVG", async () => {
      const table = createDBTable({
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
