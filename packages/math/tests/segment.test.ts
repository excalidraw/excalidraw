import { pointFrom } from "../src/point";
import { lineSegment, lineSegmentIntersectionPoints } from "../src/segment";

describe("line-segment intersections", () => {
  it("should correctly detect intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        lineSegment(pointFrom(0, 0), pointFrom(5, 0)),
        lineSegment(pointFrom(2, -2), pointFrom(3, 2)),
      ),
    ).toEqual(pointFrom(2.5, 0));
  });
  it("should correctly detect non-intersection", () => {
    expect(
      lineSegmentIntersectionPoints(
        lineSegment(pointFrom(0, 0), pointFrom(5, 0)),
        lineSegment(pointFrom(3, 1), pointFrom(4, 4)),
      ),
    ).toEqual(null);
  });
});
