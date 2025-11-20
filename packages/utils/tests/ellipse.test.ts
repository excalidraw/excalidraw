import { pointFrom, type Radians } from "@excalidraw/math";

import { pointInEllipse, pointOnEllipse } from "../src/shape";

describe("ellipse helpers handle zero-sized axes", () => {
  const degenerateEllipse = {
    center: pointFrom(0, 0),
    angle: 0 as Radians,
    halfWidth: 0,
    halfHeight: 0,
  };

  it("pointInEllipse treats zero-sized ellipse as a point", () => {
    expect(pointInEllipse(pointFrom(0, 0), degenerateEllipse)).toBe(true);
    expect(pointInEllipse(pointFrom(1, 0), degenerateEllipse)).toBe(false);
  });

  it("pointOnEllipse does not error for zero-sized ellipse", () => {
    expect(() =>
      pointOnEllipse(pointFrom(0, 0), degenerateEllipse),
    ).not.toThrow();
    expect(pointOnEllipse(pointFrom(0, 0), degenerateEllipse)).toBe(true);
    expect(pointOnEllipse(pointFrom(2, 0), degenerateEllipse)).toBe(false);
  });
});

