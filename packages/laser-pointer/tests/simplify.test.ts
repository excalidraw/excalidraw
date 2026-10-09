import { describe, expect, it } from "vitest";

import { type Point } from "../src/math";
import { douglasPeucker } from "../src/simplify";

const p = (x: number, y: number, r = 0): Point => [x, y, r];

describe("douglasPeucker", () => {
  it("returns the input untouched when epsilon is 0", () => {
    const points = [p(0, 0), p(5, 5), p(10, 0)];
    expect(douglasPeucker(points, 0)).toBe(points);
  });

  it("passes through paths of two points or fewer", () => {
    expect(douglasPeucker([], 1)).toEqual([]);
    const one = [p(1, 1)];
    expect(douglasPeucker(one, 1)).toBe(one);
    const two = [p(0, 0), p(10, 0)];
    expect(douglasPeucker(two, 1)).toBe(two);
  });

  it("drops collinear midpoints, keeping only the endpoints", () => {
    const straight = [p(0, 0), p(2, 0), p(5, 0), p(8, 0), p(10, 0)];
    expect(douglasPeucker(straight, 1)).toEqual([p(0, 0), p(10, 0)]);
  });

  it("keeps a vertex whose deviation reaches epsilon", () => {
    // apex sits 5 units off the baseline; epsilon 1 must retain it
    const result = douglasPeucker([p(0, 0), p(5, 5), p(10, 0)], 1);
    expect(result).toEqual([p(0, 0), p(5, 5), p(10, 0)]);
  });

  it("drops a vertex whose deviation is below epsilon", () => {
    // apex deviates by only 0.5, well under epsilon 2
    const result = douglasPeucker([p(0, 0), p(5, 0.5), p(10, 0)], 2);
    expect(result).toEqual([p(0, 0), p(10, 0)]);
  });

  it("treats epsilon as inclusive at the boundary", () => {
    // deviation is exactly 5, epsilon is exactly 5 -> retained (maxDistance >= epsilon)
    const result = douglasPeucker([p(0, 0), p(5, 5), p(10, 0)], 5);
    expect(result).toContainEqual(p(5, 5));
  });

  it("always preserves the first and last point", () => {
    const points = [p(0, 0), p(1, 0.1), p(2, -0.1), p(3, 0.05), p(4, 0)];
    const result = douglasPeucker(points, 10);
    expect(result[0]).toEqual(p(0, 0));
    expect(result[result.length - 1]).toEqual(p(4, 0));
  });

  it("never returns more points than it was given, and keeps them in order", () => {
    const points = [
      p(0, 0),
      p(1, 4),
      p(2, 1),
      p(3, 6),
      p(4, 2),
      p(5, 5),
      p(6, 0),
    ];
    const result = douglasPeucker(points, 1.5);

    expect(result.length).toBeLessThanOrEqual(points.length);

    const indices = result.map((point) =>
      points.findIndex(([x, y]) => x === point[0] && y === point[1]),
    );
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it("simplifies more aggressively as epsilon grows", () => {
    const points = [p(0, 0), p(1, 3), p(2, 1), p(3, 4), p(4, 1), p(5, 0)];
    const fine = douglasPeucker(points, 0.5);
    const coarse = douglasPeucker(points, 3);
    expect(coarse.length).toBeLessThanOrEqual(fine.length);
  });
});
