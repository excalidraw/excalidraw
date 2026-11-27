import { runLength } from "./math";

describe("runLength", () => {
  it("sums each segment of the path exactly once", () => {
    expect(
      runLength([
        [0, 0, 0],
        [3, 4, 0],
        [6, 8, 0],
      ]),
    ).toBe(10);
  });
});
