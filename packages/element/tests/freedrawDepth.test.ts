import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { ShapeCache, getFreedrawOutlinePoints } from "../src";

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
