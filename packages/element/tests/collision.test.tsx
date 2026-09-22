import { arrayToMap, getSizeFromPoints, reseed } from "@excalidraw/common";
import {
  type GlobalPoint,
  type LocalPoint,
  pointFrom,
  pointRotateRads,
} from "@excalidraw/math";
import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import "@excalidraw/utils/test-utils";
import { render } from "@excalidraw/excalidraw/tests/test-utils";

import * as distance from "../src/distance";
import { getElementBounds } from "../src/bounds";
import { hitElementItself, isPointInElement } from "../src/collision";
import { mutateElement } from "../src/mutateElement";
import { newFreeDrawElement } from "../src/newElement";

describe("check rotated elements can be hit:", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("arrow", () => {
    UI.createElement("arrow", {
      x: 0,
      y: 0,
      width: 124,
      height: 302,
      angle: 1.8700426423973724,
      points: [
        [0, 0],
        [120, -198],
        [-4, -302],
      ] as LocalPoint[],
    });
    const hit = hitElementItself({
      point: pointFrom<GlobalPoint>(88, -68),
      element: window.h.elements[0],
      threshold: 10,
      elementsMap: window.h.scene.getNonDeletedElementsMap(),
    });
    expect(hit).toBe(true);
  });
});

describe("hitElementItself cache", () => {
  beforeEach(async () => {
    // reset cache
    hitElementItself({
      point: pointFrom<GlobalPoint>(50, 50),
      element: API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        backgroundColor: "#ffffff",
      }),
      threshold: Infinity,
      elementsMap: new Map([]),
    });

    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("reuses cached result when threshold increases", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(100.5, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 1,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    distanceSpy.mockRestore();
  });

  it("does not reuse cache when threshold decreases", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(105, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    expect(
      hitElementItself({
        point,
        element,
        threshold: 6,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(2);
    distanceSpy.mockRestore();
  });

  it("invalidates cache when element version changes", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ffffff",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(100.5, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 1,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    const movedElement = {
      ...element,
      version: element.version + 1,
      versionNonce: element.versionNonce + 1,
    };

    expect(
      hitElementItself({
        point,
        element: movedElement,
        threshold: 1,
        elementsMap,
      }),
    ).toBe(true);

    expect(distanceSpy).toHaveBeenCalledTimes(2);
    distanceSpy.mockRestore();
  });

  it("override does not affect caching", () => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(50, 50);

    const distanceSpy = jest.spyOn(distance, "distanceToElement");

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
      }),
    ).toBe(false);

    expect(distanceSpy).toHaveBeenCalledTimes(1);

    expect(
      hitElementItself({
        point,
        element,
        threshold: 10,
        elementsMap,
        overrideShouldTestInside: true,
      }),
    ).toBe(true);
  });
});

describe("freedraw collision matches the rendered stroke width", () => {
  // A straight, horizontal stroke centered on y === 0.
  const points = Array.from({ length: 21 }, (_, i) =>
    pointFrom<LocalPoint>(i * 5, 0),
  );

  const createFreeDraw = (variability: "variable" | "constant") =>
    API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      strokeWidth: 10,
      points,
      strokeOptions: { variability, streamline: 0.5 },
    });

  const distanceAt = (
    element: ReturnType<typeof createFreeDraw>,
    x: number,
    y: number,
  ) =>
    distance.distanceToElement(
      element,
      arrayToMap([element]),
      pointFrom<GlobalPoint>(x, y),
    );

  it("treats a point on the centerline as a direct hit for both modes", () => {
    expect(distanceAt(createFreeDraw("variable"), 50, 0)).toBe(0);
    expect(distanceAt(createFreeDraw("constant"), 50, 0)).toBe(0);
  });

  it("hits across the body of a thick stroke, not just near the centerline", () => {
    expect(distanceAt(createFreeDraw("variable"), 50, 20)).toBe(0);
  });

  it("uses a wider hit area for variable-width than for constant-width strokes", () => {
    const offset = 20;
    const variableDistance = distanceAt(createFreeDraw("variable"), 50, offset);
    const constantDistance = distanceAt(createFreeDraw("constant"), 50, offset);

    expect(variableDistance).toBe(0);
    expect(constantDistance).toBeGreaterThan(0);
    expect(variableDistance).toBeLessThan(constantDistance);
  });

  it("does not hit points clearly outside even the widest stroke", () => {
    expect(distanceAt(createFreeDraw("variable"), 50, 45)).toBeGreaterThan(0);
  });

  it("hits thick ink outside the centerline bounds", () => {
    const hitAt = (
      element: ReturnType<typeof createFreeDraw>,
      x: number,
      y: number,
    ) =>
      hitElementItself({
        element,
        elementsMap: arrayToMap([element]),
        point: pointFrom<GlobalPoint>(x, y),
        threshold: 1,
      });

    // The centerline bounds have zero height, far below the ink's reach.
    expect(hitAt(createFreeDraw("variable"), 50, 20)).toBe(true);
    expect(hitAt(createFreeDraw("variable"), 50, -20)).toBe(true);
    expect(hitAt(createFreeDraw("constant"), 50, 10)).toBe(true);
    expect(hitAt(createFreeDraw("constant"), 50, 20)).toBe(false);
    expect(hitAt(createFreeDraw("variable"), 50, 45)).toBe(false);
  });

  it("hits the start cap of a short stroke reaching past its stroke size", () => {
    // Under 3px long, perfect-freehand draws the start cap around the first
    // point from the last point's outline, reaching past the stroke size.
    const element = newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 0,
      strokeWidth: 1,
      simulatePressure: false,
      pressures: [1, 1, 1],
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(0.01, 0),
        pointFrom<LocalPoint>(2.9, 0),
      ],
      strokeOptions: { variability: "variable", streamline: 0.5 },
    });
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(0.1, 4.9);

    expect(distance.distanceToElement(element, elementsMap, point)).toBe(0);
    // The hit threshold at 30x zoom.
    expect(
      hitElementItself({ element, elementsMap, point, threshold: 0.6 }),
    ).toBe(true);
  });
});

