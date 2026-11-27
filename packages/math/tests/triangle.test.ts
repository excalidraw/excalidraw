import { pointFrom } from "../src/point";
import { triangleIncludesPoint } from "../src/triangle";

import type { GlobalPoint, Triangle } from "../src/types";

describe("triangleIncludesPoint", () => {
  const a = pointFrom<GlobalPoint>(0, 0);
  const b = pointFrom<GlobalPoint>(10, 0);
  const c = pointFrom<GlobalPoint>(0, 10);

  const triangle = [a, b, c] as Triangle<GlobalPoint>;
  // same triangle, opposite winding order
  const reversedTriangle = [a, c, b] as Triangle<GlobalPoint>;

  it("should include a point strictly inside the triangle", () => {
    expect(triangleIncludesPoint(triangle, pointFrom(2, 2))).toBe(true);
    expect(triangleIncludesPoint(triangle, pointFrom(1, 8))).toBe(true);
    expect(triangleIncludesPoint(triangle, pointFrom(8, 1))).toBe(true);
  });

  it("should not include a point outside the triangle", () => {
    // beyond the hypotenuse
    expect(triangleIncludesPoint(triangle, pointFrom(8, 8))).toBe(false);
    // on the wrong side of each of the other two edges
    expect(triangleIncludesPoint(triangle, pointFrom(-1, 5))).toBe(false);
    expect(triangleIncludesPoint(triangle, pointFrom(5, -1))).toBe(false);
    // far away
    expect(triangleIncludesPoint(triangle, pointFrom(100, 100))).toBe(false);
    expect(triangleIncludesPoint(triangle, pointFrom(-100, -100))).toBe(false);
  });

  it("should give the same result regardless of the winding order", () => {
    const points = [
      pointFrom<GlobalPoint>(2, 2),
      pointFrom<GlobalPoint>(8, 8),
      pointFrom<GlobalPoint>(-1, 5),
      pointFrom<GlobalPoint>(5, -1),
    ];

    for (const point of points) {
      expect(triangleIncludesPoint(reversedTriangle, point)).toBe(
        triangleIncludesPoint(triangle, point),
      );
    }
  });

  it("should give the same result regardless of which vertex comes first", () => {
    const rotatedTriangle = [b, c, a] as Triangle<GlobalPoint>;

    expect(triangleIncludesPoint(rotatedTriangle, pointFrom(2, 2))).toBe(true);
    expect(triangleIncludesPoint(rotatedTriangle, pointFrom(8, 8))).toBe(false);
  });

  it("should work with negative coordinates and non-integer points", () => {
    const negativeTriangle = [
      pointFrom<GlobalPoint>(-10, -10),
      pointFrom<GlobalPoint>(-2, -10),
      pointFrom<GlobalPoint>(-10, -2),
    ] as Triangle<GlobalPoint>;

    expect(triangleIncludesPoint(negativeTriangle, pointFrom(-8.5, -8.5))).toBe(
      true,
    );
    expect(triangleIncludesPoint(negativeTriangle, pointFrom(-3, -3))).toBe(
      false,
    );
  });
});
