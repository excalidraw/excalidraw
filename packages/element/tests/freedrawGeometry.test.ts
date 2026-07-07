import {
  getFreeDrawCapsuleSegments,
  getFreeDrawBaseRadius,
} from "../src/freedraw";

import type { ExcalidrawFreeDrawElement } from "../src/types";

const makeFreeDraw = (
  points: [number, number][],
  pressures: number[] = [],
  overrides: Partial<ExcalidrawFreeDrawElement> = {},
): ExcalidrawFreeDrawElement =>
  ({
    type: "freedraw",
    strokeWidth: 2,
    simulatePressure: pressures.length === 0,
    points,
    pressures,
    ...overrides,
  } as unknown as ExcalidrawFreeDrawElement);

describe("getFreeDrawCapsuleSegments", () => {
  it("returns a single degenerate capsule for a single point (dot)", () => {
    const el = makeFreeDraw([[0, 0]]);
    const segs = getFreeDrawCapsuleSegments(el);
    expect(segs).toHaveLength(1);
    // degenerate: coincident endpoints so consumers draw a full circle
    expect(segs[0].x0).toBe(segs[0].x1);
    expect(segs[0].y0).toBe(segs[0].y1);
    expect(segs[0].r0).toBeGreaterThan(0);
  });

  it("subdivides long intervals to ~target spacing (no coarse facets)", () => {
    // one 90px straight interval should split into many capsules (~30 at 3px)
    const el = makeFreeDraw([
      [0, 0],
      [90, 0],
    ]);
    const segs = getFreeDrawCapsuleSegments(el);
    expect(segs.length).toBeGreaterThanOrEqual(25);
    // consecutive capsules share endpoints -> continuous chain
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].x0).toBeCloseTo(segs[i - 1].x1, 6);
      expect(segs[i].y0).toBeCloseTo(segs[i - 1].y1, 6);
    }
  });

  it("interpolates radius from smoothed pressure along the stroke", () => {
    const el = makeFreeDraw(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      [0.2, 0.2, 1.0],
    );
    const base = getFreeDrawBaseRadius(el);
    const segs = getFreeDrawCapsuleSegments(el);
    // first capsule starts near the low-pressure radius
    expect(segs[0].r0).toBeCloseTo(base * 0.2 * 2, 6);
    // radius grows toward the high-pressure end
    expect(segs[segs.length - 1].r1).toBeGreaterThan(segs[0].r0);
  });

  it("smooths raw input as a midpoint B-spline (filters pointer jitter)", () => {
    // zigzag input: raw points alternate between y=0 and y=10
    const el = makeFreeDraw([
      [0, 0],
      [10, 10],
      [20, 0],
      [30, 10],
      [40, 0],
    ]);
    const segs = getFreeDrawCapsuleSegments(el);
    // the centreline treats raw points as control points, so it never reaches
    // the zigzag extremes (max deviation is (A + B - 2C) / 4 => y <= 7.5)...
    for (const s of segs) {
      expect(s.y1).toBeLessThanOrEqual(7.5 + 1e-9);
    }
    // ...but passes exactly through consecutive-point midpoints...
    expect(
      segs.some((s) => Math.abs(s.x1 - 5) < 1e-9 && Math.abs(s.y1 - 5) < 1e-9),
    ).toBe(true);
    // ...and still starts/ends exactly at the first/last raw point
    expect(segs[0].x0).toBe(0);
    expect(segs[0].y0).toBe(0);
    expect(segs[segs.length - 1].x1).toBe(40);
    expect(segs[segs.length - 1].y1).toBe(0);
  });

  it("windows intervals with fromIndex / upToIndex for incremental draw", () => {
    const el = makeFreeDraw([
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ]);
    const all = getFreeDrawCapsuleSegments(el);
    const tail = getFreeDrawCapsuleSegments(el, 3); // last interval only
    const head = getFreeDrawCapsuleSegments(el, 0, 3); // stop before last interval
    expect(tail.length).toBeGreaterThan(0);
    expect(head.length).toBeGreaterThan(0);
    // windows partition the full set (each interval subdivides the same way)
    expect(head.length + tail.length).toBe(all.length);
  });
});
