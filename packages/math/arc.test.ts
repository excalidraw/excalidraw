import { radians } from "./angle";
import { arc, isPointOnSymmetricArc } from "./arc";
import { point } from "./point";

describe("point on arc", () => {
  it("should detect point on simple arc", () => {
    expect(
      isPointOnSymmetricArc(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        point(0.92291667, 0.385),
      ),
    ).toBe(true);
  });
  it("should not detect point outside of a simple arc", () => {
    expect(
      isPointOnSymmetricArc(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        point(-0.92291667, 0.385),
      ),
    ).toBe(false);
  });
  it("should not detect point with good angle but incorrect radius", () => {
    expect(
      isPointOnSymmetricArc(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        point(-0.5, 0.5),
      ),
    ).toBe(false);
  });
});
