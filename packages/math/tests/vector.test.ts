import { isVector } from "../src/vector";

describe("Vector", () => {
  test("isVector", () => {
    expect(isVector([5, 5])).toBe(true);
    expect(isVector([-5, -5])).toBe(true);
    expect(isVector([5, 0.5])).toBe(true);
    expect(isVector(null)).toBe(false);
    expect(isVector(undefined)).toBe(false);
    expect(isVector([5, NaN])).toBe(false);
  });
});
