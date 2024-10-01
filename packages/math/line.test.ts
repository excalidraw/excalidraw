import { line, lineLineIntersectionPoint, lineSegmentIntersectionPoints } from "./line";
import { point } from "./point";
import { segment } from "./segment";

describe("line-line intersections", () => {
  it("should correctly detect intersection at origin", () => {
    expect(
      lineLineIntersectionPoint(
        line(point(-5, -5), point(5, 5)),
        line(point(5, -5), point(-5, 5)),
      ),
    ).toEqual(point(0, 0));
  });

  it("should correctly detect intersection at non-origin", () => {
    expect(
      lineLineIntersectionPoint(
        line(point(0, 0), point(10, 10)),
        line(point(10, 0), point(0, 10)),
      ),
    ).toEqual(point(5, 5));
  });

  it("should correctly detect parallel lines", () => {
    expect(
      lineLineIntersectionPoint(
        line(point(0, 0), point(0, 10)),
        line(point(10, 0), point(10, 10)),
      ),
    ).toBe(null);
  });
});

describe("line-segment intersections", () => {
  it("should correctly detect intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        line(point(0, 0), point(5, 0)),
        segment(point(2, -2), point(3, 2)),
      ),
    ).toEqual(point(2.5, -0));
  });
  it("should correctly detect non-intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        line(point(0, 0), point(5, 0)),
        segment(point(3, 1), point(4, 4)),
      ),
    ).toEqual(null);
  });
});
