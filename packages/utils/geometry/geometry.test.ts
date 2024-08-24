import type {
  Curve,
  Degrees,
  GlobalPoint,
  Line,
  LineSegment,
  Polygon,
  Radians,
} from "@excalidraw/math";
import {
  point,
  line,
  lineSegment,
  lineRotate,
  lineSegmentRotate,
  degreesToRadians,
  pointRotateDegs,
  polygon,
  curve,
} from "@excalidraw/math";
import {
  lineIntersectsLine,
  pointInEllipse,
  pointInPolygon,
  pointLeftofLine,
  pointOnCurve,
  pointOnEllipse,
  pointOnLineSegment,
  pointOnPolygon,
  pointOnPolyline,
  pointRightofLine,
} from "./geometry";
import type { Ellipse, Polyline } from "./shape";

describe("point and line", () => {
  const l: Line<GlobalPoint> = line(point(1, 0), point(1, 2));

  it("point on left or right of line", () => {
    expect(pointLeftofLine(point(0, 1), l)).toBe(true);
    expect(pointLeftofLine(point(1, 1), l)).toBe(false);
    expect(pointLeftofLine(point(2, 1), l)).toBe(false);

    expect(pointRightofLine(point(0, 1), l)).toBe(false);
    expect(pointRightofLine(point(1, 1), l)).toBe(false);
    expect(pointRightofLine(point(2, 1), l)).toBe(true);
  });

  const s: LineSegment<GlobalPoint> = lineSegment(point(1, 0), point(1, 2));

  it("point on the line", () => {
    expect(pointOnLineSegment(point(0, 1), s)).toBe(false);
    expect(pointOnLineSegment(point(1, 1), s, 0)).toBe(true);
    expect(pointOnLineSegment(point(2, 1), s)).toBe(false);
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
    expect(pointInPolygon(point(1, 1), poly)).toBe(true);
    expect(pointInPolygon(point(3, 3), poly)).toBe(false);
  });
});

describe("point and curve", () => {
  const c: Curve<GlobalPoint> = curve(
    point(1.4, 1.65),
    point(1.9, 7.9),
    point(5.9, 1.65),
    point(6.44, 4.84),
  );

  it("point on curve", () => {
    expect(pointOnCurve(c[0], c)).toBe(true);
    expect(pointOnCurve(c[3], c)).toBe(true);

    expect(pointOnCurve(point(2, 4), c, 0.1)).toBe(true);
    expect(pointOnCurve(point(4, 4.4), c, 0.1)).toBe(true);
    expect(pointOnCurve(point(5.6, 3.85), c, 0.1)).toBe(true);

    expect(pointOnCurve(point(5.6, 4), c, 0.1)).toBe(false);
    expect(pointOnCurve(c[1], c, 0.1)).toBe(false);
    expect(pointOnCurve(c[2], c, 0.1)).toBe(false);
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

describe("line and line", () => {
  const lineA: LineSegment<GlobalPoint> = lineSegment(point(1, 4), point(3, 4));
  const lineB: LineSegment<GlobalPoint> = lineSegment(point(2, 1), point(2, 7));
  const lineC: LineSegment<GlobalPoint> = lineSegment(point(1, 8), point(3, 8));
  const lineD: LineSegment<GlobalPoint> = lineSegment(point(1, 8), point(3, 8));
  const lineE: LineSegment<GlobalPoint> = lineSegment(point(1, 9), point(3, 9));
  const lineF: LineSegment<GlobalPoint> = lineSegment(point(1, 2), point(3, 4));
  const lineG: LineSegment<GlobalPoint> = lineSegment(point(0, 1), point(2, 3));

  it("intersection", () => {
    expect(lineIntersectsLine(lineA, lineB)).toBe(true);
    expect(lineIntersectsLine(lineA, lineC)).toBe(false);
    expect(lineIntersectsLine(lineB, lineC)).toBe(false);
    expect(lineIntersectsLine(lineC, lineD)).toBe(true);
    expect(lineIntersectsLine(lineE, lineD)).toBe(false);
    expect(lineIntersectsLine(lineF, lineG)).toBe(true);
  });
});
