import {
  centroid,
  elongation,
  kurtosis,
  orientPrincipalAxes,
  principalAxes,
  principalCoords,
  skewness,
  standardizedMoment,
} from "../src/pca";
import { pointFrom } from "../src/point";

import type { GlobalPoint } from "../src/types";

const rotate = (points: GlobalPoint[], angle: number, scale = 1) =>
  points.map(([x, y]) =>
    pointFrom<GlobalPoint>(
      (x * Math.cos(angle) - y * Math.sin(angle)) * scale + 17,
      (x * Math.sin(angle) + y * Math.cos(angle)) * scale - 4,
    ),
  );

const horizontalSpread: GlobalPoint[] = Array.from({ length: 21 }, (_, i) =>
  pointFrom<GlobalPoint>(i - 10, 0),
);

describe("centroid", () => {
  it("averages the points", () => {
    expect(
      centroid([
        pointFrom<GlobalPoint>(0, 0),
        pointFrom<GlobalPoint>(4, 0),
        pointFrom<GlobalPoint>(2, 6),
      ]),
    ).toEqual([2, 2]);
  });
});

describe("principalAxes", () => {
  it("finds the direction the points spread along", () => {
    const axes = principalAxes(horizontalSpread);

    expect(Math.abs(axes.major[0])).toBeCloseTo(1);
    expect(axes.major[1]).toBeCloseTo(0);
    expect(axes.majorVariance).toBeGreaterThan(axes.minorVariance);
  });

  it("tracks the points when they are rotated", () => {
    const axes = principalAxes(rotate(horizontalSpread, Math.PI / 6));

    // Up to the sign of the eigenvector, the major axis is the rotated x axis.
    expect(Math.abs(axes.major[0])).toBeCloseTo(Math.cos(Math.PI / 6));
    expect(Math.abs(axes.major[1])).toBeCloseTo(Math.sin(Math.PI / 6));
  });

  it("keeps the axes orthonormal", () => {
    const { major, minor } = principalAxes([
      ...rotate(horizontalSpread, 1.1),
      pointFrom<GlobalPoint>(3, 9),
    ]);

    expect(Math.hypot(...major)).toBeCloseTo(1);
    expect(Math.hypot(...minor)).toBeCloseTo(1);
    expect(major[0] * minor[0] + major[1] * minor[1]).toBeCloseTo(0);
  });

  it("falls back to the coordinate axes for an already diagonal covariance", () => {
    const axes = principalAxes([
      pointFrom<GlobalPoint>(-1, 0),
      pointFrom<GlobalPoint>(1, 0),
      pointFrom<GlobalPoint>(0, -5),
      pointFrom<GlobalPoint>(0, 5),
    ]);

    expect(axes.major).toEqual([0, 1]);
  });
});

describe("principalCoords", () => {
  it("undoes translation, rotation and scale", () => {
    const points = rotate(horizontalSpread, 0.7, 3);
    const axes = principalAxes(points);
    const coords = principalCoords(
      points,
      axes,
      1 / Math.sqrt(axes.majorVariance),
    );

    // The canonical form of a horizontal spread is the same spread, whatever
    // was done to it in between.
    const us = coords.map(([u]) => u).sort((a, b) => a - b);
    expect(coords.every(([, v]) => Math.abs(v) < 1e-9)).toBe(true);
    expect(Math.abs(us[0])).toBeCloseTo(Math.abs(us[us.length - 1]));
    expect(Math.abs(us[0])).toBeCloseTo(1.65, 1);
  });
});

describe("orientPrincipalAxes", () => {
  it("points the major axis at the dense end", () => {
    // Sparse to the left of the origin, piled up to the right of it.
    const lopsided: GlobalPoint[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        pointFrom<GlobalPoint>(-100 + i * 10, 0),
      ),
      ...Array.from({ length: 30 }, (_, i) => pointFrom<GlobalPoint>(i, 0)),
    ];

    for (const angle of [0, 1, 2.5, 4]) {
      const points = rotate(lopsided, angle);
      const axes = orientPrincipalAxes(points, principalAxes(points));
      const us = principalCoords(points, axes).map(([u]) => u);

      // The dense end is at +u, i.e. the projection is skewed negative.
      expect(skewness(us)).toBeLessThan(0);
    }
  });

  it("leaves a symmetric point set alone", () => {
    const axes = principalAxes(horizontalSpread);

    expect(orientPrincipalAxes(horizontalSpread, axes)).toEqual(axes);
  });
});

describe("elongation", () => {
  it("is 0 for a straight spread and 1 for an isotropic one", () => {
    expect(elongation(principalAxes(horizontalSpread))).toBeCloseTo(0);
    expect(
      elongation(
        principalAxes(
          Array.from({ length: 36 }, (_, i) =>
            pointFrom<GlobalPoint>(
              Math.cos((i * Math.PI) / 18),
              Math.sin((i * Math.PI) / 18),
            ),
          ),
        ),
      ),
    ).toBeCloseTo(1);
  });

  it("is invariant to rotation and scale", () => {
    const points = Array.from({ length: 40 }, (_, i) =>
      pointFrom<GlobalPoint>(Math.cos(i / 6) * 4, Math.sin(i / 6)),
    );

    expect(elongation(principalAxes(rotate(points, 0.9, 7)))).toBeCloseTo(
      elongation(principalAxes(points)),
    );
  });
});

describe("standardizedMoment", () => {
  it("is 0 for a sample with no spread", () => {
    expect(standardizedMoment([3, 3, 3], 3)).toBe(0);
  });

  it("is unchanged by shifting and scaling the sample", () => {
    const sample = [1, 2, 2, 3, 9, 4];

    expect(
      standardizedMoment(
        sample.map((v) => v * 5 + 100),
        3,
      ),
    ).toBeCloseTo(standardizedMoment(sample, 3));
  });
});

describe("skewness", () => {
  it("is 0 for a symmetric sample", () => {
    expect(skewness([-2, -1, 0, 1, 2])).toBeCloseTo(0);
  });

  it("is positive when the tail runs to the right of the mass", () => {
    expect(skewness([1, 1, 1, 1, 1, 9])).toBeGreaterThan(0);
    expect(skewness([-9, -1, -1, -1, -1, -1])).toBeLessThan(0);
  });
});

describe("kurtosis", () => {
  it("separates a uniform sample from a normal-ish one", () => {
    const uniform = Array.from({ length: 101 }, (_, i) => i / 100);

    // 1.8 for a uniform sample, 3 for a normal one.
    expect(kurtosis(uniform)).toBeCloseTo(1.8, 1);
  });

  it("is invariant to rotation, via the principal frame", () => {
    const points = Array.from({ length: 50 }, (_, i) =>
      pointFrom<GlobalPoint>(i - 25, ((i % 5) - 2) * 0.3),
    );
    const project = (pts: GlobalPoint[]) => {
      const axes = principalAxes(pts);
      return kurtosis(principalCoords(pts, axes).map(([u]) => u));
    };

    expect(project(rotate(points, 1.3, 2))).toBeCloseTo(project(points));
  });
});
