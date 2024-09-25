import { point } from "./point";
import { segment, segmentsIntersectAt } from "./segment";
import type { GlobalPoint, Segment } from "./types";

describe("segment intersects segment", () => {
  const lineA: Segment<GlobalPoint> = segment(point(1, 4), point(3, 4));
  const lineB: Segment<GlobalPoint> = segment(point(2, 1), point(2, 7));
  const lineC: Segment<GlobalPoint> = segment(point(1, 8), point(3, 8));
  const lineD: Segment<GlobalPoint> = segment(point(1, 8), point(3, 8));
  const lineE: Segment<GlobalPoint> = segment(point(1, 9), point(3, 9));
  const lineF: Segment<GlobalPoint> = segment(point(1, 2), point(3, 4));
  const lineG: Segment<GlobalPoint> = segment(point(0, 1), point(2, 3));

  it("intersection", () => {
    expect(segmentsIntersectAt(lineA, lineB)).toEqual([2, 4]);
    expect(segmentsIntersectAt(lineA, lineC)).toBe(null);
    expect(segmentsIntersectAt(lineB, lineC)).toBe(null);
    expect(segmentsIntersectAt(lineC, lineD)).toBe(null); // Line overlapping line is not intersection!
    expect(segmentsIntersectAt(lineE, lineD)).toBe(null);
    expect(segmentsIntersectAt(lineF, lineG)).toBe(null);
  });
});
