import { describe, expect, it } from "vitest";

import {
  STAR_5_INNER_RADIUS_RATIO,
  getStar5PointsLocal,
} from "../starPoints";

describe("getStar5PointsLocal", () => {
  it("uses cos(72°)/cos(36°) inner radius ratio", () => {
    const expected =
      Math.cos((72 * Math.PI) / 180) / Math.cos((36 * Math.PI) / 180);
    expect(STAR_5_INNER_RADIUS_RATIO).toBeCloseTo(expected, 10);
    expect(STAR_5_INNER_RADIUS_RATIO).toBeCloseTo(0.3819660112501051, 10);
  });

  it("returns 10 alternating outer/inner vertices for a 5-point star", () => {
    const pts = getStar5PointsLocal(200, 100);
    expect(pts).toHaveLength(10);
    // Top outer tip (first vertex): center (100,50), angle -90°
    expect(pts[0][0]).toBeCloseTo(100, 10);
    expect(pts[0][1]).toBeCloseTo(0, 10);
  });

  it("scales radially with radialScale from the box center", () => {
    const cx = 50;
    const cy = 50;
    const base = getStar5PointsLocal(100, 100, 1);
    const scaled = getStar5PointsLocal(100, 100, 2);
    const dist = (x: number, y: number) =>
      Math.hypot(x - cx, y - cy);
    expect(dist(scaled[0][0], scaled[0][1])).toBeCloseTo(
      2 * dist(base[0][0], base[0][1]),
      10,
    );
  });
});
