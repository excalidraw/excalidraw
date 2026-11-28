import { pointFrom } from "../src/point";

import {
  cartesian2Polar,
  normalizeRadians,
  radiansBetweenAngles,
} from "../src/angle";

import type { Radians } from "../src/types";

describe("normalizeRadians", () => {
  it("wraps a full positive or negative turn to 0", () => {
    expect(normalizeRadians((2 * Math.PI) as Radians)).toBe(0);
    expect(normalizeRadians((-2 * Math.PI) as Radians)).toBe(0);
  });

  it("does not return 2π for a tiny negative angle", () => {
    expect(normalizeRadians(-1e-17 as Radians)).toBe(0);
  });

  it("keeps angles inside [0, 2π)", () => {
    const twoPi = 2 * Math.PI;
    for (const angle of [0, Math.PI, -Math.PI, 3 * Math.PI, -3 * Math.PI]) {
      const normalized = normalizeRadians(angle as Radians);
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThan(twoPi);
    }
  });
});

describe("cartesian2Polar", () => {
  it("returns 0 for a point just below the positive x axis", () => {
    expect(cartesian2Polar(pointFrom(1, -1e-17))[1]).toBe(0);
  });
});

describe("radiansBetweenAngles", () => {
  it("treats -2π as the same direction as 0", () => {
    expect(
      radiansBetweenAngles(
        (-2 * Math.PI) as Radians,
        0 as Radians,
        (Math.PI / 2) as Radians,
      ),
    ).toBe(true);
  });
});
