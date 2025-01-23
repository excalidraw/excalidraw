import {
  arc,
  arcIncludesPoint,
  arcLineInterceptPoints,
  arcSegmentInterceptPoints,
} from "./arc";
import { line } from "./line";
import { pointFrom } from "./point";
import { lineSegment } from "./segment";
import type { GlobalPoint, Radians } from "./types";

describe("point on arc", () => {
  it("should detect point on simple arc", () => {
    expect(
      arcIncludesPoint(
        arc(
          pointFrom(0, 0),
          1,
          (-Math.PI / 4) as Radians,
          (Math.PI / 4) as Radians,
        ),
        pointFrom(0.92291667, 0.385),
      ),
    ).toBe(true);
  });
  it("should not detect point outside of a simple arc", () => {
    expect(
      arcIncludesPoint(
        arc(
          pointFrom(0, 0),
          1,
          (-Math.PI / 4) as Radians,
          (Math.PI / 4) as Radians,
        ),
        pointFrom(-0.92291667, 0.385),
      ),
    ).toBe(false);
  });
  it("should not detect point with good angle but incorrect radius", () => {
    expect(
      arcIncludesPoint(
        arc(
          pointFrom(0, 0),
          1,
          (-Math.PI / 4) as Radians,
          (Math.PI / 4) as Radians,
        ),
        pointFrom(-0.5, 0.5),
      ),
    ).toBe(false);
  });
});

describe("intersection", () => {
  it("should report correct interception point for segment", () => {
    expect(
      arcSegmentInterceptPoints(
        arc(
          pointFrom(0, 0),
          1,
          (-Math.PI / 4) as Radians,
          (Math.PI / 4) as Radians,
        ),
        lineSegment(pointFrom(2, 1), pointFrom(0, 0)),
      ),
    ).toEqual([pointFrom(0.894427190999916, 0.447213595499958)]);
  });

  it("should report both interception points when present for segment", () => {
    expect(
      arcSegmentInterceptPoints(
        arc(
          pointFrom(0, 0),
          1,
          (-Math.PI / 4) as Radians,
          (Math.PI / 4) as Radians,
        ),
        lineSegment(pointFrom(0.9, -2), pointFrom(0.9, 2)),
      ),
    ).toEqual([
      pointFrom(0.9, -0.4358898943540668),
      pointFrom(0.9, 0.4358898943540668),
    ]);
  });

  it("should report correct interception point for line", () => {
    expect(
      arcLineInterceptPoints(
        arc(
          pointFrom<GlobalPoint>(0, 0),
          1,
          (-Math.PI / 4) as Radians,
          (Math.PI / 4) as Radians,
        ),
        line(pointFrom(2, 1), pointFrom(0, 0)),
      ),
    ).toEqual([pointFrom(0.894427190999916, 0.447213595499958)]);
  });

  it("should report both interception points when present for line", () => {
    expect(
      arcLineInterceptPoints(
        arc(
          pointFrom<GlobalPoint>(0, 0),
          1,
          (-Math.PI / 4) as Radians,
          (Math.PI / 4) as Radians,
        ),
        line(pointFrom(0.9, -2), pointFrom(0.9, 2)),
      ),
    ).toEqual([
      pointFrom(0.9, 0.4358898943540668),
      pointFrom(0.9, -0.4358898943540668),
    ]);
  });
});
