import { getStroke } from "perfect-freehand";
import { LaserPointer } from "@excalidraw/laser-pointer";

import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import {
  FreehandOutline,
  OutlineSvgPath,
  getOutlinePoints,
  getSvgPathFromStroke,
} from "../src/freedrawOutline";
import { mutateElement } from "../src/mutateElement";
import { newFreeDrawElement } from "../src/newElement";
import { ShapeCache, getFreedrawOutlinePoints } from "../src/shape";

import type { FreehandOptions, OutlineParts } from "../src/freedrawOutline";
import type { ExcalidrawFreeDrawElement } from "../src/types";

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

/**
 * A pen-like stroke with the odd repeated point, sharp turn, tiny step
 * (slow pen) and jump (fast pen).
 */
const randomStroke = (random: () => number, length: number) => {
  const points: LocalPoint[] = [pointFrom<LocalPoint>(0, 0)];
  const pressures = [random()];
  let x = 0;
  let y = 0;
  let angle = random() * Math.PI * 2;

  while (points.length < length) {
    const event = random();
    if (event < 0.05) {
      points.push(points[points.length - 1]);
    } else {
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
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      points.push(pointFrom<LocalPoint>(x, y));
    }
    pressures.push(random());
  }

  return { points, pressures };
};

const flatten = ({ head, middle, footReversed }: OutlineParts) => [
  ...head,
  ...middle,
  ...[...footReversed].reverse(),
];

const STROKES = Array.from({ length: 24 }, (_, i) => {
  const random = createRandom(i + 1);
  return {
    ...randomStroke(random, 40 + Math.floor(random() * 200)),
    strokeWidth: [0.5, 1, 2, 4, 8][i % 5],
    streamline: [0.2, 0.5, 0, 0.9][i % 4],
    simulatePressure: i % 2 === 0,
  };
});

describe("FreehandOutline", () => {
  it.each(STROKES.map((stroke, i) => [i, stroke] as const))(
    "is perfect-freehand's outline as points are added (stroke %i)",
    (_, { points, pressures, strokeWidth, streamline, simulatePressure }) => {
      const options: FreehandOptions = {
        size: strokeWidth * 4.25,
        thinning: 0.6,
        smoothing: 0.5,
        streamline,
        simulatePressure,
        easing: (t) => Math.sin((t * Math.PI) / 2),
      };
      const outline = new FreehandOutline(options);
      const svgPath = new OutlineSvgPath();
      let incrementalCount = 0;

      for (let n = 1; n <= points.length; n++) {
        const inputs = points
          .slice(0, n)
          .map(([x, y], i) =>
            simulatePressure ? [x, y] : [x, y, pressures[i]],
          );
        outline.update(
          points.slice(0, n),
          simulatePressure ? null : pressures.slice(0, n),
        );
        const parts = outline.getParts();

        if (parts) {
          incrementalCount++;
          const expected = getStroke(inputs, { ...options, last: true });
          expect(getOutlinePoints(parts)).toEqual(expected);
          expect(svgPath.build(parts)).toBe(getSvgPathFromStroke(expected));
        }
      }

      expect(incrementalCount).toBeGreaterThan(0);
    },
  );

  it("is perfect-freehand's outline when all points are added at once", () => {
    for (const {
      points,
      pressures,
      strokeWidth,
      simulatePressure,
    } of STROKES) {
      const options: FreehandOptions = {
        size: strokeWidth * 4.25,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure,
        easing: (t) => t,
      };
      const outline = new FreehandOutline(options);
      outline.update(points, simulatePressure ? null : pressures);

      expect(getOutlinePoints(outline.getParts()!)).toEqual(
        getStroke(
          points.map(([x, y], i) =>
            simulatePressure ? [x, y] : [x, y, pressures[i]],
          ),
          { ...options, last: true },
        ),
      );
    }
  });
});

describe("OutlineSvgPath", () => {
  it("builds getSvgPathFromStroke's path as the outline grows", () => {
    const random = createRandom(42);
    const randomPoint = () =>
      [
        // numbers with many decimals, integers, -0, tiny (exponent) numbers
        (random() - 0.5) * 1000,
        [3, -0, 1e-7, -2.5e-9, 1234.5][Math.floor(random() * 5)],
      ].sort(() => random() - 0.5);
    const svgPath = new OutlineSvgPath();
    const head: number[][] = [];
    const footReversed: number[][] = [];

    for (let i = 0; i < 200; i++) {
      if (random() < 0.6) {
        head.push(randomPoint());
      }
      if (random() < 0.6) {
        footReversed.push(randomPoint());
      }
      const middle = Array.from({ length: Math.floor(random() * 4) }, () =>
        randomPoint(),
      );
      const parts = { head, middle, footReversed };

      expect(svgPath.build(parts)).toBe(getSvgPathFromStroke(flatten(parts)));
    }
  });
});

describe("freedraw outline of the element being drawn", () => {
  /** the outline, computed from scratch (from a new element object) */
  const getExpected = (element: ExcalidrawFreeDrawElement) => {
    const copy = { ...element };
    return {
      points: getFreedrawOutlinePoints(copy),
      path: ShapeCache.generateElementShape(copy, null).at(-1),
    };
  };

  it.each([
    ["variable", true],
    ["variable", false],
    ["constant", true],
    ["constant", false],
  ] as const)(
    "is the same as from scratch (%s width, simulated pressure: %s)",
    (variability, simulatePressure) => {
      for (const stroke of STROKES.slice(0, 4)) {
        const element = newFreeDrawElement({
          type: "freedraw",
          x: 0,
          y: 0,
          points: [stroke.points[0]],
          pressures: simulatePressure ? [] : [stroke.pressures[0]],
          simulatePressure,
          strokeWidth: stroke.strokeWidth,
          strokeOptions: { variability, streamline: stroke.streamline },
        });
        const drawn = [];

        // append points as the editor does
        for (let i = 1; i < stroke.points.length; i++) {
          mutateElement(element, new Map(), {
            points: [...element.points, stroke.points[i]],
            pressures: simulatePressure
              ? element.pressures
              : [...element.pressures, stroke.pressures[i]],
          });
          drawn.push({
            element: { ...element },
            points: getFreedrawOutlinePoints(element),
            path: ShapeCache.generateElementShape(element, null).at(-1),
          });
        }

        for (const { element, points, path } of drawn) {
          expect({ points, path }).toEqual(getExpected(element));
        }

        // changes that aren't appended points
        mutateElement(element, new Map(), { strokeWidth: 12 });
        expect(getFreedrawOutlinePoints(element)).toEqual(
          getExpected(element).points,
        );
        mutateElement(element, new Map(), {
          points: element.points.map(([x, y]) =>
            pointFrom<LocalPoint>(x * 2, y),
          ),
        });
        expect(getFreedrawOutlinePoints(element)).toEqual(
          getExpected(element).points,
        );
      }
    },
  );

  it("outlines each appended point once", () => {
    const addPoint = vi.spyOn(LaserPointer.prototype, "addPoint");
    const { points } = STROKES[0];
    const element = newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 0,
      simulatePressure: true,
      points: [points[0]],
      strokeOptions: { variability: "constant", streamline: 0.5 },
    });

    for (let i = 1; i < points.length; i++) {
      mutateElement(element, new Map(), {
        points: [...element.points, points[i]],
      });
      ShapeCache.generateElementShape(element, null);
    }

    expect(addPoint).toHaveBeenCalledTimes(points.length);
    addPoint.mockRestore();
  });
});
