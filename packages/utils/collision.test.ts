import {
  curve,
  degreesToRadians,
  lineSegment,
  lineSegmentRotate,
  pointFrom,
  pointRotateDegs,
} from "@excalidraw/math";

import type { Curve, Degrees, GlobalPoint } from "@excalidraw/math";

import { pointOnCurve, pointOnPolyline } from "./collision";

import type { Polyline } from "./geometry/shape";

describe("point and curve", () => {
  const c: Curve<GlobalPoint> = curve(
    pointFrom(1.4, 1.65),
    pointFrom(1.9, 7.9),
    pointFrom(5.9, 1.65),
    pointFrom(6.44, 4.84),
  );

  it("point on curve", () => {
    expect(pointOnCurve(c[0], c, 10e-5)).toBe(true);
    expect(pointOnCurve(c[3], c, 10e-5)).toBe(true);

    expect(pointOnCurve(pointFrom(2, 4), c, 0.1)).toBe(true);
    expect(pointOnCurve(pointFrom(4, 4.4), c, 0.1)).toBe(true);
    expect(pointOnCurve(pointFrom(5.6, 3.85), c, 0.1)).toBe(true);

    expect(pointOnCurve(pointFrom(5.6, 4), c, 0.1)).toBe(false);
    expect(pointOnCurve(c[1], c, 0.1)).toBe(false);
    expect(pointOnCurve(c[2], c, 0.1)).toBe(false);
  });
});

describe("point and polylines", () => {
  const polyline: Polyline<GlobalPoint> = [
    lineSegment(pointFrom(1, 0), pointFrom(1, 2)),
    lineSegment(pointFrom(1, 2), pointFrom(2, 2)),
    lineSegment(pointFrom(2, 2), pointFrom(2, 1)),
    lineSegment(pointFrom(2, 1), pointFrom(3, 1)),
  ];

  it("point on the line", () => {
    expect(pointOnPolyline(pointFrom(1, 0), polyline)).toBe(true);
    expect(pointOnPolyline(pointFrom(1, 2), polyline)).toBe(true);
    expect(pointOnPolyline(pointFrom(2, 2), polyline)).toBe(true);
    expect(pointOnPolyline(pointFrom(2, 1), polyline)).toBe(true);
    expect(pointOnPolyline(pointFrom(3, 1), polyline)).toBe(true);

    expect(pointOnPolyline(pointFrom(1, 1), polyline)).toBe(true);
    expect(pointOnPolyline(pointFrom(2, 1.5), polyline)).toBe(true);
    expect(pointOnPolyline(pointFrom(2.5, 1), polyline)).toBe(true);

    expect(pointOnPolyline(pointFrom(0, 1), polyline)).toBe(false);
    expect(pointOnPolyline(pointFrom(2.1, 1.5), polyline)).toBe(false);
  });

  it("point on the line with rotation", () => {
    const truePoints = [
      pointFrom(1, 0),
      pointFrom(1, 2),
      pointFrom(2, 2),
      pointFrom(2, 1),
      pointFrom(3, 1),
    ];

    truePoints.forEach((p) => {
      const rotation = (Math.random() * 360) as Degrees;
      const rotatedPoint = pointRotateDegs(p, pointFrom(0, 0), rotation);
      const rotatedPolyline = polyline.map((line) =>
        lineSegmentRotate(line, degreesToRadians(rotation), pointFrom(0, 0)),
      );
      expect(pointOnPolyline(rotatedPoint, rotatedPolyline)).toBe(true);
    });

    const falsePoints = [pointFrom(0, 1), pointFrom(2.1, 1.5)];

    falsePoints.forEach((p) => {
      const rotation = (Math.random() * 360) as Degrees;
      const rotatedPoint = pointRotateDegs(p, pointFrom(0, 0), rotation);
      const rotatedPolyline = polyline.map((line) =>
        lineSegmentRotate(line, degreesToRadians(rotation), pointFrom(0, 0)),
      );
      expect(pointOnPolyline(rotatedPoint, rotatedPolyline)).toBe(false);
    });
  });
});
