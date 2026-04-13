import { isTabSeparatedData, renderTabularData } from "./tabular";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

describe("tabular", () => {
  describe("isTabSeparatedData", () => {
    it("returns true for basic TSV with 2+ rows and 2+ columns", () => {
      const tsv = "Name\tAge\tCity\nAlice\t30\tParis\nBob\t25\tLondon";
      expect(isTabSeparatedData(tsv)).toBe(true);
    });

    it("returns false for a single line with tabs", () => {
      expect(isTabSeparatedData("a\tb\tc")).toBe(false);
    });

    it("returns false for multi-line text without tabs", () => {
      expect(isTabSeparatedData("hello\nworld")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isTabSeparatedData("")).toBe(false);
    });

    it("returns false for plain text", () => {
      expect(isTabSeparatedData("just some text")).toBe(false);
    });

    it("ignores trailing blank lines", () => {
      const tsv = "a\tb\nc\td\n\n";
      expect(isTabSeparatedData(tsv)).toBe(true);
    });
  });

  describe("renderTabularData", () => {
    it("returns null for non-TSV input", () => {
      expect(renderTabularData("hello world")).toBeNull();
    });

    it("creates rectangle + text pairs for each cell", () => {
      const tsv = "A\tB\nC\tD";
      const elements = renderTabularData(tsv)!;

      expect(elements).not.toBeNull();
      // 2 rows x 2 cols = 4 cells, each with a rect + text = 8 elements
      expect(elements).toHaveLength(8);

      const rects = elements.filter((e) => e.type === "rectangle");
      const texts = elements.filter((e) => e.type === "text");
      expect(rects).toHaveLength(4);
      expect(texts).toHaveLength(4);
    });

    it("places the text content in the text elements", () => {
      const tsv = "Hello\tWorld\nFoo\tBar";
      const elements = renderTabularData(tsv)!;
      const texts = elements.filter(
        (e): e is ExcalidrawTextElement => e.type === "text",
      );
      const values = texts.map((t) => t.text);
      expect(values).toEqual(
        expect.arrayContaining(["Hello", "World", "Foo", "Bar"]),
      );
    });

    it("gives header row a filled background", () => {
      const tsv = "H1\tH2\nV1\tV2";
      const elements = renderTabularData(tsv)!;
      const rects = elements.filter((e) => e.type === "rectangle");
      // First two rects belong to the header row and should have solid fill
      expect(rects[0].fillStyle).toBe("solid");
      expect(rects[1].fillStyle).toBe("solid");
      // Data row rects should not be solid
      expect(rects[2].fillStyle).not.toBe("solid");
      expect(rects[3].fillStyle).not.toBe("solid");
    });

    it("lays out cells in a grid without overlaps", () => {
      const tsv = "A\tB\tC\nD\tE\tF\nG\tH\tI";
      const elements = renderTabularData(tsv)!;
      const rects = elements.filter((e) => e.type === "rectangle");

      // All rects in the same row should share the same y
      // Row 0: indices 0,1,2 — Row 1: 3,4,5 — Row 2: 6,7,8
      expect(rects[0].y).toBe(rects[1].y);
      expect(rects[1].y).toBe(rects[2].y);
      expect(rects[3].y).toBe(rects[4].y);

      // Rows should be stacked vertically
      expect(rects[3].y).toBeGreaterThan(rects[0].y);
      expect(rects[6].y).toBeGreaterThan(rects[3].y);

      // Columns should be offset horizontally
      expect(rects[1].x).toBeGreaterThan(rects[0].x);
      expect(rects[2].x).toBeGreaterThan(rects[1].x);
    });

    it("handles ragged rows gracefully (missing cells)", () => {
      const tsv = "A\tB\tC\nD\tE";
      const elements = renderTabularData(tsv)!;
      // 3 cols x 2 rows = 6 cells
      const rects = elements.filter((e) => e.type === "rectangle");
      const texts = elements.filter(
        (e): e is ExcalidrawTextElement => e.type === "text",
      );
      expect(rects).toHaveLength(6);
      expect(texts).toHaveLength(6);
      // The missing cell should have empty text
      const lastText = texts[texts.length - 1];
      expect(lastText.text).toBe("");
    });
  });
});
