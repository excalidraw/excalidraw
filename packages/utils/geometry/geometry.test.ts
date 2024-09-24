import type { GlobalPoint, LineSegment, Polygon } from "../../math";
import {
  point,
  lineSegment,
  polygon,
  pointOnLineSegment,
  pointOnPolygon,
  polygonIncludesPoint,
} from "../../math";

describe("point and line", () => {
  const s: LineSegment<GlobalPoint> = lineSegment(point(1, 0), point(1, 2));

  it("point on the line", () => {
    expect(pointOnLineSegment(point(0, 1), s)).toBe(false);
    expect(pointOnLineSegment(point(1, 1), s, 0)).toBe(true);
    expect(pointOnLineSegment(point(2, 1), s)).toBe(false);
  });
});

describe("point and polygon", () => {
  const poly: Polygon<GlobalPoint> = polygon(
    point(10, 10),
    point(50, 10),
    point(50, 50),
    point(10, 50),
  );

  it("point on polygon", () => {
    expect(pointOnPolygon(point(30, 10), poly)).toBe(true);
    expect(pointOnPolygon(point(50, 30), poly)).toBe(true);
    expect(pointOnPolygon(point(30, 50), poly)).toBe(true);
    expect(pointOnPolygon(point(10, 30), poly)).toBe(true);
    expect(pointOnPolygon(point(30, 30), poly)).toBe(false);
    expect(pointOnPolygon(point(30, 70), poly)).toBe(false);
  });

  it("point in polygon", () => {
    const poly: Polygon<GlobalPoint> = polygon(
      point(0, 0),
      point(2, 0),
      point(2, 2),
      point(0, 2),
    );
    expect(polygonIncludesPoint(point(1, 1), poly)).toBe(true);
    expect(polygonIncludesPoint(point(3, 3), poly)).toBe(false);
  });
});
