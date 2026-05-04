import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { Bounds } from "@excalidraw/common";

import { elementsOverlappingBBox } from "../src/deprecated";

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
    const rectInside = makeElement(10, 10, 90, 90);
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
    ).toEqual([rectInside, rectContainingBBox, rectOverlappingTopLeft]);
  });

  it("should return elements inside/containing bbox", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    const rectOutside = makeElement(110, 110, 100, 100);
    const rectInside = makeElement(10, 10, 90, 90);
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
    ).toEqual([rectInside, rectContainingBBox]);
  });

  it("should return elements inside bbox", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    const rectOutside = makeElement(110, 110, 100, 100);
    const rectInside = makeElement(10, 10, 90, 90);
    const rectContainingBBox = makeElement(-10, -10, 110, 110);
    const rectOverlappingTopLeft = makeElement(-10, -10, 50, 50);

    expect(
      elementsOverlappingBBox({
        bounds: bbox,
        type: "inside",
        elements: [
          rectOutside,
          rectInside,
          rectContainingBBox,
          rectOverlappingTopLeft,
        ],
      }),
    ).toEqual([rectInside]);
  });

  // TODO test linear, freedraw, and diamond element types (+rotated)
});
