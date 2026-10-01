import { describe, expect, it } from "vitest";

import {
  add,
  angle,
  clamp,
  dist,
  distancePointToSegment,
  lerp,
  mag,
  norm,
  normAngle,
  plerp,
  rot,
  smul,
  sub,
  type Point,
} from "../src/math";

/** Points carry a radius as the third component: [x, y, r]. */
const p = (x: number, y: number, r = 0): Point => [x, y, r];

describe("vector arithmetic", () => {
  it("adds and subtracts componentwise, radius included", () => {
    expect(add(p(1, 2, 3), p(10, 20, 30))).toEqual([11, 22, 33]);
    expect(sub(p(10, 20, 30), p(1, 2, 3))).toEqual([9, 18, 27]);
  });

  it("is its own inverse: a + b - b === a", () => {
    const a = p(3, -4, 5);
    expect(sub(add(a, p(7, 8, 9)), p(7, 8, 9))).toEqual(a);
  });

  it("scales every component, including negative and zero factors", () => {
    expect(smul(p(1, 2, 3), 2)).toEqual([2, 4, 6]);
    expect(smul(p(1, 2, 3), -1)).toEqual([-1, -2, -3]);
    expect(smul(p(1, 2, 3), 0)).toEqual([0, 0, 0]);
  });
});

describe("norm", () => {
  it("returns a unit vector and leaves the radius untouched", () => {
    const [x, y, r] = norm(p(3, 4, 99));
    expect(x).toBeCloseTo(0.6);
    expect(y).toBeCloseTo(0.8);
    expect(r).toBe(99);
    expect(mag([x, y, r])).toBeCloseTo(1);
  });

  it("is already-normalised-safe", () => {
    const [x, y] = norm(p(1, 0));
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
  });

  // Documents current behaviour rather than endorsing it: the zero vector has no
  // direction, so normalising it divides by zero.
  it("produces NaN for the zero vector", () => {
    const [x, y] = norm(p(0, 0));
    expect(Number.isNaN(x)).toBe(true);
    expect(Number.isNaN(y)).toBe(true);
  });
});

describe("rot", () => {
  it("rotates a quarter turn counter-clockwise", () => {
    const [x, y] = rot(p(1, 0), Math.PI / 2);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it("preserves magnitude and radius", () => {
    const rotated = rot(p(3, 4, 7), 1.234);
    expect(mag(rotated)).toBeCloseTo(5);
    expect(rotated[2]).toBe(7);
  });

  it("a full turn is the identity", () => {
    const [x, y] = rot(p(2, -5), Math.PI * 2);
    expect(x).toBeCloseTo(2);
    expect(y).toBeCloseTo(-5);
  });
});

describe("interpolation", () => {
  it("lerp hits both endpoints and the midpoint", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it("lerp extrapolates outside [0,1]", () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });

  it("plerp interpolates every component", () => {
    expect(plerp(p(0, 0, 0), p(10, 20, 30), 0.5)).toEqual([5, 10, 15]);
    expect(plerp(p(0, 0, 0), p(10, 20, 30), 0)).toEqual([0, 0, 0]);
    expect(plerp(p(0, 0, 0), p(10, 20, 30), 1)).toEqual([10, 20, 30]);
  });
});

describe("angle", () => {
  it("measures the signed angle between two rays from a shared origin", () => {
    // p1 points east, p2 points north -> +90deg
    expect(angle(p(0, 0), p(1, 0), p(0, 1))).toBeCloseTo(Math.PI / 2);
  });

  it("is zero for identical directions", () => {
    expect(angle(p(0, 0), p(5, 0), p(9, 0))).toBeCloseTo(0);
  });

  it("normAngle wraps a wound-up angle back into [-pi, pi], keeping its sign", () => {
    expect(normAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(normAngle(Math.PI / 4)).toBeCloseTo(Math.PI / 4);
    expect(normAngle(0)).toBeCloseTo(0);
  });
});

describe("mag and dist", () => {
  it("mag ignores the radius component", () => {
    expect(mag(p(3, 4, 1000))).toBe(5);
    expect(mag(p(0, 0))).toBe(0);
  });

  it("dist is symmetric and zero for identical points", () => {
    expect(dist(p(0, 0), p(3, 4))).toBe(5);
    expect(dist(p(3, 4), p(0, 0))).toBe(5);
    expect(dist(p(7, 7), p(7, 7))).toBe(0);
  });
});

describe("clamp", () => {
  it("bounds the value on both sides and passes the middle through", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it("returns the boundaries exactly", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("distancePointToSegment", () => {
  it("measures perpendicular distance when the foot is inside the segment", () => {
    expect(distancePointToSegment(p(5, 3), p(0, 0), p(10, 0))).toBeCloseTo(3);
  });

  it("clamps to the nearest endpoint when the projection falls outside", () => {
    // beyond the far end
    expect(distancePointToSegment(p(20, 0), p(0, 0), p(10, 0))).toBeCloseTo(10);
    // behind the near end
    expect(distancePointToSegment(p(-10, 0), p(0, 0), p(10, 0))).toBeCloseTo(
      10,
    );
  });

  it("returns zero for a point lying on the segment", () => {
    expect(distancePointToSegment(p(5, 0), p(0, 0), p(10, 0))).toBeCloseTo(0);
  });

  it("degenerates to point-to-point distance for a zero-length segment", () => {
    expect(distancePointToSegment(p(3, 4), p(0, 0), p(0, 0))).toBeCloseTo(5);
  });
});
