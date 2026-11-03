import {
  degreesToRadians,
  distanceToLineSegment,
  lineSegment,
  pointDistance,
  pointFrom,
} from "@excalidraw/math";
import { arrayToMap, type Bounds, ROUNDNESS } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { LocalPoint } from "@excalidraw/math";

import {
  CARDINALITY_ONE_OR_MANY_BAR_OFFSET,
  elementsOverlappingBBox,
  getArrowheadAngle,
  getArrowheadPoints,
  getArrowheadSize,
  getElementAbsoluteCoords,
  getElementBounds,
} from "../src/bounds";
import { ShapeCache } from "../src/shape";

import type {
  Arrowhead,
  ExcalidrawElement,
  ExcalidrawLinearElement,
} from "../src/types";

const _ce = ({
  x,
  y,
  w,
  h,
  a,
  t,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  a?: number;
  t?: string;
}) =>
  ({
    type: t || "rectangle",
    strokeColor: "#000",
    backgroundColor: "#000",
    fillStyle: "solid",
    strokeWidth: 1,
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    roughness: 0,
    opacity: 1,
    x,
    y,
    width: w,
    height: h,
    angle: a,
  } as ExcalidrawElement);

describe("getElementAbsoluteCoords", () => {
  it("test x1 coordinate", () => {
    const element = _ce({ x: 10, y: 20, w: 10, h: 0 });
    const [x1] = getElementAbsoluteCoords(element, arrayToMap([element]));
    expect(x1).toEqual(10);
  });

  it("test x2 coordinate", () => {
    const element = _ce({ x: 10, y: 20, w: 10, h: 0 });
    const [, , x2] = getElementAbsoluteCoords(element, arrayToMap([element]));
    expect(x2).toEqual(20);
  });

  it("test y1 coordinate", () => {
    const element = _ce({ x: 0, y: 10, w: 0, h: 10 });
    const [, y1] = getElementAbsoluteCoords(element, arrayToMap([element]));
    expect(y1).toEqual(10);
  });

  it("test y2 coordinate", () => {
    const element = _ce({ x: 0, y: 10, w: 0, h: 10 });
    const [, , , y2] = getElementAbsoluteCoords(element, arrayToMap([element]));
    expect(y2).toEqual(20);
  });
});

describe("getElementBounds", () => {
  it("rectangle", () => {
    const element = _ce({
      x: 40,
      y: 30,
      w: 20,
      h: 10,
      a: Math.PI / 4,
      t: "rectangle",
    });
    const [x1, y1, x2, y2] = getElementBounds(element, arrayToMap([element]));
    expect(x1).toEqual(39.39339828220179);
    expect(y1).toEqual(24.393398282201787);
    expect(x2).toEqual(60.60660171779821);
    expect(y2).toEqual(45.60660171779821);
  });

  it("diamond", () => {
    const element = _ce({
      x: 40,
      y: 30,
      w: 20,
      h: 10,
      a: Math.PI / 4,
      t: "diamond",
    });

    const [x1, y1, x2, y2] = getElementBounds(element, arrayToMap([element]));

    expect(x1).toEqual(42.928932188134524);
    expect(y1).toEqual(27.928932188134524);
    expect(x2).toEqual(57.071067811865476);
    expect(y2).toEqual(42.071067811865476);
  });

  it("ellipse", () => {
    const element = _ce({
      x: 40,
      y: 30,
      w: 20,
      h: 10,
      a: Math.PI / 4,
      t: "ellipse",
    });

    const [x1, y1, x2, y2] = getElementBounds(element, arrayToMap([element]));
    expect(x1).toEqual(42.09430584957905);
    expect(y1).toEqual(27.09430584957905);
    expect(x2).toEqual(57.90569415042095);
    expect(y2).toEqual(42.90569415042095);
  });

  it("curved line", () => {
    const element = {
      ..._ce({
        t: "line",
        x: 449.58203125,
        y: 186.0625,
        w: 170.12890625,
        h: 92.48828125,
        a: 0.6447741904932416,
      }),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(67.33984375, 92.48828125),
        pointFrom<LocalPoint>(-102.7890625, 52.15625),
      ],
    } as ExcalidrawLinearElement;

    const [x1, y1, x2, y2] = getElementBounds(element, arrayToMap([element]));
    expect(x1).toEqual(360.9291017525165);
    expect(y1).toEqual(185.24770129343722);
    expect(x2).toEqual(481.4815539037601);
    expect(y2).toEqual(319.8162855827246);
  });
});

