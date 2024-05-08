import {
  lineIntersectsLine,
  lineRotate,
  pointInEllipse,
  pointInPolygon,
  pointLeftofLine,
  pointOnCurve,
  pointOnEllipse,
  pointOnLine,
  pointOnPolygon,
  pointOnPolyline,
  pointRightofLine,
  pointRotate,
} from "./geometry";
import type { Curve, Ellipse, Line, Point, Polygon, Polyline } from "./shape";

describe("point and line", () => {
  const line: Line = [
    [1, 0],
    [1, 2],
  ];

  it("point on left or right of line", () => {
    expect(pointLeftofLine([0, 1], line)).toBe(true);
    expect(pointLeftofLine([1, 1], line)).toBe(false);
    expect(pointLeftofLine([2, 1], line)).toBe(false);

    expect(pointRightofLine([0, 1], line)).toBe(false);
    expect(pointRightofLine([1, 1], line)).toBe(false);
    expect(pointRightofLine([2, 1], line)).toBe(true);
  });

  it("point on the line", () => {
    expect(pointOnLine([0, 1], line)).toBe(false);
    expect(pointOnLine([1, 1], line, 0)).toBe(true);
    expect(pointOnLine([2, 1], line)).toBe(false);
  });
});

describe("point and polylines", () => {
  const polyline: Polyline = [
    [
      [1, 0],
      [1, 2],
    ],
    [
      [1, 2],
      [2, 2],
    ],
    [
      [2, 2],
      [2, 1],
    ],
    [
      [2, 1],
      [3, 1],
    ],
  ];

  it("point on the line", () => {
    expect(pointOnPolyline([1, 0], polyline)).toBe(true);
    expect(pointOnPolyline([1, 2], polyline)).toBe(true);
    expect(pointOnPolyline([2, 2], polyline)).toBe(true);
    expect(pointOnPolyline([2, 1], polyline)).toBe(true);
    expect(pointOnPolyline([3, 1], polyline)).toBe(true);

    expect(pointOnPolyline([1, 1], polyline)).toBe(true);
    expect(pointOnPolyline([2, 1.5], polyline)).toBe(true);
    expect(pointOnPolyline([2.5, 1], polyline)).toBe(true);

    expect(pointOnPolyline([0, 1], polyline)).toBe(false);
    expect(pointOnPolyline([2.1, 1.5], polyline)).toBe(false);
  });

  it("point on the line with rotation", () => {
    const truePoints = [
      [1, 0],
      [1, 2],
      [2, 2],
      [2, 1],
      [3, 1],
    ] as Point[];

    truePoints.forEach((point) => {
      const rotation = Math.random() * 360;
      const rotatedPoint = pointRotate(point, rotation);
      const rotatedPolyline: Polyline = polyline.map((line) =>
        lineRotate(line, rotation, [0, 0]),
      );
      expect(pointOnPolyline(rotatedPoint, rotatedPolyline)).toBe(true);
    });

    const falsePoints = [
      [0, 1],
      [2.1, 1.5],
    ] as Point[];

    falsePoints.forEach((point) => {
      const rotation = Math.random() * 360;
      const rotatedPoint = pointRotate(point, rotation);
      const rotatedPolyline: Polyline = polyline.map((line) =>
        lineRotate(line, rotation, [0, 0]),
      );
      expect(pointOnPolyline(rotatedPoint, rotatedPolyline)).toBe(false);
    });
  });
});

describe("point and polygon", () => {
  const polygon: Polygon = [
    [10, 10],
    [50, 10],
    [50, 50],
    [10, 50],
  ];

  it("point on polygon", () => {
    expect(pointOnPolygon([30, 10], polygon)).toBe(true);
    expect(pointOnPolygon([50, 30], polygon)).toBe(true);
    expect(pointOnPolygon([30, 50], polygon)).toBe(true);
    expect(pointOnPolygon([10, 30], polygon)).toBe(true);
    expect(pointOnPolygon([30, 30], polygon)).toBe(false);
    expect(pointOnPolygon([30, 70], polygon)).toBe(false);
  });

  it("point in polygon", () => {
    const polygon: Polygon = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(pointInPolygon([1, 1], polygon)).toBe(true);
    expect(pointInPolygon([3, 3], polygon)).toBe(false);
  });
});

