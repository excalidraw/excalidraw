import type { GlobalPoint } from "@excalidraw/math";

import { recognizeShape } from "../src/convertToShape";

// Deterministic jitter, so a run that passes keeps passing.
let seed = 1;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648 - 0.5;
};

// Draw the shape somewhere else, at another size, turned by `angle`, with a
// wobbly hand.
const sketch = (
  points: readonly [number, number][],
  { angle = 0, scale = 1, noise = 0 } = {},
): GlobalPoint[] =>
  points.map(([x, y]) => {
    const nx = x * scale + random() * noise;
    const ny = y * scale + random() * noise;
    return [
      nx * Math.cos(angle) - ny * Math.sin(angle) + 600,
      nx * Math.sin(angle) + ny * Math.cos(angle) + 600,
    ] as GlobalPoint;
  });

const edge = (
  from: readonly [number, number],
  to: readonly [number, number],
  steps: number,
): [number, number][] =>
  Array.from({ length: steps }, (_, i) => [
    from[0] + ((to[0] - from[0]) * i) / steps,
    from[1] + ((to[1] - from[1]) * i) / steps,
  ]);

const outline = (corners: readonly [number, number][]): [number, number][] => [
  ...corners.flatMap((corner, i) => edge(corner, corners[(i + 1) % 4], 18)),
  corners[0],
];

const rectangle = (w: number, h: number) =>
  outline([
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ]);

const diamond = (w: number, h: number) =>
  outline([
    [0, -h / 2],
    [w / 2, 0],
    [0, h / 2],
    [-w / 2, 0],
  ]);

const ellipse = (rx: number, ry: number): [number, number][] => {
  const points: [number, number][] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.1) {
    points.push([Math.cos(a) * rx, Math.sin(a) * ry]);
  }
  return points;
};

// Moving-average smoothing: rounds every corner the way a relaxed pen does.
const smooth = (
  pts: readonly [number, number][],
  window: number,
): [number, number][] =>
  pts.map((_, i) => {
    let sx = 0;
    let sy = 0;
    for (let k = -window; k <= window; k++) {
      const [x, y] = pts[(i + k + pts.length) % pts.length];
      sx += x;
      sy += y;
    }
    return [sx / (2 * window + 1), sy / (2 * window + 1)];
  });

// A sloppy hand-drawn "rectangle" that tapers, bucket-like: wider at the top
// than the bottom. Its hull fill ratio, (topW + bottomW) / (2 * topW), lands
// right at an ellipse's PI/4 — only its sharp corners tell the two apart.
const taperedRectangle = (
  topW: number,
  bottomW: number,
  h: number,
): [number, number][] =>
  outline([
    [-topW / 2, -h / 2],
    [topW / 2, -h / 2],
    [bottomW / 2, h / 2],
    [-bottomW / 2, h / 2],
  ]);

// A rectangle drawn with broad, pen-like rounded corners. Its outline is a
// superellipse midway between an ellipse (exponent 2) and a sharp rectangle.
const roundedRectangle = (rx: number, ry: number): [number, number][] => {
  const points: [number, number][] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.1) {
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    points.push([
      Math.sign(cos) * Math.sqrt(Math.abs(cos)) * rx,
      Math.sign(sin) * Math.sqrt(Math.abs(sin)) * ry,
    ]);
  }
  return points;
};

const line = (length: number) => edge([-length / 2, 0], [length / 2, 0], 40);

/** A shaft, then a V head traced back from the tip and over itself. */
const arrow = (length: number, headRatio: number): [number, number][] => {
  const tip: [number, number] = [length / 2, 0];
  const headLength = length * headRatio;
  const arm = (side: number): [number, number] => [
    tip[0] - headLength * Math.cos(Math.PI / 6),
    tip[1] - side * headLength * Math.sin(Math.PI / 6),
  ];
  return [
    ...edge([-length / 2, 0], tip, 24),
    ...edge(tip, arm(1), 8),
    ...edge(arm(1), tip, 8),
    ...edge(tip, arm(-1), 8),
  ];
};

const SCALES = [0.5, 1, 2, 4];

