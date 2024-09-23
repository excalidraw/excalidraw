import type { GlobalPoint, LineSegment, Polygon, Radians } from "../../math";
import {
  point,
  lineSegment,
  polygon,
  pointOnLineSegment,
  pointOnPolygon,
  polygonIncludesPoint,
  segmentsIntersectAt,
} from "../../math";
import { pointInEllipse, pointOnEllipse, type Ellipse } from "./shape";

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

describe("point and ellipse", () => {
  const ellipse: Ellipse<GlobalPoint> = {
    center: point(0, 0),
    angle: 0 as Radians,
    halfWidth: 2,
    halfHeight: 1,
  };

  it("point on ellipse", () => {
    [point(0, 1), point(0, -1), point(2, 0), point(-2, 0)].forEach((p) => {
      expect(pointOnEllipse(p, ellipse)).toBe(true);
    });
    expect(pointOnEllipse(point(-1.4, 0.7), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(point(-1.4, 0.71), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(point(1.4, 0.7), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(point(1.4, 0.71), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(point(1, -0.86), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(point(1, -0.86), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(point(-1, -0.86), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(point(-1, -0.86), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(point(-1, 0.8), ellipse)).toBe(false);
    expect(pointOnEllipse(point(1, -0.8), ellipse)).toBe(false);
  });

  it("point in ellipse", () => {
    [point(0, 1), point(0, -1), point(2, 0), point(-2, 0)].forEach((p) => {
      expect(pointInEllipse(p, ellipse)).toBe(true);
    });

    expect(pointInEllipse(point(-1, 0.8), ellipse)).toBe(true);
    expect(pointInEllipse(point(1, -0.8), ellipse)).toBe(true);

    expect(pointInEllipse(point(-1, 1), ellipse)).toBe(false);
    expect(pointInEllipse(point(-1.4, 0.8), ellipse)).toBe(false);
  });
});
