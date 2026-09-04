import { expect, describe, it } from "vitest";

import { isLineElement } from "@excalidraw/element";

import {
  clampTableDimension,
  createTableElements,
  MAX_TABLE_SIZE,
  MIN_TABLE_SIZE,
  parseTableDimension,
  TABLE_CELL_HEIGHT,
  TABLE_CELL_WIDTH,
} from "./createTable";

describe("createTable", () => {
  describe("clampTableDimension", () => {
    it("clamps to the allowed range", () => {
      expect(clampTableDimension(0)).toBe(MIN_TABLE_SIZE);
      expect(clampTableDimension(-3)).toBe(MIN_TABLE_SIZE);
      expect(clampTableDimension(MAX_TABLE_SIZE + 10)).toBe(MAX_TABLE_SIZE);
      expect(clampTableDimension(4.9)).toBe(4);
    });
  });

  describe("parseTableDimension", () => {
    it("parses integers and falls back when invalid", () => {
      expect(parseTableDimension("5", 3)).toBe(5);
      expect(parseTableDimension("abc", 3)).toBe(3);
      expect(parseTableDimension("", 2)).toBe(2);
    });
  });

  describe("createTableElements", () => {
    it("builds a grouped rectangle with internal grid lines", () => {
      const elements = createTableElements({ rows: 3, cols: 4 });

      // 1 rectangle + (cols-1) vertical lines + (rows-1) horizontal lines
      expect(elements).toHaveLength(1 + 3 + 2);

      const rectangle = elements.find(
        (element) => element.type === "rectangle",
      );
      const lines = elements.filter(isLineElement);

      expect(rectangle).toBeDefined();
      expect(rectangle!.width).toBe(4 * TABLE_CELL_WIDTH);
      expect(rectangle!.height).toBe(3 * TABLE_CELL_HEIGHT);
      expect(lines).toHaveLength(5);

      const groupId = rectangle!.groupIds[0];
      expect(groupId).toBeTruthy();
      expect(elements.every((element) => element.groupIds[0] === groupId)).toBe(
        true,
      );

      const verticalLines = lines.filter((line) => line.width === 0);
      const horizontalLines = lines.filter((line) => line.height === 0);

      expect(verticalLines).toHaveLength(3);
      expect(horizontalLines).toHaveLength(2);

      expect(verticalLines.map((line) => line.x)).toEqual([
        TABLE_CELL_WIDTH,
        TABLE_CELL_WIDTH * 2,
        TABLE_CELL_WIDTH * 3,
      ]);
      expect(horizontalLines.map((line) => line.y)).toEqual([
        TABLE_CELL_HEIGHT,
        TABLE_CELL_HEIGHT * 2,
      ]);
    });

    it("creates only the outer rectangle for a 1x1 table", () => {
      const elements = createTableElements({ rows: 1, cols: 1 });

      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe("rectangle");
    });
  });
});