describe("point and curve", () => {
  const curve: Curve = [
    [1.4, 1.65],
    [1.9, 7.9],
    [5.9, 1.65],
    [6.44, 4.84],
  ];

  it("point on curve", () => {
    expect(pointOnCurve(curve[0], curve)).toBe(true);
    expect(pointOnCurve(curve[3], curve)).toBe(true);

    expect(pointOnCurve([2, 4], curve, 0.1)).toBe(true);
    expect(pointOnCurve([4, 4.4], curve, 0.1)).toBe(true);
    expect(pointOnCurve([5.6, 3.85], curve, 0.1)).toBe(true);

    expect(pointOnCurve([5.6, 4], curve, 0.1)).toBe(false);
    expect(pointOnCurve(curve[1], curve, 0.1)).toBe(false);
    expect(pointOnCurve(curve[2], curve, 0.1)).toBe(false);
  });
});

describe("point and ellipse", () => {
  const ellipse: Ellipse = {
    center: [0, 0],
    angle: 0,
    halfWidth: 2,
    halfHeight: 1,
  };

  it("point on ellipse", () => {
    [
      [0, 1],
      [0, -1],
      [2, 0],
      [-2, 0],
    ].forEach((point) => {
      expect(pointOnEllipse(point as Point, ellipse)).toBe(true);
    });
    expect(pointOnEllipse([-1.4, 0.7], ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse([-1.4, 0.71], ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse([1.4, 0.7], ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse([1.4, 0.71], ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse([1, -0.86], ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse([1, -0.86], ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse([-1, -0.86], ellipse, 0.1)).toBe(true);
    expect(pointOnEllipse([-1, -0.86], ellipse, 0.01)).toBe(true);

    expect(pointOnEllipse([-1, 0.8], ellipse)).toBe(false);
    expect(pointOnEllipse([1, -0.8], ellipse)).toBe(false);
  });

  it("point in ellipse", () => {
    [
      [0, 1],
      [0, -1],
      [2, 0],
      [-2, 0],
    ].forEach((point) => {
      expect(pointInEllipse(point as Point, ellipse)).toBe(true);
    });

    expect(pointInEllipse([-1, 0.8], ellipse)).toBe(true);
    expect(pointInEllipse([1, -0.8], ellipse)).toBe(true);

    expect(pointInEllipse([-1, 1], ellipse)).toBe(false);
    expect(pointInEllipse([-1.4, 0.8], ellipse)).toBe(false);
  });
});

describe("line and line", () => {
  const lineA: Line = [
    [1, 4],
    [3, 4],
  ];
  const lineB: Line = [
    [2, 1],
    [2, 7],
  ];
  const lineC: Line = [
    [1, 8],
    [3, 8],
  ];
  const lineD: Line = [
    [1, 8],
    [3, 8],
  ];
  const lineE: Line = [
    [1, 9],
    [3, 9],
  ];
  const lineF: Line = [
    [1, 2],
    [3, 4],
  ];
  const lineG: Line = [
    [0, 1],
    [2, 3],
  ];

  it("intersection", () => {
    expect(lineIntersectsLine(lineA, lineB)).toBe(true);
    expect(lineIntersectsLine(lineA, lineC)).toBe(false);
    expect(lineIntersectsLine(lineB, lineC)).toBe(false);
    expect(lineIntersectsLine(lineC, lineD)).toBe(true);
    expect(lineIntersectsLine(lineE, lineD)).toBe(false);
    expect(lineIntersectsLine(lineF, lineG)).toBe(true);
  });
});