const createLoop = ({
  angle = 0,
  backgroundColor = "#ffc9c9",
  variability = "variable",
  points = Array.from({ length: 81 }, (_, i) =>
    pointFrom<LocalPoint>(
      80 + 80 * Math.cos((i / 80) * 2 * Math.PI),
      40 + 40 * Math.sin((i / 80) * 2 * Math.PI),
    ),
  ),
}: {
  angle?: number;
  backgroundColor?: string;
  variability?: "variable" | "constant";
  points?: LocalPoint[];
} = {}) =>
  API.createElement({
    type: "freedraw",
    x: 300,
    y: 200,
    ...getSizeFromPoints(points),
    angle,
    strokeWidth: 2,
    backgroundColor,
    fillStyle: "solid",
    points,
    strokeOptions: { variability, streamline: 0.5 },
  });

// The fill contour does not depend on the stroke; only its interplay with the
// stroke geometry is tested per stroke variability.
describe.each(["variable", "constant"] as const)(
  "%s freedraw loop containment",
  (variability) => {
    it.each([0, Math.PI / 4])(
      "hits the fill independently of the stroke at angle %s",
      (angle) => {
        const element = createLoop({ angle, variability });
        const elementsMap = arrayToMap([element]);
        const point = pointRotateRads(
          pointFrom<GlobalPoint>(400, 250),
          pointFrom<GlobalPoint>(380, 240),
          element.angle,
        );

        // Checking the fill must not replace the cached stroke geometry.
        expect(
          distance.distanceToElement(element, elementsMap, point),
        ).toBeGreaterThan(10);
        expect(isPointInElement(point, element, elementsMap)).toBe(true);
        expect(
          hitElementItself({ element, elementsMap, point, threshold: 1 }),
        ).toBe(true);
        expect(
          distance.distanceToElement(element, elementsMap, point),
        ).toBeGreaterThan(10);
      },
    );

    it.each([0, Math.PI / 4])(
      "does not hit the interior of a transparent loop at angle %s",
      (angle) => {
        const element = createLoop({
          angle,
          backgroundColor: "transparent",
          variability,
        });
        const elementsMap = arrayToMap([element]);
        const point = pointRotateRads(
          pointFrom<GlobalPoint>(400, 250),
          pointFrom<GlobalPoint>(380, 240),
          element.angle,
        );

        // Warm the fill cache first; it must not replace the stroke geometry.
        isPointInElement(point, element, elementsMap);
        expect(
          hitElementItself({ element, elementsMap, point, threshold: 1 }),
        ).toBe(false);
      },
    );

    it("does not treat the empty corners of the loop bounds as fill", () => {
      const element = createLoop({ variability });
      const elementsMap = arrayToMap([element]);
      const point = pointFrom<GlobalPoint>(310, 210);

      expect(isPointInElement(point, element, elementsMap)).toBe(false);
      expect(
        hitElementItself({ element, elementsMap, point, threshold: 1 }),
      ).toBe(false);
    });
  },
);

