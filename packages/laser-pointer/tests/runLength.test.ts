import { runLength } from "../src/math";

describe("runLength", () => {
  it("returns zero for an empty path or a single point", () => {
    expect(runLength([])).toBe(0);
    expect(runLength([[5, 5, 1]])).toBe(0);
  });

  it("counts a two-point segment once and ignores the radius", () => {
    expect(
      runLength([
        [0, 0, 1],
        [3, 4, 10],
      ]),
    ).toBe(5);
  });

  it("sums every segment of a multi-point path once", () => {
    expect(
      runLength([
        [0, 0, 1],
        [10, 0, 1],
        [10, 10, 1],
        [0, 10, 1],
      ]),
    ).toBe(30);
  });

  it("does not add distance for repeated points", () => {
    expect(
      runLength([
        [0, 0, 1],
        [0, 0, 1],
        [3, 4, 1],
      ]),
    ).toBe(5);
  });
});