const makeElement = (x: number, y: number, width: number, height: number) =>
  API.createElement({
    type: "rectangle",
    x,
    y,
    width,
    height,
  });

const makeBBox = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Bounds => [minX, minY, maxX, maxY];

describe("elementsOverlappingBBox()", () => {
  it("should return elements that overlap bbox", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    const rectOutside = makeElement(110, 110, 100, 100);
    const rectInside = makeElement(10, 10, 85, 85);
    const rectContainingBBox = makeElement(-10, -10, 110, 110);
    const rectOverlappingTopLeft = makeElement(-10, -10, 50, 50);

    expect(
      elementsOverlappingBBox({
        bounds: bbox,
        type: "overlap",
        elements: [
          rectOutside,
          rectInside,
          rectContainingBBox,
          rectOverlappingTopLeft,
        ],
      }),
    ).toEqual([rectInside, rectOverlappingTopLeft]);
  });

  it("should return elements inside/containing bbox", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    const rectOutside = makeElement(110, 110, 100, 100);
    const rectInside = makeElement(10, 10, 85, 85);
    const rectContainingBBox = makeElement(-10, -10, 110, 110);
    const rectOverlappingTopLeft = makeElement(-10, -10, 50, 50);

    expect(
      elementsOverlappingBBox({
        bounds: bbox,
        type: "contain",
        elements: [
          rectOutside,
          rectInside,
          rectContainingBBox,
          rectOverlappingTopLeft,
        ],
      }),
    ).toEqual([rectInside]);
  });
});

