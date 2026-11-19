import { pointFrom } from "../src/point";
import {
  rectangle,
  rectangleFromNumberSequence,
  rectangleIntersectLineSegment,
  rectangleIntersectRectangle,
} from "../src/rectangle";
import { lineSegment } from "../src/segment";

import type { GlobalPoint } from "../src/types";

describe("rectangle", () => {
  it("should be built from the top left and bottom right points", () => {
    const topLeft = pointFrom<GlobalPoint>(1, 2);
    const bottomRight = pointFrom<GlobalPoint>(3, 4);

    expect(rectangle(topLeft, bottomRight)).toEqual([topLeft, bottomRight]);
  });

  it("should be built from a min/max number sequence", () => {
    expect(rectangleFromNumberSequence<GlobalPoint>(1, 2, 3, 4)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

/**
 * Compares points order-independently and with a tolerance, so that results
 * such as `-0` vs `0` or tiny floating point errors don't fail the test.
 */
const expectPointsCloseTo = (
  actual: readonly GlobalPoint[],
  expected: readonly [number, number][],
) => {
  const sort = (points: readonly (readonly [number, number])[]) =>
    [...points].sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);

  const sortedActual = sort(actual);
  const sortedExpected = sort(expected);

  expect(sortedActual).toHaveLength(sortedExpected.length);
  sortedExpected.forEach(([x, y], index) => {
    expect(sortedActual[index][0]).toBeCloseTo(x);
    expect(sortedActual[index][1]).toBeCloseTo(y);
  });
};

describe("rectangleIntersectLineSegment", () => {
  const rect = rectangleFromNumberSequence<GlobalPoint>(0, 0, 10, 10);

  it("should return two points when the segment crosses the rectangle", () => {
    const intersections = rectangleIntersectLineSegment(
      rect,
      lineSegment(pointFrom<GlobalPoint>(-5, 5), pointFrom<GlobalPoint>(15, 5)),
    );

    expect(intersections).toHaveLength(2);
    expectPointsCloseTo(intersections, [
      [0, 5],
      [10, 5],
    ]);
  });

  it("should return one point when the segment ends inside the rectangle", () => {
    const intersections = rectangleIntersectLineSegment(
      rect,
      lineSegment(pointFrom<GlobalPoint>(-5, 5), pointFrom<GlobalPoint>(5, 5)),
    );

    expect(intersections).toHaveLength(1);
    expectPointsCloseTo(intersections, [[0, 5]]);
  });

  it("should return no points when the segment misses the rectangle", () => {
    expect(
      rectangleIntersectLineSegment(
        rect,
        lineSegment(
          pointFrom<GlobalPoint>(-5, 20),
          pointFrom<GlobalPoint>(15, 20),
        ),
      ),
    ).toEqual([]);
  });

  it("should return no points when the segment is fully inside the rectangle", () => {
    expect(
      rectangleIntersectLineSegment(
        rect,
        lineSegment(pointFrom<GlobalPoint>(2, 2), pointFrom<GlobalPoint>(8, 8)),
      ),
    ).toEqual([]);
  });
});

describe("rectangleIntersectRectangle", () => {
  const rect = rectangleFromNumberSequence<GlobalPoint>(0, 0, 10, 10);

  it("should intersect when the rectangles partially overlap", () => {
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangleFromNumberSequence<GlobalPoint>(5, 5, 15, 15),
      ),
    ).toBe(true);
  });

  it("should intersect when one rectangle contains the other", () => {
    const inner = rectangleFromNumberSequence<GlobalPoint>(2, 2, 8, 8);

    expect(rectangleIntersectRectangle(rect, inner)).toBe(true);
    expect(rectangleIntersectRectangle(inner, rect)).toBe(true);
  });

  it("should not intersect when the rectangles are clearly apart", () => {
    // to the right
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangleFromNumberSequence<GlobalPoint>(20, 0, 30, 10),
      ),
    ).toBe(false);
    // below
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangleFromNumberSequence<GlobalPoint>(0, 20, 10, 30),
      ),
    ).toBe(false);
    // to the left and above
    expect(
      rectangleIntersectRectangle(
        rect,
        rectangleFromNumberSequence<GlobalPoint>(-30, -30, -20, -20),
      ),
    ).toBe(false);
  });
});
