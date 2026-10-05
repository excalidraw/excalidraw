import { diffStringsUnified } from "jest-diff";

expect.extend({
  toCloselyEqualPoints(received, expected, precision) {
    if (!Array.isArray(received) || !Array.isArray(expected)) {
      throw new Error("expected and received are not point arrays");
    }

    const COMPARE = 1 / precision === 0 ? 1 : Math.pow(10, precision ?? 2);
    const pass = expected.every(
      (point, idx) =>
        Math.abs(received[idx][0] - point[0]) < COMPARE &&
        Math.abs(received[idx][1] - point[1]) < COMPARE,
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
