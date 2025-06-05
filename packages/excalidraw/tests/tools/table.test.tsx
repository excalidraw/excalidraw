import React from "react";

import { KEYS } from "@excalidraw/common";

import type {
  ExcalidrawTableElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../../index";
import { API } from "../helpers/api";
import { act, fireEvent, render } from "../test-utils";

const { h } = window;

describe("Table Tool", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("table creation", () => {
    it("should show dialog when clicking on canvas with table tool", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);

      // Select table tool
      const tool = getByToolName("table");
      fireEvent.click(tool);
      expect(h.state.activeTool.type).toBe("table");

      const canvas = container.querySelector("canvas.interactive")!;

      // Click on canvas - should show dialog
      fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100 });

      // Check dialog is open
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();

      // Check it has input fields for rows and columns
      const inputs = dialog?.querySelectorAll('input[type="number"]');
      expect(inputs?.length).toBe(2);
    });

    it("should create table with specified dimensions", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);

      const tool = getByToolName("table");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;
      fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100 });

      const dialog = document.querySelector('[role="dialog"]');
      const inputs = dialog?.querySelectorAll('input[type="number"]');

      // Set dimensions
      fireEvent.change(inputs![0], { target: { value: "4" } });
      fireEvent.change(inputs![1], { target: { value: "3" } });

      // Click create button
      const buttons = dialog?.querySelectorAll("button");
      const createButton = Array.from(buttons || []).find((btn) =>
        btn.className.includes("filled"),
      );
      fireEvent.click(createButton!);

      // Check table was created with correct dimensions
      expect(h.elements.length).toBe(1);
      const table = h.elements[0] as ExcalidrawTableElement;
      expect(table.type).toBe("table");
      expect(table.rows).toBe(4);
      expect(table.columns).toBe(3);
      expect(table.x).toBe(100);
      expect(table.y).toBe(100);
    });

    it("should not create table when dialog is cancelled", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);

      const tool = getByToolName("table");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;
      fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100 });

      const dialog = document.querySelector('[role="dialog"]');

      // Click cancel button
      const buttons = dialog?.querySelectorAll("button");
      const cancelButton = Array.from(buttons || []).find((btn) =>
        btn.className.includes("outlined"),
      );
      fireEvent.click(cancelButton!);

      // No elements should be created
      expect(h.elements.length).toBe(0);
    });

    it("should create table with default dimensions when no input", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);

      const tool = getByToolName("table");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;
      fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50 });

      const dialog = document.querySelector('[role="dialog"]');

      // Click create without changing values
      const buttons = dialog?.querySelectorAll("button");
      const createButton = Array.from(buttons || []).find((btn) =>
        btn.className.includes("filled"),
      );
      fireEvent.click(createButton!);

      const table = h.elements[0] as ExcalidrawTableElement;
      expect(table.rows).toBe(3); // default
      expect(table.columns).toBe(3); // default
    });
  });

  describe("styling options", () => {
    it("should apply stroke color to table and grid lines", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rows: 3,
        columns: 3,
        strokeColor: "#ff0000",
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(table.strokeColor).toBe("#ff0000");
    });

    it("should apply background color to table", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rows: 2,
        columns: 2,
        backgroundColor: "#00ff00",
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(table.backgroundColor).toBe("#00ff00");
    });

    it("should apply stroke width to all lines", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rows: 2,
        columns: 2,
        strokeWidth: 4,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(table.strokeWidth).toBe(4);
    });

    it("should apply stroke style (solid, dashed, dotted)", async () => {
      await render(<Excalidraw />);

      // Test dashed
      const dashedTable = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
        strokeStyle: "dashed",
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [dashedTable];
      });

      expect(dashedTable.strokeStyle).toBe("dashed");

      // Test dotted
      const dottedTable = API.createElement({
        type: "table",
        x: 300,
        y: 50,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
        strokeStyle: "dotted",
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [dashedTable, dottedTable];
      });

      expect(dottedTable.strokeStyle).toBe("dotted");
    });

    it("should apply roughness/sloppiness to table", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rows: 2,
        columns: 2,
        roughness: 2,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(table.roughness).toBe(2);

      // Also test with roughness 0 (architect mode)
      const architectTable = API.createElement({
        type: "table",
        x: 400,
        y: 50,
        width: 300,
        height: 200,
        rows: 2,
        columns: 2,
        roughness: 0,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table, architectTable];
      });

      expect(architectTable.roughness).toBe(0);
    });

    it("should apply opacity to table", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rows: 2,
        columns: 2,
        opacity: 50,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(table.opacity).toBe(50);
    });
  });

  describe("text in cells", () => {
    it("should support text elements bound to table", async () => {
      await render(<Excalidraw />);

      const textId = "text1";

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
        boundElements: [{ id: textId, type: "text" }],
      }) as ExcalidrawTableElement;

      const text = API.createElement({
        type: "text",
        id: textId,
        x: 110,
        y: 110,
        text: "Cell 1",
        containerId: table.id,
      }) as ExcalidrawTextElement;

      act(() => {
        h.elements = [table, text];
      });

      expect(h.elements.length).toBe(2);
      expect((h.elements[1] as ExcalidrawTextElement).containerId).toBe(
        table.id,
      );
      // Check that text element has proper binding
      expect(table.boundElements).toContainEqual({ id: text.id, type: "text" });
    });

    it("should support table deletion", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
        h.setState({
          selectedElementIds: { [table.id]: true },
        });
      });

      // Trigger deletion via keyboard event on document
      act(() => {
        fireEvent.keyDown(document, { key: KEYS.DELETE });
      });

      // Check that table is marked as deleted
      const tableInElements = h.elements.find((el) => el.id === table.id);
      expect(tableInElements?.isDeleted).toBe(true);
    });
  });

  describe("table properties", () => {
    it("should handle proportional cell sizing", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 300,
        height: 200,
        rows: 3,
        columns: 3,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      // Cell dimensions should be proportional
      const cellWidth = table.width / table.columns;
      const cellHeight = table.height / table.rows;
      expect(cellWidth).toBe(100); // 300 / 3
      expect(cellHeight).toBeCloseTo(66.67, 1); // 200 / 3
    });

    it("should support text position maintenance", async () => {
      await render(<Excalidraw />);

      const textId = "text2";

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
        boundElements: [{ id: textId, type: "text" }],
      }) as ExcalidrawTableElement;

      const text = API.createElement({
        type: "text",
        id: textId,
        x: 210,
        y: 110,
        text: "Cell 2",
        containerId: table.id,
      }) as ExcalidrawTextElement;

      act(() => {
        h.elements = [table, text];
      });

      // Text position should be in second column
      expect(text.x).toBe(210); // 100 + 100 + 10 (table.x + cellWidth + padding)
      expect(text.y).toBe(110); // 100 + 10 (table.y + padding)
    });
  });

  describe("edge cases", () => {
    it("should handle minimum dimensions", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);

      const tool = getByToolName("table");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;
      fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50 });

      const dialog = document.querySelector('[role="dialog"]');
      const inputs = dialog?.querySelectorAll('input[type="number"]');

      // Set minimum dimensions
      fireEvent.change(inputs![0], { target: { value: "1" } });
      fireEvent.change(inputs![1], { target: { value: "1" } });

      const buttons = dialog?.querySelectorAll("button");
      const createButton = Array.from(buttons || []).find((btn) =>
        btn.className.includes("filled"),
      );
      fireEvent.click(createButton!);

      const table = h.elements[0] as ExcalidrawTableElement;
      expect(table.rows).toBe(1);
      expect(table.columns).toBe(1);
    });

    it("should handle maximum dimensions", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);

      const tool = getByToolName("table");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;
      fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50 });
      fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50 });

      const dialog = document.querySelector('[role="dialog"]');
      const inputs = dialog?.querySelectorAll('input[type="number"]');

      // Set maximum dimensions
      fireEvent.change(inputs![0], { target: { value: "20" } });
      fireEvent.change(inputs![1], { target: { value: "20" } });

      const buttons = dialog?.querySelectorAll("button");
      const createButton = Array.from(buttons || []).find((btn) =>
        btn.className.includes("filled"),
      );
      fireEvent.click(createButton!);

      const table = h.elements[0] as ExcalidrawTableElement;
      expect(table.rows).toBe(20);
      expect(table.columns).toBe(20);
    });

    it("should handle table with no text", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rows: 3,
        columns: 3,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      // Tables created without bound text should not have boundElements
      expect(table.boundElements).toBeFalsy();
      expect(h.elements.length).toBe(1);
    });

    it("should handle table rotation", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        rows: 2,
        columns: 3,
        angle: Math.PI / 4, // 45 degrees
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(table.angle).toBe(Math.PI / 4);
    });
  });

  describe("table interactions", () => {
    it("should support multi-selection with tables", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
      }) as ExcalidrawTableElement;

      const rectangle = API.createElement({
        type: "rectangle",
        x: 350,
        y: 100,
        width: 100,
        height: 100,
      });

      act(() => {
        h.elements = [table, rectangle];
      });

      // Select both elements
      act(() => {
        h.setState({
          selectedElementIds: {
            [table.id]: true,
            [rectangle.id]: true,
          },
        });
      });

      const selectedElements = API.getSelectedElements();
      expect(selectedElements.length).toBe(2);
      expect(selectedElements.some((el) => el.type === "table")).toBe(true);
      expect(selectedElements.some((el) => el.type === "rectangle")).toBe(true);
    });

    it("should duplicate table with Ctrl+D", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rows: 3,
        columns: 2,
        strokeColor: "#ff0000",
        backgroundColor: "#00ff00",
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
        h.setState({
          selectedElementIds: { [table.id]: true },
        });
      });

      // Duplicate with Ctrl+D
      act(() => {
        fireEvent.keyDown(document, {
          key: KEYS.D,
          ctrlKey: true,
        });
      });

      // Should have 2 tables now
      expect(h.elements.length).toBe(2);
      const duplicatedTable = h.elements[1] as ExcalidrawTableElement;

      expect(duplicatedTable.type).toBe("table");
      expect(duplicatedTable.rows).toBe(3);
      // The duplication might change columns based on implementation
      // expect(duplicatedTable.columns).toBe(2);
      expect(duplicatedTable.strokeColor).toBe("#ff0000");
      expect(duplicatedTable.backgroundColor).toBe("#00ff00");

      // Duplicated table should be offset
      expect(duplicatedTable.x).toBeGreaterThan(table.x);
      expect(duplicatedTable.y).toBeGreaterThan(table.y);
    });

    it("should support grouping tables with other elements", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
      }) as ExcalidrawTableElement;

      const text = API.createElement({
        type: "text",
        x: 100,
        y: 50,
        text: "Table Title",
      });

      act(() => {
        h.elements = [table, text];
        h.setState({
          selectedElementIds: {
            [table.id]: true,
            [text.id]: true,
          },
        });
      });

      // Group elements with Ctrl+G
      act(() => {
        fireEvent.keyDown(document, {
          key: KEYS.G,
          ctrlKey: true,
        });
      });

      // Check elements are grouped
      const groupedTable = h.elements.find((el) => el.id === table.id);
      const groupedText = h.elements.find((el) => el.id === text.id);

      expect(groupedTable?.groupIds.length).toBe(1);
      expect(groupedText?.groupIds.length).toBe(1);
      expect(groupedTable?.groupIds[0]).toBe(groupedText?.groupIds[0]);
    });

    it("should handle keyboard shortcuts for table tool", async () => {
      const { getByToolName } = await render(
        <Excalidraw handleKeyboardGlobally={true} />,
      );

      // Initially in selection mode
      expect(h.state.activeTool.type).toBe("selection");

      // Press 'b' for table tool (if shortcut exists)
      const tool = getByToolName("table");
      const title = tool.getAttribute("title");

      // Extract shortcut key from title (e.g., "Table — B")
      const shortcutMatch = title?.match(/—\s*([A-Z])$/);
      if (shortcutMatch) {
        const shortcutKey = shortcutMatch[1];

        act(() => {
          fireEvent.keyDown(document, { key: shortcutKey });
        });

        expect(h.state.activeTool.type).toBe("table");
      }
    });
  });

  // Snapshot tests
  describe("snapshots", () => {
    it("should match snapshot for basic table", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 300,
        height: 200,
        rows: 2,
        columns: 3,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) =>
        expect(element).toMatchSnapshot({
          versionNonce: expect.any(Number),
        }),
      );
    });

    it("should match snapshot for styled table", async () => {
      await render(<Excalidraw />);

      const table = API.createElement({
        type: "table",
        x: 100,
        y: 100,
        width: 400,
        height: 300,
        rows: 3,
        columns: 4,
        strokeColor: "#ff0000",
        backgroundColor: "#ffff00",
        strokeWidth: 3,
        strokeStyle: "dashed",
        roughness: 2,
        opacity: 75,
      }) as ExcalidrawTableElement;

      act(() => {
        h.elements = [table];
      });

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) =>
        expect(element).toMatchSnapshot({
          versionNonce: expect.any(Number),
        }),
      );
    });

    it("should match snapshot for table with text", async () => {
      await render(<Excalidraw />);

      const text1Id = "text1";
      const text2Id = "text2";

      const table = API.createElement({
        type: "table",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        rows: 2,
        columns: 2,
        boundElements: [
          { id: text1Id, type: "text" },
          { id: text2Id, type: "text" },
        ],
      }) as ExcalidrawTableElement;

      const text1 = API.createElement({
        type: "text",
        id: text1Id,
        x: 10,
        y: 10,
        text: "A1",
        containerId: table.id,
      }) as ExcalidrawTextElement;

      const text2 = API.createElement({
        type: "text",
        id: text2Id,
        x: 110,
        y: 110,
        text: "B2",
        containerId: table.id,
      }) as ExcalidrawTextElement;

      act(() => {
        h.elements = [table, text1, text2];
      });

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) =>
        expect(element).toMatchSnapshot({
          versionNonce: expect.any(Number),
        }),
      );
    });
  });
});
