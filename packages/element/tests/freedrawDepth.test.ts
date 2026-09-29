import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  ShapeCache,
  getFreedrawOutlinePoints,
  getFreedrawStrokeCenterPoints,
} from "../src";

import type { ExcalidrawFreeDrawElement } from "../src/types";

// A stroke as drawn a thousandfold zoomed in: 0.04 units long, with a pen
// scaled to match.
const tinyStroke = () =>
  API.createElement({
    type: "freedraw",
    strokeWidth: 0.001,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(0.013, 0.004),
      pointFrom<LocalPoint>(0.027, 0.004),
      pointFrom<LocalPoint>(0.04, 0),
    ],
  }) as ExcalidrawFreeDrawElement;

const pathCoordinates = (path: string) =>
  path.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number);

describe("freedraw path precision", () => {
  it("keeps every outline coordinate at full precision", () => {
    const element = tinyStroke();
    const path = ShapeCache.generateElementShape(element, null).at(-1);
    const outline = getFreedrawOutlinePoints(element);
    expect(typeof path).toBe("string");
    expect(pathCoordinates(path as string).slice(0, 2)).toEqual(outline[0]);
    expect(new Set(pathCoordinates(path as string)).size).toBeGreaterThan(8);
  });
});

// A peak in the middle of a stroke drawn with a pen of `strokeWidth`, as a
// fraction of the pen's reach: how far the outline passes from the
// centerline's highest point.
const outlineMissAtPeak = (strokeWidth: number, length: number) => {
  const element = API.createElement({
    type: "freedraw",
    strokeWidth,
    points: Array.from({ length: 21 }, (_, i) =>
      pointFrom<LocalPoint>(
        (i / 20) * length,
        Math.sin((i / 20) * Math.PI) * length * 0.3,
      ),
    ),
  }) as ExcalidrawFreeDrawElement;
  const peak = Math.max(
    ...getFreedrawStrokeCenterPoints(element).map(([, y]) => y),
  );
  const outlineTop = Math.max(
    ...getFreedrawOutlinePoints(element).map(([, y]) => y),
  );
  return Math.abs(outlineTop - peak) / (strokeWidth * 4.25);
};

describe("freedraw drawn deep in a zoom", () => {
  it("keeps the body of a stroke shorter than 3 units", () => {
    expect(outlineMissAtPeak(0.001, 0.5)).toBeLessThan(1);
  });

  it("draws a pen finer than a hundredth of a unit at its own width", () => {
    const element = tinyStroke();
    const reach = Math.max(
      ...getFreedrawOutlinePoints(element).map(([x, y]) =>
        Math.min(
          ...getFreedrawStrokeCenterPoints(element).map(([cx, cy]) =>
            Math.hypot(x - cx, y - cy),
          ),
        ),
      ),
    );
    expect(reach).toBeLessThanOrEqual(element.strokeWidth * 4.25);
  });

  it("keeps the shape of strokes drawn at 1x", () => {
    expect(outlineMissAtPeak(1, 100)).toBeLessThan(1);
  });
});
