import { describe, it, expect } from "vitest";

import { newFreeDrawElement } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math/types";

import { erasePixelFromFreeDraw } from "./pixelEraser";

// Mock nanoid for deterministic IDs in tests if strictly needed,
// but for checking split behavior, we can just check array length and points.

describe("pixelEraser", () => {
  const dummyElement = newFreeDrawElement({
    type: "freedraw",
    points: [
      pointFrom(0, 0),
      pointFrom(10, 0),
      pointFrom(20, 0),
      pointFrom(30, 0),
      pointFrom(40, 0),
    ],
    x: 0,
    y: 0,
    simulatePressure: false,
  });

  it("should not erase anything if the eraser path is too short", () => {
    const eraserPath: GlobalPoint[] = [pointFrom(0, 0)];
    const result = erasePixelFromFreeDraw(dummyElement, eraserPath, 1);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(dummyElement);
  });

  it("should erase the middle of a line, resulting in two fragments", () => {
    // Determine a zoom level where radius is predictable for testing
    // pixelEraser uses ERASER_RADIUS = 10 / zoom.
    // If zoom = 1, radius = 10.

    // Line goes from (0,0) to (40,0).
    // Eraser is at (20, 0).
    // Eraser path: just crossing (20,-5) to (20,5) or similar, but
    // the logic uses the last two points as a segment and radius around them.
    // Let's sweep across the middle.

    // Let's place eraser at 20,0 precisely as the last point.
    const result = erasePixelFromFreeDraw(
      dummyElement,
      [pointFrom(20, -1), pointFrom(20, 0)],
      1,
    );

    // Points: (0,0), (10,0), (20,0), (30,0), (40,0)
    // Eraser center: (20,0), Radius 10.
    // (0,0): dist 20 -> OUT
    // (10,0): dist 10 -> IN (<= radius)
    // (20,0): dist 0 -> IN
    // (30,0): dist 10 -> IN
    // (40,0): dist 20 -> OUT

    // Segment (0,0)-(10,0): Starts OUT, Ends IN. Should end at intersection.
    // Segment (30,0)-(40,0): Starts IN, Ends OUT. Should start at intersection.

    // Expect: 2 fragments.
    // Fragment 1: (0,0) to Intersection (approx 10,0)
    // Fragment 2: Intersection (approx 30,0) to (40,0)

    expect(result.length).toBeGreaterThanOrEqual(1);

    // In this specific geometry, (10,0) is exactly on the edge.
    // If it's considered IN, then seg 0-10 intersects circle?
    // 0 is Out, 10 is In.
    // Intersection of segment y=0 with circle (20,0) r=10 is x=10 and x=30.
    // So 0-10 ends at 10.
    // 30-40 starts at 30.

    // If 10 and 30 are removed, we have 0->10 (clamped) and 30->40 (clamped).
    // Result should be roughly two short lines.

    // If the logic detects "inside" it removes the point.
    // Fragments logic:
    // 0(Out) -> 10(In): Intersection computed at x=10. Fragment: [0, 10].
    // 10(In) -> 20(In): Skipped.
    // 20(In) -> 30(In): Skipped.
    // 30(In) -> 40(Out): Intersection at x=30. Fragment: [30, 40].

    // So we expect 2 fragments.
    expect(result.length).toBe(2);
    expect(result[0].points.length).toBeGreaterThan(1);
    expect(result[1].points.length).toBeGreaterThan(1);

    // Check points of first fragment (relative coords)
    // width approx 10.
    expect(result[0].width).toBeCloseTo(10, 0);
    expect(result[1].width).toBeCloseTo(10, 0);
  });

  it("should fully erase if the eraser covers the whole line", () => {
    // Eraser covers everything.
    // Center (20,0), Radius 50.
    // Zoom = 10/50 = 0.2

    const result = erasePixelFromFreeDraw(
      dummyElement,
      [pointFrom(20, -1), pointFrom(20, 0)],
      0.2,
    );
    expect(result.length).toBe(0);
  });
});
