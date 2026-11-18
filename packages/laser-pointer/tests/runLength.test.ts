import { runLength } from "../src/math";

// Points are [x, y, r] — r is the pressure/radius component, irrelevant here.
describe("runLength", () => {
  it("returns 0 for fewer than two points", () => {
    expect(runLength([])).toBe(0);
    expect(runLength([[5, 5, 0]])).toBe(0);
  });

  it("counts the only segment once for a two-point path", () => {
    expect(
      runLength([
        [0, 0, 0],
        [10, 0, 0],
      ]),
    ).toBe(10);
  });

  it("counts each segment once for a multi-point path", () => {
    expect(
      runLength([
        [0, 0, 0],
        [10, 0, 0],
        [10, 10, 0],
        [0, 10, 0],
      ]),
    ).toBe(30);
  });

  it("adds up straight and diagonal segments of an open path", () => {
    expect(
      runLength([
        [0, 0, 0],
        [3, 0, 0],
        [0, 4, 0],
      ]),
    ).toBe(8);
  });
});
