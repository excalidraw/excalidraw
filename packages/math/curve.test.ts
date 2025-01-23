import "../utils/test-utils";
import { curve, curveIntersectLine } from "./curve";
import { line } from "./line";
import { pointFrom } from "./point";

describe("Math curve", () => {
  describe("line intersection", () => {
    it("point is found when control points are the same", () => {
      const c = curve(
        pointFrom(100, 0),
        pointFrom(100, 100),
        pointFrom(100, 100),
        pointFrom(0, 100),
      );
      const l = line(pointFrom(0, 0), pointFrom(200, 200));

      expect(curveIntersectLine(c, l)).toCloselyEqualPoints([[87.5, 87.5]]);
    });

    it("point is found when control points aren't the same", () => {
      const c = curve(
        pointFrom(100, 0),
        pointFrom(100, 60),
        pointFrom(60, 100),
        pointFrom(0, 100),
      );
      const l = line(pointFrom(0, 0), pointFrom(200, 200));

      expect(curveIntersectLine(c, l)).toCloselyEqualPoints([[72.5, 72.5]]);
    });

    it("points are found when curve is sliced at 3 points", () => {
      const c = curve(
        pointFrom(-50, -50),
        pointFrom(10, -50),
        pointFrom(10, 50),
        pointFrom(50, 50),
      );
      const l = line(pointFrom(0, 112.5), pointFrom(90, 0));

      expect(curveIntersectLine(c, l)).toCloselyEqualPoints([
        [49.99999999999996, 49.99999999999997],
        [70.47732960327718, 24.403337995903534],
        [10.970762294018797, 98.78654713247653],
      ]);
    });
  });
});
