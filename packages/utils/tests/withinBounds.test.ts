import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { Bounds } from "@excalidraw/element/bounds";

import {
  elementPartiallyOverlapsWithOrContainsBBox,
  elementsOverlappingBBox,
  isElementInsideBBox,
} from "../src/withinBounds";

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

describe("isElementInsideBBox()", () => {
  it("should return true if element is fully inside", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    // bbox contains element
    expect(isElementInsideBBox(makeElement(0, 0, 100, 100), bbox)).toBe(true);
    expect(isElementInsideBBox(makeElement(10, 10, 90, 90), bbox)).toBe(true);
  });

  it("should return false if element is only partially overlapping", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    // element contains bbox
    expect(isElementInsideBBox(makeElement(-10, -10, 110, 110), bbox)).toBe(
      false,
    );

    // element overlaps bbox from top-left
    expect(isElementInsideBBox(makeElement(-10, -10, 100, 100), bbox)).toBe(
      false,
    );
    // element overlaps bbox from top-right
    expect(isElementInsideBBox(makeElement(90, -10, 100, 100), bbox)).toBe(
      false,
    );
    // element overlaps bbox from bottom-left
    expect(isElementInsideBBox(makeElement(-10, 90, 100, 100), bbox)).toBe(
      false,
    );
    // element overlaps bbox from bottom-right
    expect(isElementInsideBBox(makeElement(90, 90, 100, 100), bbox)).toBe(
      false,
    );
  });

  it("should return false if element outside", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    // outside diagonally
    expect(isElementInsideBBox(makeElement(110, 110, 100, 100), bbox)).toBe(
      false,
    );

    // outside on the left
    expect(isElementInsideBBox(makeElement(-110, 10, 50, 50), bbox)).toBe(
      false,
    );
    // outside on the right
    expect(isElementInsideBBox(makeElement(110, 10, 50, 50), bbox)).toBe(false);
    // outside on the top
    expect(isElementInsideBBox(makeElement(10, -110, 50, 50), bbox)).toBe(
      false,
    );
    // outside on the bottom
    expect(isElementInsideBBox(makeElement(10, 110, 50, 50), bbox)).toBe(false);
  });

  it("should return true if bbox contains element and flag enabled", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    // element contains bbox
    expect(
      isElementInsideBBox(makeElement(-10, -10, 110, 110), bbox, true),
    ).toBe(true);

    // bbox contains element
    expect(isElementInsideBBox(makeElement(0, 0, 100, 100), bbox)).toBe(true);
    expect(isElementInsideBBox(makeElement(10, 10, 90, 90), bbox)).toBe(true);
  });
});

describe("elementPartiallyOverlapsWithOrContainsBBox()", () => {
  it("should return true if element overlaps, is inside, or contains", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    // bbox contains element
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(0, 0, 100, 100),
        bbox,
      ),
    ).toBe(true);
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(10, 10, 90, 90),
        bbox,
      ),
    ).toBe(true);

    // element contains bbox
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(-10, -10, 110, 110),
        bbox,
      ),
    ).toBe(true);

    // element overlaps bbox from top-left
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(-10, -10, 100, 100),
        bbox,
      ),
    ).toBe(true);
    // element overlaps bbox from top-right
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(90, -10, 100, 100),
        bbox,
      ),
    ).toBe(true);
    // element overlaps bbox from bottom-left
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(-10, 90, 100, 100),
        bbox,
      ),
    ).toBe(true);
    // element overlaps bbox from bottom-right
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(90, 90, 100, 100),
        bbox,
      ),
    ).toBe(true);
  });

  it("should return false if element does not overlap", () => {
    const bbox = makeBBox(0, 0, 100, 100);

    // outside diagonally
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(110, 110, 100, 100),
        bbox,
      ),
    ).toBe(false);

    // outside on the left
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(-110, 10, 50, 50),
        bbox,
      ),
    ).toBe(false);
    // outside on the right
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(110, 10, 50, 50),
        bbox,
      ),
    ).toBe(false);
    // outside on the top
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(10, -110, 50, 50),
        bbox,
      ),
    ).toBe(false);
    // outside on the bottom
    expect(
      elementPartiallyOverlapsWithOrContainsBBox(
        makeElement(10, 110, 50, 50),
        bbox,
      ),
    ).toBe(false);
  });
});

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
