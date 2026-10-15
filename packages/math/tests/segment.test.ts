import { pointFrom } from "../src/point";
import {
  lineSegment,
  lineSegmentIntersectionPoints,
  isLineSegment,
  segmentsIntersectAt,
} from "../src/segment";

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
describe("segmentsIntersectAt", () => {
  it("should detect a regular crossing", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(5, -5), pointFrom(5, 5)),
      ),
    ).toEqual(pointFrom(5, 0));
  });

  it("should detect a T-junction where the second segment's start point lies on the first segment", () => {
    // Previously this returned null because of an erroneous `u === 0` guard,
    // even though the segments clearly intersect at (5, 0).
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(5, 0), pointFrom(5, 10)),
      ),
    ).toEqual(pointFrom(5, 0));
  });

  it("should return null when the segments do not intersect", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(10, 0)),
        lineSegment(pointFrom(0, 5), pointFrom(10, 5)),
      ),
    ).toBe(null);
  });

  it("should return null when a would-be intersection lies beyond a segment's end", () => {
    expect(
      segmentsIntersectAt(
        lineSegment(pointFrom(0, 0), pointFrom(4, 0)),
        lineSegment(pointFrom(5, 0), pointFrom(5, 10)),
      ),
    ).toBe(null);
  });
});

describe("isLineSegment validation", () => {
  it("should return true for a valid segment", () => {
    expect(
      isLineSegment([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(true);
  });

  it("should return false if second element is not a point", () => {
    const invalidSegment = [[0, 0], "not-a-point"] as any;

    expect(isLineSegment(invalidSegment)).toBe(false);
  });

  it("should return false for wrong length", () => {
    expect(isLineSegment([[0, 0]])).toBe(false);
  });
});