describe("freedraw loop fill containment", () => {
  it.each([0, Math.PI / 4])(
    "hits the center and axes of a loop with curve junctions at angle %s",
    (angle) => {
      const element = createLoop({ angle });
      const elementsMap = arrayToMap([element]);
      const center = pointFrom<GlobalPoint>(380, 240);

      for (const point of [
        center,
        pointFrom<GlobalPoint>(400, 240),
        pointFrom<GlobalPoint>(380, 250),
      ]) {
        expect(
          isPointInElement(
            pointRotateRads(point, center, element.angle),
            element,
            elementsMap,
          ),
        ).toBe(true);
      }
    },
  );

  it.each([0, Math.PI / 4])(
    "implicitly closes the fill of an unsnapped loop at angle %s",
    (angle) => {
      const element = createLoop({ angle });
      const elementsMap = arrayToMap([element]);
      mutateElement(element, elementsMap, {
        points: [
          ...element.points.slice(0, -1),
          pointFrom<LocalPoint>(160, 36),
        ],
      });
      const point = pointRotateRads(
        pointFrom<GlobalPoint>(440, 239.5),
        pointFrom<GlobalPoint>(380, 240),
        element.angle,
      );

      expect(isPointInElement(point, element, elementsMap)).toBe(true);
    },
  );

  it("rotates around the unrotated bounds center of an asymmetric loop", () => {
    const element = createLoop({
      angle: Math.PI / 4,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(200, 0),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
    });
    const point = pointRotateRads(
      pointFrom<GlobalPoint>(330, 205),
      pointFrom<GlobalPoint>(400, 250),
      element.angle,
    );

    expect(isPointInElement(point, element, arrayToMap([element]))).toBe(true);
  });

  it("hits smoothed fill outside the rotated bounds of the points", () => {
    const element = createLoop({
      angle: (2 * Math.PI) / 3,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(200, 0),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
    });
    const elementsMap = arrayToMap([element]);
    // Outside the raw triangle, inside the curve bulging past its hypotenuse.
    const point = pointRotateRads(
      pointFrom<GlobalPoint>(436, 240),
      pointFrom<GlobalPoint>(400, 250),
      element.angle,
    );
    const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);

    expect(
      point[0] < x1 || point[0] > x2 || point[1] < y1 || point[1] > y2,
    ).toBe(true);
    expect(isPointInElement(point, element, elementsMap)).toBe(true);
    expect(
      hitElementItself({ element, elementsMap, point, threshold: 1 }),
    ).toBe(true);
  });

  it.each([
    {
      name: "a three-point retraced path",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
      point: pointFrom<GlobalPoint>(350, 250),
    },
    {
      name: "a loop that simplifies to two identical points",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(0.3, 0),
        pointFrom<LocalPoint>(0.3, 0.3),
        pointFrom<LocalPoint>(0, 0.3),
        pointFrom<LocalPoint>(0, 0),
      ],
      point: pointFrom<GlobalPoint>(300.15, 200.15),
    },
  ])("contains nothing for $name", ({ points, point }) => {
    const element = createLoop({ points });

    expect(isPointInElement(point, element, arrayToMap([element]))).toBe(false);
  });

  it("preserves the curved fill of a nearly closed three-point path", () => {
    const element = createLoop({
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(3, 0),
      ],
    });

    expect(
      isPointInElement(
        pointFrom<GlobalPoint>(350, 250),
        element,
        arrayToMap([element]),
      ),
    ).toBe(true);
  });

  it("includes the smoothed fill beyond the raw-point polygon", () => {
    const element = createLoop({
      points: [
        pointFrom<LocalPoint>(200, 100),
        pointFrom<LocalPoint>(100, 200),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(200, 100),
      ],
    });

    expect(
      isPointInElement(
        pointFrom<GlobalPoint>(305, 285),
        element,
        arrayToMap([element]),
      ),
    ).toBe(true);
  });

  it("uses even-odd fill for a self-intersecting loop", () => {
    const element = createLoop({
      points: Array.from({ length: 6 }, (_, i) => {
        const angle = -Math.PI / 2 + (((i * 2) % 5) / 5) * 2 * Math.PI;
        return pointFrom<LocalPoint>(
          100 + 95 * Math.cos(angle),
          100 + 95 * Math.sin(angle),
        );
      }),
    });

    expect(
      isPointInElement(
        pointFrom<GlobalPoint>(400, 300),
        element,
        arrayToMap([element]),
      ),
    ).toBe(false);
  });

  it("invalidates the fill contour when points change on the same element", () => {
    const element = createLoop();
    const elementsMap = arrayToMap([element]);
    const point = pointFrom<GlobalPoint>(415, 255);
    const version = element.version;

    expect(isPointInElement(point, element, elementsMap)).toBe(true);

    // Preserve the bounds so a stale contour cannot hide behind that pre-check.
    mutateElement(element, elementsMap, {
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(160, 0),
        pointFrom<LocalPoint>(0, 80),
        pointFrom<LocalPoint>(0, 0),
      ],
    });

    expect(element.version).toBeGreaterThan(version);
    expect(isPointInElement(point, element, elementsMap)).toBe(false);
  });
});
