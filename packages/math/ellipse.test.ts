import { radians } from "./angle";
import {
  ellipse,
  interceptPointsOfLineAndEllipse,
  pointInEllipse,
  pointOnEllipse,
} from "./ellipse";
import { point } from "./point";
import { lineSegment } from "./segment";
import type { Ellipse, GlobalPoint } from "./types";

describe("point and ellipse", () => {
  const target: Ellipse<GlobalPoint> = ellipse(point(0, 0), radians(0), 2, 1);

  it("point on ellipse", () => {
    [point(0, 1), point(0, -1), point(2, 0), point(-2, 0)].forEach((p) => {
      expect(pointOnEllipse(p, target)).toBe(true);
    });
    expect(pointOnEllipse(point(-1.4, 0.7), target, 0.1)).toBe(true);
    expect(pointOnEllipse(point(-1.4, 0.71), target, 0.01)).toBe(true);

    expect(pointOnEllipse(point(1.4, 0.7), target, 0.1)).toBe(true);
    expect(pointOnEllipse(point(1.4, 0.71), target, 0.01)).toBe(true);

    expect(pointOnEllipse(point(1, -0.86), target, 0.1)).toBe(true);
    expect(pointOnEllipse(point(1, -0.86), target, 0.01)).toBe(true);

    expect(pointOnEllipse(point(-1, -0.86), target, 0.1)).toBe(true);
    expect(pointOnEllipse(point(-1, -0.86), target, 0.01)).toBe(true);

    expect(pointOnEllipse(point(-1, 0.8), target)).toBe(false);
    expect(pointOnEllipse(point(1, -0.8), target)).toBe(false);
  });

  it("point in ellipse", () => {
    [point(0, 1), point(0, -1), point(2, 0), point(-2, 0)].forEach((p) => {
      expect(pointInEllipse(p, target)).toBe(true);
    });

    expect(pointInEllipse(point(-1, 0.8), target)).toBe(true);
    expect(pointInEllipse(point(1, -0.8), target)).toBe(true);

    expect(pointInEllipse(point(-1, 1), target)).toBe(false);
    expect(pointInEllipse(point(-1.4, 0.8), target)).toBe(false);
  });
});

describe("line and ellipse", () => {
  it("detects outside segment", () => {
    const l = lineSegment<GlobalPoint>(point(-100, 0), point(-10, 0));
    const e = ellipse(point(0, 0), radians(0), 2, 2);
    expect(interceptPointsOfLineAndEllipse(e, l).length).toBe(0);
  });
});
