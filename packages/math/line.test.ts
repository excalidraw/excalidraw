import {
  line,
  lineLineIntersectionPoint,
  lineSegmentIntersectionPoints,
} from "./line";
import { pointFrom } from "./point";
import { segment } from "./segment";

describe("line-line intersections", () => {
  it("should correctly detect intersection at origin", () => {
    expect(
      lineLineIntersectionPoint(
        line(pointFrom(-5, -5), pointFrom(5, 5)),
        line(pointFrom(5, -5), pointFrom(-5, 5)),
      ),
    ).toEqual(pointFrom(0, 0));
  });

  it("should correctly detect intersection at non-origin", () => {
    expect(
      lineLineIntersectionPoint(
        line(pointFrom(0, 0), pointFrom(10, 10)),
        line(pointFrom(10, 0), pointFrom(0, 10)),
      ),
    ).toEqual(pointFrom(5, 5));
  });

  it("should correctly detect parallel lines", () => {
    expect(
      lineLineIntersectionPoint(
        line(pointFrom(0, 0), pointFrom(0, 10)),
        line(pointFrom(10, 0), pointFrom(10, 10)),
      ),
    ).toBe(null);
  });
});

describe("line-segment intersections", () => {
  it("should correctly detect intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        line(pointFrom(0, 0), pointFrom(5, 0)),
        segment(pointFrom(2, -2), pointFrom(3, 2)),
      ),
    ).toEqual(pointFrom(2.5, -0));
  });
  it("should correctly detect non-intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        line(pointFrom(0, 0), pointFrom(5, 0)),
        segment(pointFrom(3, 1), pointFrom(4, 4)),
      ),
    ).toEqual(null);
  });
});
