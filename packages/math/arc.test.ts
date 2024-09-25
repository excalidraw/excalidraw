import { radians } from "./angle";
import { arc, arcIncludesPoint, arcSegmentInterceptPoint } from "./arc";
import { point } from "./point";
import { segment } from "./segment";

describe("point on arc", () => {
  it("should detect point on simple arc", () => {
    expect(
      arcIncludesPoint(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        point(0.92291667, 0.385),
      ),
    ).toBe(true);
  });
  it("should not detect point outside of a simple arc", () => {
    expect(
      arcIncludesPoint(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        point(-0.92291667, 0.385),
      ),
    ).toBe(false);
  });
  it("should not detect point with good angle but incorrect radius", () => {
    expect(
      arcIncludesPoint(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        point(-0.5, 0.5),
      ),
    ).toBe(false);
  });
});

describe("intersection", () => {
  it("should report correct interception point", () => {
    expect(
      arcSegmentInterceptPoint(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        segment(point(2, 1), point(0, 0)),
      ),
    ).toEqual([point(0.894427190999916, 0.447213595499958)]);
  });

  it("should report both interception points when present", () => {
    expect(
      arcSegmentInterceptPoint(
        arc(point(0, 0), 1, radians(-Math.PI / 4), radians(Math.PI / 4)),
        segment(point(0.9, -2), point(0.9, 2)),
      ),
    ).toEqual([
      point(0.9, -0.4358898943540668),
      point(0.9, 0.4358898943540668),
    ]);
  });
});
