import {
  pointFrom,
  lineSegment,
  polygon,
  pointOnLineSegment,
  pointOnPolygon,
  polygonIncludesPoint,
  segmentsIntersectAt,
} from "@excalidraw/math";

import type {
  GlobalPoint,
  LineSegment,
  Polygon,
  Radians,
} from "@excalidraw/math";

import { pointInEllipse, pointOnEllipse, type Ellipse } from "./shape";

describe("point and line", () => {
  // const l: Line<GlobalPoint> = line(point(1, 0), point(1, 2));

  // it("point on left or right of line", () => {
  //   expect(pointLeftofLine(point(0, 1), l)).toBe(true);
  //   expect(pointLeftofLine(point(1, 1), l)).toBe(false);
  //   expect(pointLeftofLine(point(2, 1), l)).toBe(false);

  //   expect(pointRightofLine(point(0, 1), l)).toBe(false);
  //   expect(pointRightofLine(point(1, 1), l)).toBe(false);
  //   expect(pointRightofLine(point(2, 1), l)).toBe(true);
  // });

  const s: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(1, 0),
    pointFrom(1, 2),
  );

  it("point on the line", () => {
    expect(pointOnLineSegment(pointFrom(0, 1), s)).toBe(false);
    expect(pointOnLineSegment(pointFrom(1, 1), s, 0)).toBe(true);
    expect(pointOnLineSegment(pointFrom(2, 1), s)).toBe(false);
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

describe("point and ellipse", () => {
  const ellipse: Ellipse<GlobalPoint> = {
    center: pointFrom(0, 0),
    angle: 0 as Radians,
    halfWidth: 2,
    halfHeight: 1,
  };

  it("point on ellipse", () => {
    [
      pointFrom(0, 1),
      pointFrom(0, -1),
      pointFrom(2, 0),
      pointFrom(-2, 0),
    ].forEach((p) => {
      expect(pointOnEllipse(p, ellipse)).toBe(true);
    });
    expect(pointOnEllipse(pointFrom(-1.4, 0.7), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(pointFrom(-1.4, 0.71), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(pointFrom(1.4, 0.7), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(pointFrom(1.4, 0.71), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(pointFrom(1, -0.86), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(pointFrom(1, -0.86), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(pointFrom(-1, -0.86), ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse(pointFrom(-1, -0.86), ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse(pointFrom(-1, 0.8), ellipse)).toBe(false);
    expect(pointOnEllipse(pointFrom(1, -0.8), ellipse)).toBe(false);
  });

  it("point in ellipse", () => {
    [
      pointFrom(0, 1),
      pointFrom(0, -1),
      pointFrom(2, 0),
      pointFrom(-2, 0),
    ].forEach((p) => {
      expect(pointInEllipse(p, ellipse)).toBe(true);
    });

    expect(pointInEllipse(pointFrom(-1, 0.8), ellipse)).toBe(true);
    expect(pointInEllipse(pointFrom(1, -0.8), ellipse)).toBe(true);

    expect(pointInEllipse(pointFrom(-1, 1), ellipse)).toBe(false);
    expect(pointInEllipse(pointFrom(-1.4, 0.8), ellipse)).toBe(false);
  });
});

describe("line and line", () => {
  const lineA: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(1, 4),
    pointFrom(3, 4),
  );
  const lineB: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(2, 1),
    pointFrom(2, 7),
  );
  const lineC: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(1, 8),
    pointFrom(3, 8),
  );
  const lineD: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(1, 8),
    pointFrom(3, 8),
  );
  const lineE: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(1, 9),
    pointFrom(3, 9),
  );
  const lineF: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(1, 2),
    pointFrom(3, 4),
  );
  const lineG: LineSegment<GlobalPoint> = lineSegment(
    pointFrom(0, 1),
    pointFrom(2, 3),
  );

  it("intersection", () => {
    expect(segmentsIntersectAt(lineA, lineB)).toEqual([2, 4]);
    expect(segmentsIntersectAt(lineA, lineC)).toBe(null);
    expect(segmentsIntersectAt(lineB, lineC)).toBe(null);
    expect(segmentsIntersectAt(lineC, lineD)).toBe(null); // Line overlapping line is not intersection!
    expect(segmentsIntersectAt(lineE, lineD)).toBe(null);
    expect(segmentsIntersectAt(lineF, lineG)).toBe(null);
  });
});
