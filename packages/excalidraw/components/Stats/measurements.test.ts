import { API } from "../../tests/helpers/api";

import { getShapeArea, getShapePerimeter } from "./measurements";

// A 40×20 box is used for the supported shapes below. Expected values are
// hand-computed from that box, independent of the implementation:
//
//   rectangle  area = 40 · 20            = 800
//              perim = 2 · (40 + 20)     = 120
//   ellipse    area = π · 20 · 10        = 200π ≈ 628.3185
//              perim (Ramanujan)         ≈ 96.8842
//   diamond    area = (40 · 20) / 2      = 400
//              perim = 4 · √(20² + 10²)  = 4√500 ≈ 89.4427
const WIDTH = 40;
const HEIGHT = 20;

describe("getShapeArea", () => {
  it.each([
    ["rectangle", 800],
    ["ellipse", 628.3185307179587],
    ["diamond", 400],
  ] as const)("returns the area of a %s", (type, expected) => {
    const element = API.createElement({ type, width: WIDTH, height: HEIGHT });

    expect(getShapeArea(element)).toBeCloseTo(expected, 4);
  });

  it("returns 0 for a zero-sized rectangle", () => {
    const element = API.createElement({ type: "rectangle", width: 0, height: 0 });

    expect(getShapeArea(element)).toBe(0);
  });
});

describe("getShapePerimeter", () => {
  it.each([
    ["rectangle", 120],
    ["ellipse", 96.88421097671288],
    ["diamond", 89.44271909999159],
  ] as const)("returns the perimeter of a %s", (type, expected) => {
    const element = API.createElement({ type, width: WIDTH, height: HEIGHT });

    expect(getShapePerimeter(element)).toBeCloseTo(expected, 4);
  });

  it("returns 0 for a zero-sized rectangle", () => {
    const element = API.createElement({ type: "rectangle", width: 0, height: 0 });

    expect(getShapePerimeter(element)).toBe(0);
  });
});

// Element types the stats panel does not measure. Both functions must report
// `null` so the UI can hide the area/perimeter rows for them.
describe.each([
  ["getShapeArea", getShapeArea],
  ["getShapePerimeter", getShapePerimeter],
] as const)("%s for unsupported element types", (_name, measure) => {
  it.each([
    "text",
    "arrow",
    "line",
    "freedraw",
    "image",
    "frame",
  ] as const)("returns null for a %s", (type) => {
    const element = API.createElement({ type, width: WIDTH, height: HEIGHT });

    expect(measure(element)).toBeNull();
  });
});
