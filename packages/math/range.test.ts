import { rangeIntersection, rangesOverlap } from "./range";

describe("range overlap", () => {
  it("should overlap when range a contains range b", () => {
    expect(rangesOverlap([1, 4], [2, 3])).toBe(true);
    expect(rangesOverlap([1, 4], [1, 4])).toBe(true);
    expect(rangesOverlap([1, 4], [1, 3])).toBe(true);
    expect(rangesOverlap([1, 4], [2, 4])).toBe(true);
  });

  it("should overlap when range b contains range a", () => {
    expect(rangesOverlap([2, 3], [1, 4])).toBe(true);
    expect(rangesOverlap([1, 3], [1, 4])).toBe(true);
    expect(rangesOverlap([2, 4], [1, 4])).toBe(true);
  });

  it("should overlap when range a and b intersect", () => {
    expect(rangesOverlap([1, 4], [2, 5])).toBe(true);
  });
});

describe("range intersection", () => {
  it("should intersect completely with itself", () => {
    expect(rangeIntersection([1, 4], [1, 4])).toEqual([1, 4]);
  });

  it("should intersect irrespective of order", () => {
    expect(rangeIntersection([1, 4], [2, 3])).toEqual([2, 3]);
    expect(rangeIntersection([2, 3], [1, 4])).toEqual([2, 3]);
    expect(rangeIntersection([1, 4], [3, 5])).toEqual([3, 4]);
    expect(rangeIntersection([3, 5], [1, 4])).toEqual([3, 4]);
  });

  it("should intersect at the edge", () => {
    expect(rangeIntersection([1, 4], [4, 5])).toEqual([4, 4]);
  });

  it("should not intersect", () => {
    expect(rangeIntersection([1, 4], [5, 7])).toEqual(null);
  });
});
