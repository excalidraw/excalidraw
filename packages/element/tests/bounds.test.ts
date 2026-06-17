import { pointFrom } from "@excalidraw/math";
import { arrayToMap, type Bounds, ROUNDNESS } from "@excalidraw/common";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { LocalPoint } from "@excalidraw/math";

import {
  elementsOverlappingBBox,
  getElementAbsoluteCoords,
  getElementBounds,
  getStarPoints,
} from "../src/bounds";

import type { ExcalidrawElement, ExcalidrawLinearElement } from "../src/types";

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

describe("getStarPoints()", () => {
  it("returns 10 vertices with the top point at the center-top of the bounding box", () => {
    const element = API.createElement({
      type: "star",
      width: 100,
      height: 80,
    });

    const points = getStarPoints(element);

    expect(points).toHaveLength(10);
    expect(points[0][0]).toBeCloseTo(50);
    expect(points[0][1]).toBeCloseTo(0);
  });
});
