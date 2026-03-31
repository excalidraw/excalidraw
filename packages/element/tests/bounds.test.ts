import { pointFrom } from "@excalidraw/math";

import { arrayToMap, ROUNDNESS } from "@excalidraw/common";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import {
  getElementAbsoluteCoords,
  getElementBounds,
  getMinMaxXYFromCurvePathOps,
} from "../src/bounds";

import type { ExcalidrawElement, ExcalidrawLinearElement } from "../src/types";

import type { Op } from "roughjs/bin/core";

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

describe("getMinMaxXYFromCurvePathOps", () => {
  it("get min max XY for line", () => {
    const transform: (p: GlobalPoint) => GlobalPoint = (p: GlobalPoint) =>
      pointFrom(p[0] + 10, p[1] + 10);

    const ops: Op[] = [
      { op: "move", data: [0, 0] },
      { op: "lineTo", data: [50, 50] },
    ];

    const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(
      ops,
      transform,
    );

    expect(minX).toEqual(10);
    expect(minY).toEqual(10);
    expect(maxX).toEqual(60);
    expect(maxY).toEqual(60);
  });

  it("get min max XY for qcurve", () => {
    const transform: (p: GlobalPoint) => GlobalPoint = (p: GlobalPoint) =>
      pointFrom(p[0] + 10, p[1] + 10);

    const ops: Array<
      | Op
      | {
          op: "qcurveTo";
          data: number[];
        }
    > = [
      { op: "move", data: [0, 0] },
      { op: "qcurveTo", data: [50, 100, 100, 0] },
    ];

    const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(
      ops,
      transform,
    );

    expect(minX).toEqual(10);
    expect(minY).toEqual(10);
    expect(maxX).toEqual(110);
    expect(maxY).toEqual(60);
  });

  it("getElementBounds for lineTo", () => {
    const element = {
      ..._ce({
        t: "line",
        x: 100,
        y: 100,
        w: 100,
        h: 100,
        a: 0,
      }),
      roundness: null,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 100),
        pointFrom<LocalPoint>(100, 0),
      ],
    } as ExcalidrawLinearElement;

    const [x1, y1, x2, y2] = getElementBounds(element, arrayToMap([element]));

    expect(x1).toEqual(100);
    expect(y1).toEqual(100);
    expect(x2).toEqual(200);
    expect(y2).toEqual(200);
  });
});
