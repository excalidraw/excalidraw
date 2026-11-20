import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { newElement } from "../src/newElement";

import {
  ELBOW_ARROW_CORNER_RADIUS,
  generateElbowArrowShape,
  ShapeCache,
} from "../src/shape";

import type { ExcalidrawRectangleElement } from "../src/types";

import type { Op } from "roughjs/bin/core";

describe("arrowhead shapes", () => {
  it.each(["triangle", "diamond_outline", "circle"] as const)(
    "fills %s arrowheads along their outline",
    (arrowhead) => {
      const arrow = API.createElement({
        type: "arrow",
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
        endArrowhead: arrowhead,
        roughness: 2,
      });
      const [, head] = ShapeCache.generateElementShape(arrow, null);
      const [fill, outline] = head.sets;
      const getCurves = (ops: Op[]) =>
        ops.filter((op) => op.op === "bcurveTo").map((op) => op.data);

      expect(fill.type).toBe("fillPath");
      expect(outline.type).toBe("path");
      // the fill only joins up the outline's curves
      expect(getCurves(fill.ops)).toEqual(getCurves(outline.ops));
    },
  );
});

describe("elbow arrow shapes", () => {
  const getCorners = (points: [number, number][]) =>
    generateElbowArrowShape(
      points.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
      ELBOW_ARROW_CORNER_RADIUS,
    ).match(/Q/g)?.length ?? 0;

  it("draws a jog too short to see straight", () => {
    // a fixed segment lined up with the first one, while dragging
    expect(
      getCorners([
        [0, 0],
        [44, 0],
        [44, -1e-12],
        [195, -1e-12],
        [195, 34],
      ]),
    ).toBe(1);
  });

  it("keeps the corners of short segments in a row", () => {
    expect(
      getCorners([
        [0, 0],
        [100, 0],
        [100, 0.5],
        [100.5, 0.5],
        [100.5, 100],
      ]),
    ).toBe(3);
  });

  it("keeps a short U-turn", () => {
    expect(
      getCorners([
        [0, 0],
        [100, 0],
        [100, 0.5],
        [0, 0.5],
        [0, 50],
      ]),
    ).toBe(3);
  });
});

describe("ShapeCache", () => {
  it("caches shapes per theme and returns the most recent for null theme", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }) as ExcalidrawRectangleElement;

    const lightConfig = {
      isExporting: false,
      canvasBackgroundColor: "#ffffff",
      embedsValidationStatus: new Map(),
      theme: "light" as const,
    };
    const darkConfig = {
      isExporting: false,
      canvasBackgroundColor: "#121212",
      embedsValidationStatus: new Map(),
      theme: "dark" as const,
    };

    const lightShape = ShapeCache.generateElementShape(rect, lightConfig);
    expect(ShapeCache.get(rect, "light")).toBe(lightShape);
    expect(ShapeCache.get(rect, "dark")).toBeUndefined();
    expect(ShapeCache.get(rect, null)).toBe(lightShape);

    const darkShape = ShapeCache.generateElementShape(rect, darkConfig);
    expect(ShapeCache.get(rect, "light")).toBe(lightShape);
    expect(ShapeCache.get(rect, "dark")).toBe(darkShape);
    expect(ShapeCache.get(rect, null)).toBe(darkShape);
  });
});
