import {
  ellipse,
  ellipseSegmentInterceptPoints,
  ellipseIncludesPoint,
  ellipseTouchesPoint,
  ellipseLineIntersectionPoints,
} from "../src/ellipse";
import { line } from "../src/line";
import { pointFrom } from "../src/point";
import { lineSegment } from "../src/segment";

import type { Ellipse, GlobalPoint } from "../src/types";

describe("point and ellipse", () => {
  it("point on ellipse", () => {
    const target: Ellipse<GlobalPoint> = ellipse(pointFrom(1, 2), 2, 1);
    [
      pointFrom(1, 3),
      pointFrom(1, 1),
      pointFrom(3, 2),
      pointFrom(-1, 2),
    ].forEach((p) => {
      expect(ellipseTouchesPoint(p, target)).toBe(true);
    });
    expect(ellipseTouchesPoint(pointFrom(-0.4, 2.7), target, 0.1)).toBe(true);
    expect(ellipseTouchesPoint(pointFrom(-0.4, 2.71), target, 0.01)).toBe(true);

    expect(ellipseTouchesPoint(pointFrom(2.4, 2.7), target, 0.1)).toBe(true);
    expect(ellipseTouchesPoint(pointFrom(2.4, 2.71), target, 0.01)).toBe(true);

    expect(ellipseTouchesPoint(pointFrom(2, 1.14), target, 0.1)).toBe(true);
    expect(ellipseTouchesPoint(pointFrom(2, 1.14), target, 0.01)).toBe(true);

    expect(ellipseTouchesPoint(pointFrom(0, 1.14), target, 0.1)).toBe(true);
    expect(ellipseTouchesPoint(pointFrom(0, 1.14), target, 0.01)).toBe(true);

    expect(ellipseTouchesPoint(pointFrom(0, 2.8), target)).toBe(false);
    expect(ellipseTouchesPoint(pointFrom(2, 1.2), target)).toBe(false);
  });

  it("point in ellipse", () => {
    const target: Ellipse<GlobalPoint> = ellipse(pointFrom(0, 0), 2, 1);
    [
      pointFrom(0, 1),
      pointFrom(0, -1),
      pointFrom(2, 0),
      pointFrom(-2, 0),
    ].forEach((p) => {
      expect(ellipseIncludesPoint(p, target)).toBe(true);
    });

    expect(ellipseIncludesPoint(pointFrom(-1, 0.8), target)).toBe(true);
    expect(ellipseIncludesPoint(pointFrom(1, -0.8), target)).toBe(true);

    // Point on outline
    expect(ellipseIncludesPoint(pointFrom(2, 0), target)).toBe(true);

    expect(ellipseIncludesPoint(pointFrom(-1, 1), target)).toBe(false);
    expect(ellipseIncludesPoint(pointFrom(-1.4, 0.8), target)).toBe(false);
  });
});

describe("segment and ellipse", () => {
  it("detects outside segment", () => {
    const e = ellipse(pointFrom(0, 0), 2, 2);

    expect(
      ellipseSegmentInterceptPoints(
        e,
        lineSegment<GlobalPoint>(pointFrom(-100, 0), pointFrom(-10, 0)),
      ),
    ).toEqual([]);
    expect(
      ellipseSegmentInterceptPoints(
        e,
        lineSegment<GlobalPoint>(pointFrom(-10, 0), pointFrom(10, 0)),
      ),
    ).toEqual([pointFrom(-2, 0), pointFrom(2, 0)]);
    expect(
      ellipseSegmentInterceptPoints(
        e,
        lineSegment<GlobalPoint>(pointFrom(-10, -2), pointFrom(10, -2)),
      ),
    ).toEqual([pointFrom(0, -2)]);
    expect(
      ellipseSegmentInterceptPoints(
        e,
        lineSegment<GlobalPoint>(pointFrom(0, -1), pointFrom(0, 1)),
      ),
    ).toEqual([]);
  });
});

describe("line and ellipse", () => {
  const e = ellipse(pointFrom(0, 0), 2, 2);

  it("detects outside line", () => {
    expect(
      ellipseLineIntersectionPoints(
        e,
        line<GlobalPoint>(pointFrom(-10, -10), pointFrom(10, -10)),
      ),
    ).toEqual([]);
  });
  it("detects line intersecting ellipse", () => {
    expect(
      ellipseLineIntersectionPoints(
        e,
        line<GlobalPoint>(pointFrom(0, -1), pointFrom(0, 1)),
      ),
    ).toEqual([pointFrom(0, 2), pointFrom(0, -2)]);
    expect(
      ellipseLineIntersectionPoints(
        e,
        line<GlobalPoint>(pointFrom(-100, 0), pointFrom(-10, 0)),
      ).map(([x, y]) => pointFrom(Math.round(x), Math.round(y))),
    ).toEqual([pointFrom(2, 0), pointFrom(-2, 0)]);
  });
  it("detects line touching ellipse", () => {
    expect(
      ellipseLineIntersectionPoints(
        e,
        line<GlobalPoint>(pointFrom(-2, -2), pointFrom(2, -2)),
      ),
    ).toEqual([pointFrom(0, -2)]);
  });
});
