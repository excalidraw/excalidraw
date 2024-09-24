import { radians } from "./angle";
import { pointInEllipse, pointOnEllipse } from "./ellipse";
import { point } from "./point";
import type { Ellipse, GlobalPoint } from "./types";

describe("point and ellipse", () => {
  const ellipse: Ellipse<GlobalPoint> = {
    center: point(0, 0),
    angle: radians(0),
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
