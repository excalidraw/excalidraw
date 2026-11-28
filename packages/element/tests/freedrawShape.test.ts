import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { LocalPoint } from "@excalidraw/math";

import { getFreedrawOutlinePoints, ShapeCache } from "../src/shape";

describe("freedraw SVG path", () => {
  it.each(["horizontal", "vertical"] as const)(
    "preserves the outline bounds of a short %s stroke",
    (direction) => {
      const element = API.createElement({
        type: "freedraw",
        strokeWidth: 1,
        strokeOptions: { variability: "constant", streamline: 0.5 },
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(
            direction === "horizontal" ? 0.1 : 0,
            direction === "vertical" ? 0.1 : 0,
          ),
        ],
      });

      const outline = getFreedrawOutlinePoints(element);
      const path = ShapeCache.generateElementShape(element, null).find(
        (shape) => typeof shape === "string",
      );
      if (typeof path !== "string") {
        throw new Error("Expected a freedraw SVG path");
      }

      const coordinates = path
        .match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)!
        .map(Number);

      for (let axis = 0; axis < 2; axis++) {
        const min = Math.min(...outline.map((point) => point[axis]));
        const max = Math.max(...outline.map((point) => point[axis]));
        const values = coordinates.filter((_, index) => index % 2 === axis);

        expect(Math.min(...values)).toBeGreaterThanOrEqual(min - 0.01);
        expect(Math.max(...values)).toBeLessThanOrEqual(max + 0.01);
      }
    },
  );

  it("preserves the outline bounds of a single-tap dot", () => {
    const element = API.createElement({
      type: "freedraw",
      strokeWidth: 2,
      points: [pointFrom<LocalPoint>(0, 0)],
    });

    const outline = getFreedrawOutlinePoints(element);
    const path = ShapeCache.generateElementShape(element, null).find(
      (shape) => typeof shape === "string",
    );
    if (typeof path !== "string") {
      throw new Error("Expected a freedraw SVG path");
    }

    const coordinates = path
      .match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)!
      .map(Number);

    for (let axis = 0; axis < 2; axis++) {
      const min = Math.min(...outline.map((point) => point[axis]));
      const max = Math.max(...outline.map((point) => point[axis]));
      const values = coordinates.filter((_, index) => index % 2 === axis);

      expect(Math.min(...values)).toBeGreaterThanOrEqual(min - 0.01);
      expect(Math.max(...values)).toBeLessThanOrEqual(max + 0.01);
    }
  });

  it("preserves the outline bounds of a large stroke", () => {
    const element = API.createElement({
      type: "freedraw",
      strokeWidth: 3,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 100),
        pointFrom<LocalPoint>(120, 40),
        pointFrom<LocalPoint>(200, 250),
      ],
    });

    const outline = getFreedrawOutlinePoints(element);
    const path = ShapeCache.generateElementShape(element, null).find(
      (shape) => typeof shape === "string",
    );
    if (typeof path !== "string") {
      throw new Error("Expected a freedraw SVG path");
    }

    const coordinates = path
      .match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)!
      .map(Number);

    for (let axis = 0; axis < 2; axis++) {
      const min = Math.min(...outline.map((point) => point[axis]));
      const max = Math.max(...outline.map((point) => point[axis]));
      const values = coordinates.filter((_, index) => index % 2 === axis);

      expect(Math.min(...values)).toBeGreaterThanOrEqual(min - 0.01);
      expect(Math.max(...values)).toBeLessThanOrEqual(max + 0.01);
    }
  });
});
