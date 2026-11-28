import { douglasPeucker } from "../src/simplify";

import type { Point } from "../src/math";

describe("douglasPeucker", () => {
  it("does not simplify points for a non-positive tolerance", () => {
    const points: Point[] = [
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
    ];

    expect(douglasPeucker([...points], -1)).toEqual(points);
  });
});
