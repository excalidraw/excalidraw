import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { hasBoundTextElement, isOpenLine, isOpenFreedraw } from "../src/typeChecks";

describe("Test TypeChecks", () => {
  describe("Test isOpenLine", () => {
    it("should return true for open line elements", () => {
      const openLine = API.createElement({
        type: "line",
      });

      expect(isOpenLine(openLine)).toBe(true);
    });

    it("should return false for non-line elements", () => {
      const rectangle = API.createElement({
        type: "rectangle",
      });

      expect(isOpenLine(rectangle)).toBe(false);
    });

    it("should return false for closed polygon (line with polygon flag)", () => {
      const closedLine = API.createElement({
        type: "line",
      });
      // Manually set polygon to true to simulate a closed shape
      (closedLine as any).polygon = true;

      expect(isOpenLine(closedLine)).toBe(false);
    });

    it("should return false for arrow elements", () => {
      const arrow = API.createElement({
        type: "arrow",
      });

      expect(isOpenLine(arrow)).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(isOpenLine(null)).toBe(false);
      expect(isOpenLine(undefined)).toBe(false);
    });

    it("should handle line elements with explicit polygon: false", () => {
      const openLineExplicit = API.createElement({
        type: "line",
      });
      (openLineExplicit as any).polygon = false;

      expect(isOpenLine(openLineExplicit)).toBe(true);
    });
  });

  describe("Test isOpenFreedraw", () => {
    it("should return true for open freedraw elements", () => {
      const openFreedraw = API.createElement({
        type: "freedraw",
      });

      expect(isOpenFreedraw(openFreedraw)).toBe(true);
    });

    it("should return false for non-freedraw elements", () => {
      const rectangle = API.createElement({
        type: "rectangle",
      });

      expect(isOpenFreedraw(rectangle)).toBe(false);
    });

    it("should return false for closed freedraw (loop)", () => {
      // We'll simulate a closed freedraw by creating one and manually
      // checking that isOpenFreedraw returns false when isPathALoop would return true
      const closedFreedraw = API.createElement({
        type: "freedraw",
      });
      
      // Manually set points that form a loop (first and last very close)
      (closedFreedraw as any).points = [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [2, 2], // Very close to [0, 0], creating a loop
      ];

      expect(isOpenFreedraw(closedFreedraw)).toBe(false);
    });

    it("should return false for line elements", () => {
      const line = API.createElement({
        type: "line",
      });

      expect(isOpenFreedraw(line)).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(isOpenFreedraw(null)).toBe(false);
      expect(isOpenFreedraw(undefined)).toBe(false);
    });
  });

  describe("Test hasBoundTextElement", () => {
    it("should return true for text bindable containers with bound text", () => {
      expect(
        hasBoundTextElement(
          API.createElement({
            type: "rectangle",
            boundElements: [{ type: "text", id: "text-id" }],
          }),
        ),
      ).toBeTruthy();

      expect(
        hasBoundTextElement(
          API.createElement({
            type: "ellipse",
            boundElements: [{ type: "text", id: "text-id" }],
          }),
        ),
      ).toBeTruthy();

      expect(
        hasBoundTextElement(
          API.createElement({
            type: "arrow",
            boundElements: [{ type: "text", id: "text-id" }],
          }),
        ),
      ).toBeTruthy();
    });

    it("should return false for text bindable containers without bound text", () => {
      expect(
        hasBoundTextElement(
          API.createElement({
            type: "freedraw",
            boundElements: [{ type: "arrow", id: "arrow-id" }],
          }),
        ),
      ).toBeFalsy();
    });

    it("should return false for non text bindable containers", () => {
      expect(
        hasBoundTextElement(
          API.createElement({
            type: "freedraw",
            boundElements: [{ type: "text", id: "text-id" }],
          }),
        ),
      ).toBeFalsy();

      expect(
        hasBoundTextElement(
          API.createElement({
            type: "image",
            boundElements: [{ type: "text", id: "text-id" }],
          }),
        ),
      ).toBeFalsy();
    });
  });
});
