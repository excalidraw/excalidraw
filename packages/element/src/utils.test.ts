import { describe, it, expect } from "vitest";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import { isPathALoop } from "./utils";
import type { ExcalidrawLinearElement } from "./types";

describe("isPathALoop", () => {
  it("should detect a loop when first and last point are close", () => {
    const points: ExcalidrawLinearElement["points"] = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(10, 20),
      pointFrom<LocalPoint>(20, 0),
      pointFrom<LocalPoint>(1, 1),
    ];
    expect(isPathALoop(points)).toBe(true);
  });

  it("should detect a loop even when scaled up to larger dimensions", () => {
    // Points scaled up 10x
    const points: ExcalidrawLinearElement["points"] = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 200),
      pointFrom<LocalPoint>(200, 0),
      pointFrom<LocalPoint>(10, 10), // distance is 14.14px, > 8px, but ratio relative to maxDim (200) is 14.14/200 = 0.07 <= 0.1
    ];
    expect(isPathALoop(points)).toBe(true);
  });

  it("should not detect a loop for open linear paths", () => {
    const points: ExcalidrawLinearElement["points"] = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(50, 0),
      pointFrom<LocalPoint>(100, 100),
    ];
    expect(isPathALoop(points)).toBe(false);
  });
});
