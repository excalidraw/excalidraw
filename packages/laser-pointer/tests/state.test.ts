import { LaserPointer } from "../src";

import type { LaserPointerOptions, Point, StrokeOutlineParts } from "../src";

const createRandom = (seed: number) => {
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  // skip the first values, which are tiny for small seeds
  for (let i = 0; i < 10; i++) {
    random();
  }
  return random;
};

/** a stroke with the odd repeated point, sharp turn, tiny step and jump */
const randomStroke = (random: () => number, length: number) => {
  const points: Point[] = [[0, 0, random()]];
  let angle = random() * Math.PI * 2;

  while (points.length < length) {
    const [x, y] = points[points.length - 1];
    const event = random();
    if (event < 0.05) {
      points.push([x, y, random()]);
      continue;
    }
    angle +=
      event < 0.12
        ? (Math.PI / 2 + random() * Math.PI) * (random() < 0.5 ? -1 : 1)
        : (random() - 0.5) * 0.6;
    const step =
      event < 0.25
        ? random() * 0.3
        : event < 0.28
        ? 15 + random() * 40
        : 0.5 + random() * 5;
    points.push([
      x + Math.cos(angle) * step,
      y + Math.sin(angle) * step,
      random(),
    ]);
  }

  return points;
};

const flatten = ({ head, middle, footReversed }: StrokeOutlineParts) => [
  ...head,
  ...middle,
  ...[...footReversed].reverse(),
];

describe("LaserPointer.getStrokeOutlineParts", () => {
  it.each<[string, Partial<LaserPointerOptions>, number | undefined]>([
    [
      "freedraw",
      { size: 2.8, simplify: 0, sizeMapping: (c) => Math.max(0.1, c.pressure) },
      undefined,
    ],
    [
      "slow streamline, size override",
      { streamline: 0.8, simplify: 0, sizeMapping: (c) => c.pressure + 0.1 },
      5,
    ],
    [
      "size along the stroke, kept head",
      {
        size: 4,
        streamline: 0,
        simplify: 0,
        keepHead: true,
        sizeMapping: (c) => 1 / (1 + c.runningLength / 50),
      },
      undefined,
    ],
  ])("is the outline as points are added (%s)", (_, options, sizeOverride) => {
    for (let seed = 1; seed <= 8; seed++) {
      const random = createRandom(seed);
      const points = randomStroke(random, 20 + Math.floor(random() * 160));
      const laserPointer = new LaserPointer(options);
      let partsCount = 0;

      for (let n = 1; n <= points.length; n++) {
        laserPointer.addPoint(points[n - 1]);
        const parts = laserPointer.getStrokeOutlineParts(sizeOverride);

        const reference = new LaserPointer(options);
        points.slice(0, n).forEach((point) => reference.addPoint(point));
        const outline = reference.getStrokeOutline(sizeOverride);

        if (parts) {
          partsCount++;
          expect(flatten(parts)).toEqual(outline);
        }
        expect(laserPointer.getStrokeOutline(sizeOverride)).toEqual(outline);
      }

      expect(partsCount).toBeGreaterThan(0);
    }
  });

  it("isn't available for simplified or too short strokes", () => {
    const simplified = new LaserPointer({ simplify: 0.1 });
    const short = new LaserPointer({ simplify: 0 });
    for (const point of randomStroke(createRandom(1), 20)) {
      simplified.addPoint(point);
    }
    short.addPoint([0, 0, 1]);
    short.addPoint([10, 0, 1]);

    expect(simplified.getStrokeOutlineParts()).toBe(null);
    expect(short.getStrokeOutlineParts()).toBe(null);
  });
});