describe("recognizeShape", () => {
  describe("is invariant to where, how big and how rotated a shape is drawn", () => {
    // A rectangle turned 45° *is* a diamond, so these two are only swept over
    // the right angles that map them onto themselves. Every other class is
    // swept over arbitrary angles.
    const RIGHT_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    // 4.7 rad is within a degree of vertical — the size gate compares the
    // larger bounding-box dimension, so thin (near-)axis-aligned strokes are
    // recognized like any other.
    const ANY_ANGLES = [0, 0.3, Math.PI / 4, 1.2, Math.PI / 2, 2.5, 4.7];

    const cases: [string, [number, number][], number[], string][] = [
      ["a square", rectangle(200, 200), RIGHT_ANGLES, "rectangle"],
      ["a wide rectangle", rectangle(300, 150), RIGHT_ANGLES, "rectangle"],
      ["a thin rectangle", rectangle(500, 100), RIGHT_ANGLES, "rectangle"],
      [
        "a tapered rectangle",
        taperedRectangle(170, 100, 200),
        RIGHT_ANGLES,
        "rectangle",
      ],
      ["a diamond", diamond(200, 200), RIGHT_ANGLES, "diamond"],
      ["a wide diamond", diamond(300, 150), RIGHT_ANGLES, "diamond"],
      ["a circle", ellipse(100, 100), ANY_ANGLES, "ellipse"],
      ["an ellipse", ellipse(150, 75), ANY_ANGLES, "ellipse"],
      ["a line", line(300), ANY_ANGLES, "line"],
      ["an arrow with a small head", arrow(300, 0.15), ANY_ANGLES, "arrow"],
      ["an arrow with a large head", arrow(300, 0.45), ANY_ANGLES, "arrow"],
    ];

    it.each(cases)("recognizes %s", (_name, points, angles, expected) => {
      for (const angle of angles) {
        for (const scale of SCALES) {
          for (const noise of [0, 3]) {
            expect({
              angle,
              scale,
              noise,
              type: recognizeShape(
                sketch(points, { angle, scale, noise }),
                null,
              ).type,
            }).toEqual({ angle, scale, noise, type: expected });
          }
        }
      }
    });
  });

  it("tells an arrow from a line by the points its head piles up", () => {
    const options = { angle: 0.3 };
    expect(recognizeShape(sketch(line(300), options), null).type).toBe("line");
    expect(recognizeShape(sketch(arrow(300, 0.3), options), null).type).toBe(
      "arrow",
    );
  });

  it("recognizes an outline the user didn't quite close", () => {
    const gapped = rectangle(200, 200).slice(0, -6);

    expect(recognizeShape(sketch(gapped), null).type).toBe("rectangle");
  });

  it("recognizes a pen-drawn outline with rounded corners as a rectangle", () => {
    expect(recognizeShape(sketch(roundedRectangle(100, 70)), null).type).toBe(
      "rectangle",
    );

    // ...while a true ellipse of the same proportions remains an ellipse
    expect(recognizeShape(sketch(ellipse(100, 70)), null).type).toBe("ellipse");
  });

  it("tells a tapered, bucket-like rectangle from an ellipse by its corners", () => {
    // proportions traced from real sketches that used to recognize as
    // ellipses: hull fill ≈ 0.8 ≈ PI/4, so corner sharpness must decide
    const buckets: [number, number, number][] = [
      [110, 65, 220],
      [110, 65, 130],
      [75, 50, 115],
      [120, 60, 250],
    ];

    for (const [topW, bottomW, h] of buckets) {
      // lightly rounded corners + wobble, like the real strokes
      const points = sketch(smooth(taperedRectangle(topW, bottomW, h), 2), {
        noise: 2,
      });

      expect({
        bucket: [topW, bottomW, h],
        type: recognizeShape(points, null).type,
      }).toEqual({ bucket: [topW, bottomW, h], type: "rectangle" });
    }
  });

  it("does not read sharply bent open strokes as lines or arrows", () => {
    const semicircle: [number, number][] = Array.from(
      { length: 40 },
      (_, i) => {
        const a = (Math.PI * i) / 39;
        return [Math.cos(a) * 150, Math.sin(a) * 150];
      },
    );
    const sawtooth: [number, number][] = Array.from({ length: 31 }, (_, i) => [
      i * 10,
      (i % 2) * 60,
    ]);

    const bent: [string, [number, number][]][] = [
      [
        "a right-angle elbow",
        [...edge([0, 0], [110, 110], 20), ...edge([110, 110], [220, 0], 20)],
      ],
      [
        "an L shape",
        [...edge([0, 0], [0, 150], 20), ...edge([0, 150], [150, 150], 20)],
      ],
      [
        "a checkmark",
        [...edge([0, 60], [60, 120], 12), ...edge([60, 120], [200, 0], 24)],
      ],
      ["a semicircular arc", semicircle],
      ["a sawtooth", sawtooth],
    ];

    for (const [name, points] of bent) {
      expect({
        name,
        type: recognizeShape(sketch(points, { noise: 2 }), null).type,
      }).toEqual({ name, type: "freedraw" });
    }
  });

  it("still reads a lazily bowed or squiggly stroke as a line", () => {
    const bowed: [number, number][] = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39;
      return [t * 300, Math.sin(t * Math.PI) * 24];
    });
    const squiggly: [number, number][] = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39;
      return [t * 300, Math.sin(t * Math.PI * 4) * 12];
    });

    expect(recognizeShape(sketch(bowed, { noise: 2 }), null).type).toBe("line");
    expect(recognizeShape(sketch(squiggly, { noise: 2 }), null).type).toBe(
      "line",
    );
  });

  it("leaves a stroke that resembles no known shape as freedraw", () => {
    const squiggle: [number, number][] = Array.from({ length: 60 }, (_, i) => [
      i * 4 - 120,
      Math.sin(i / 2) * 70 + random() * 20,
    ]);

    expect(recognizeShape(sketch(squiggle), null).type).toBe("freedraw");
  });

  it("only extends an arrow with another arrow", () => {
    const previous = { type: "arrow" } as Parameters<typeof recognizeShape>[1];

    expect(
      recognizeShape(sketch(arrow(300, 0.3), { angle: 0.3 }), previous).type,
    ).toBe("arrow");
    expect(recognizeShape(sketch(rectangle(200, 200)), previous).type).toBe(
      "freedraw",
    );
  });

  it("ignores a stroke too small to be a shape", () => {
    const tiny: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 0],
      [1, -1],
    ];

    expect(recognizeShape(sketch(tiny), null).type).toBe("freedraw");
  });

  it("gates on apparent (screen) size, so zoom decides what is too small", () => {
    const smallCircle = ellipse(8, 8); // 16 scene units across

    expect(recognizeShape(sketch(smallCircle), null).type).toBe("freedraw");
    expect(recognizeShape(sketch(smallCircle), null, 10).type).toBe("ellipse");

    // 300 apparent px at 0.1 zoom
    expect(
      recognizeShape(sketch(line(3000), { angle: 0.3 }), null, 0.1).type,
    ).toBe("line");
    // 10 apparent px at 0.1 zoom
    expect(
      recognizeShape(sketch(line(100), { angle: 0.3 }), null, 0.1).type,
    ).toBe("freedraw");
  });
});