describe("getArrowheadPoints()", () => {
  // the last segment is 7px long, the previous one turns into it by ~67°
  const prevSegment = lineSegment(
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(24, 10),
  );
  const lastSegmentLength = 7;

  const tip = pointFrom<LocalPoint>(24, 10 + lastSegmentLength);

  const getEndArrowheadPoints = (
    endArrowhead: Arrowhead,
    {
      roundness = null,
      part = endArrowhead,
      offsetMultiplier,
    }: {
      roundness?: ExcalidrawLinearElement["roundness"];
      /** the part of a composite marker to get */
      part?: Arrowhead;
      offsetMultiplier?: number;
    } = {},
  ) => {
    const arrow = API.createElement({
      type: "arrow",
      points: [prevSegment[0], prevSegment[1], tip],
      endArrowhead,
      roundness,
      roughness: 0,
      strokeWidth: 2,
    });

    return getArrowheadPoints(
      arrow,
      ShapeCache.generateElementShape(arrow, null),
      "end",
      part,
      offsetMultiplier,
    )!;
  };

  it("lets triangle arrowheads cover a short last segment", () => {
    const [, tipY, , y1, , y2] = getEndArrowheadPoints("triangle");

    // the last segment points down
    expect(tipY - (y1 + y2) / 2).toBeGreaterThan(lastSegmentLength);
  });

  it("grows arrow arrowheads on a short last segment clear of the previous one", () => {
    const [, tipY, x1, y1, x2, y2] = getEndArrowheadPoints("arrow");

    expect(tipY - (y1 + y2) / 2).toBeGreaterThan(lastSegmentLength * 0.75);
    for (const sideEnd of [pointFrom(x1, y1), pointFrom(x2, y2)]) {
      // stroke width
      expect(distanceToLineSegment(sideEnd, prevSegment)).toBeGreaterThan(2);
    }
  });

  it("doesn't grow arrowheads of curved arrows past the last segment", () => {
    const [, tipY, , y1, , y2] = getEndArrowheadPoints("triangle", {
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    });

    expect(tipY - (y1 + y2) / 2).toBeLessThanOrEqual(lastSegmentLength / 2);
  });

  it("grows circle arrowheads past a short last segment, also on curved arrows", () => {
    for (const roundness of [null, { type: ROUNDNESS.PROPORTIONAL_RADIUS }]) {
      const [, , diameter] = getEndArrowheadPoints("circle", { roundness });

      expect(diameter).toBeGreaterThan(lastSegmentLength);
    }
  });

  it("fits cardinality markers to a short last segment, scaling their parts together", () => {
    const [apexX, apexY] = getEndArrowheadPoints("cardinality_one_or_many", {
      part: "cardinality_many",
    });
    const [, , x1, y1, x2, y2] = getEndArrowheadPoints(
      "cardinality_one_or_many",
      {
        part: "cardinality_one",
        offsetMultiplier: CARDINALITY_ONE_OR_MANY_BAR_OFFSET,
      },
    );
    const crowsFootLength = pointDistance(pointFrom(apexX, apexY), tip);
    const barLength = pointDistance(pointFrom(x1, y1), pointFrom(x2, y2));

    expect(crowsFootLength).toBeGreaterThan(lastSegmentLength / 2);
    expect(crowsFootLength).toBeLessThanOrEqual(lastSegmentLength);
    // same proportions as at full size
    expect(barLength / crowsFootLength).toBeCloseTo(
      (2 *
        getArrowheadSize("cardinality_one") *
        Math.sin(degreesToRadians(getArrowheadAngle("cardinality_one")))) /
        getArrowheadSize("cardinality_many"),
    );
  });

  it("fits cardinality markers before the rounded corner of elbow arrows", () => {
    const lastSegmentLength = 19;
    const arrow = API.createElement({
      type: "arrow",
      elbowed: true,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(40, 0),
        pointFrom<LocalPoint>(40, 30),
        pointFrom<LocalPoint>(70, 30),
        pointFrom<LocalPoint>(70, 30 + lastSegmentLength),
      ],
      endArrowhead: "cardinality_many",
      roughness: 0,
    });
    const [, apexY] = getArrowheadPoints(
      arrow,
      ShapeCache.generateElementShape(arrow, null),
      "end",
      "cardinality_many",
    )!;
    const crowsFootLength = 30 + lastSegmentLength - apexY;
    const cornerRadius = lastSegmentLength / 2;

    expect(crowsFootLength).toBeGreaterThan(lastSegmentLength / 2);
    // at most halfway into the corner's rounding
    expect(crowsFootLength).toBeCloseTo(lastSegmentLength - cornerRadius / 2);
  });

  it("grows bar arrowheads with their ends closer to the tip than to the previous segment", () => {
    const [tipX, tipY, x1, y1, x2, y2] = getEndArrowheadPoints("bar");
    const arrowTip = pointFrom<LocalPoint>(tipX, tipY);

    for (const barEnd of [
      pointFrom<LocalPoint>(x1, y1),
      pointFrom<LocalPoint>(x2, y2),
    ]) {
      const length = pointDistance(barEnd, arrowTip);

      expect(length).toBeGreaterThan(lastSegmentLength);
      expect(distanceToLineSegment(barEnd, prevSegment)).toBeGreaterThan(
        length - 0.01,
      );
    }
  });

  it("lets diamond arrowheads reach back to the last segment's start", () => {
    const [tipX, tipY, , , backX, backY] = getEndArrowheadPoints("diamond");

    expect(
      pointDistance(pointFrom(tipX, tipY), pointFrom(backX, backY)),
    ).toBeCloseTo(lastSegmentLength);
  });
});
