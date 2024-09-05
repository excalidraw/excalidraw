import * as GA from "./ga";
import { point, toString, direction, offset } from "./ga";
import * as GAPoint from "./gapoints";
import * as GALine from "./galines";
import * as GATransform from "./gatransforms";

describe("geometric algebra", () => {
  describe("points", () => {
    it("distanceToLine", () => {
      const point = GA.point(3, 3);
      const line = GALine.equation(0, 1, -1);
      expect(GAPoint.distanceToLine(point, line)).toEqual(2);
    });

    it("distanceToLine neg", () => {
      const point = GA.point(-3, -3);
      const line = GALine.equation(0, 1, -1);
      expect(GAPoint.distanceToLine(point, line)).toEqual(-4);
    });
  });
  describe("lines", () => {
    it("through", () => {
      const a = GA.point(0, 0);
      const b = GA.point(2, 0);
      expect(toString(GALine.through(a, b))).toEqual(
        toString(GALine.equation(0, 2, 0)),
      );
    });
    it("parallel", () => {
      const point = GA.point(3, 3);
      const line = GALine.equation(0, 1, -1);
      const parallel = GALine.parallel(line, 2);
      expect(GAPoint.distanceToLine(point, parallel)).toEqual(0);
    });
  });

  describe("translation", () => {
    it("points", () => {
      const start = point(2, 2);
      const move = GATransform.translation(direction(0, 1));
      const end = GATransform.apply(move, start);
      expect(toString(end)).toEqual(toString(point(2, 3)));
    });

    it("points 2", () => {
      const start = point(2, 2);
      const move = GATransform.translation(offset(3, 4));
      const end = GATransform.apply(move, start);
      expect(toString(end)).toEqual(toString(point(5, 6)));
    });

    it("lines", () => {
      const original = GALine.through(point(2, 2), point(3, 4));
      const move = GATransform.translation(offset(3, 4));
      const parallel = GATransform.apply(move, original);
      expect(toString(parallel)).toEqual(
        toString(GALine.through(point(5, 6), point(6, 8))),
      );
    });
  });
  describe("rotation", () => {
    it("points", () => {
      const start = point(2, 2);
      const pivot = point(1, 1);
      const rotate = GATransform.rotation(pivot, Math.PI / 2);
      const end = GATransform.apply(rotate, start);
      expect(toString(end)).toEqual(toString(point(2, 0)));
    });
  });
});
