import type { Curve, Degrees, GlobalPoint } from "../math";
import {
  curve,
  degreesToRadians,
  lineSegment,
  lineSegmentRotate,
  point,
  pointRotateDegs,
} from "../math";
import { pointOnCurve, pointOnPolyline } from "./collision";
import type { Polyline } from "./geometry/shape";

describe("point and curve", () => {
  const c: Curve<GlobalPoint> = curve(
    point(1.4, 1.65),
    point(1.9, 7.9),
    point(5.9, 1.65),
    point(6.44, 4.84),
  );

  it("point on curve", () => {
    expect(pointOnCurve(c[0], c, 10e-5)).toBe(true);
    expect(pointOnCurve(c[3], c, 10e-5)).toBe(true);

    expect(pointOnCurve(point(2, 4), c, 0.1)).toBe(true);
    expect(pointOnCurve(point(4, 4.4), c, 0.1)).toBe(true);
    expect(pointOnCurve(point(5.6, 3.85), c, 0.1)).toBe(true);

    expect(pointOnCurve(point(5.6, 4), c, 0.1)).toBe(false);
    expect(pointOnCurve(c[1], c, 0.1)).toBe(false);
    expect(pointOnCurve(c[2], c, 0.1)).toBe(false);
  });
});

describe("point and polylines", () => {
  const polyline: Polyline<GlobalPoint> = [
    lineSegment(point(1, 0), point(1, 2)),
    lineSegment(point(1, 2), point(2, 2)),
    lineSegment(point(2, 2), point(2, 1)),
    lineSegment(point(2, 1), point(3, 1)),
  ];

  it("point on the line", () => {
    expect(pointOnPolyline(point(1, 0), polyline)).toBe(true);
    expect(pointOnPolyline(point(1, 2), polyline)).toBe(true);
    expect(pointOnPolyline(point(2, 2), polyline)).toBe(true);
    expect(pointOnPolyline(point(2, 1), polyline)).toBe(true);
    expect(pointOnPolyline(point(3, 1), polyline)).toBe(true);

    expect(pointOnPolyline(point(1, 1), polyline)).toBe(true);
    expect(pointOnPolyline(point(2, 1.5), polyline)).toBe(true);
    expect(pointOnPolyline(point(2.5, 1), polyline)).toBe(true);

    expect(pointOnPolyline(point(0, 1), polyline)).toBe(false);
    expect(pointOnPolyline(point(2.1, 1.5), polyline)).toBe(false);
  });

  it("point on the line with rotation", () => {
    const truePoints = [
      point(1, 0),
      point(1, 2),
      point(2, 2),
      point(2, 1),
      point(3, 1),
    ];

    truePoints.forEach((p) => {
      const rotation = (Math.random() * 360) as Degrees;
      const rotatedPoint = pointRotateDegs(p, point(0, 0), rotation);
      const rotatedPolyline = polyline.map((line) =>
        lineSegmentRotate(line, degreesToRadians(rotation), point(0, 0)),
      );
      expect(pointOnPolyline(rotatedPoint, rotatedPolyline)).toBe(true);
    });

    const falsePoints = [point(0, 1), point(2.1, 1.5)];

    falsePoints.forEach((p) => {
      const rotation = (Math.random() * 360) as Degrees;
      const rotatedPoint = pointRotateDegs(p, point(0, 0), rotation);
      const rotatedPolyline = polyline.map((line) =>
        lineSegmentRotate(line, degreesToRadians(rotation), point(0, 0)),
      );
      expect(pointOnPolyline(rotatedPoint, rotatedPolyline)).toBe(false);
    });
  });
});
