import type { GlobalPoint, Segment, Polygon } from "../../math";
import {
  pointFrom,
  segment,
  polygon,
  segmentIncludesPoint,
  pointOnPolygon,
  polygonIncludesPoint,
} from "../../math";

describe("point and line", () => {
  const s: Segment<GlobalPoint> = segment(pointFrom(1, 0), pointFrom(1, 2));

  it("point on the line", () => {
    expect(segmentIncludesPoint(pointFrom(0, 1), s)).toBe(false);
    expect(segmentIncludesPoint(pointFrom(1, 1), s, 0)).toBe(true);
    expect(segmentIncludesPoint(pointFrom(2, 1), s)).toBe(false);
  });
});

describe("point and polygon", () => {
  const poly: Polygon<GlobalPoint> = polygon(
    pointFrom(10, 10),
    pointFrom(50, 10),
    pointFrom(50, 50),
    pointFrom(10, 50),
  );

  it("point on polygon", () => {
    expect(pointOnPolygon(pointFrom(30, 10), poly)).toBe(true);
    expect(pointOnPolygon(pointFrom(50, 30), poly)).toBe(true);
    expect(pointOnPolygon(pointFrom(30, 50), poly)).toBe(true);
    expect(pointOnPolygon(pointFrom(10, 30), poly)).toBe(true);
    expect(pointOnPolygon(pointFrom(30, 30), poly)).toBe(false);
    expect(pointOnPolygon(pointFrom(30, 70), poly)).toBe(false);
  });

  it("point in polygon", () => {
    const poly: Polygon<GlobalPoint> = polygon(
      pointFrom(0, 0),
      pointFrom(2, 0),
      pointFrom(2, 2),
      pointFrom(0, 2),
    );
    expect(polygonIncludesPoint(pointFrom(1, 1), poly)).toBe(true);
    expect(polygonIncludesPoint(pointFrom(3, 3), poly)).toBe(false);
  });
});
