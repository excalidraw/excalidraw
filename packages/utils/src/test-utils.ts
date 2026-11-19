import { diffStringsUnified } from "jest-diff";

expect.extend({
  /**
   * Whether the points are the same, with each coordinate within
   * `10^-precision` (i.e. matching to `precision` decimal places, 2 by default)
   */
  toCloselyEqualPoints(received, expected, precision = 2) {
    if (!Array.isArray(received) || !Array.isArray(expected)) {
      throw new Error("expected and received are not point arrays");
    }

    const tolerance = Math.pow(10, -precision);
    const pass =
      received.length === expected.length &&
      expected.every(
        (point, idx) =>
          Math.abs(received[idx][0] - point[0]) < tolerance &&
          Math.abs(received[idx][1] - point[1]) < tolerance,
      );

    if (!pass) {
      return {
        message: () => ` The provided array of points are not close enough.

${diffStringsUnified(
  JSON.stringify(expected, undefined, 2),
  JSON.stringify(received, undefined, 2),
)}`,
        pass: false,
      };
    }

    return {
      message: () => `expected ${received} to not be close to ${expected}`,
      pass: true,
    };
  },
});
