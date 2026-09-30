import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

import { getElementsOverlappingFrame } from "../src/frame";
import { newFrameElement, newFreeDrawElement } from "../src/newElement";
import { isElementInViewport } from "../src/sizeHelpers";

// a 100×100 frame, and a stroke 40 units wide (drawn about 170 wide at full
// pressure) whose centre line runs `gap` units right of it
const scene = (gap: number) => {
  const frame = newFrameElement({ x: 0, y: 0, width: 100, height: 100 });
  const stroke = newFreeDrawElement({
    type: "freedraw",
    x: 100 + gap,
    y: 0,
    strokeWidth: 40,
    simulatePressure: false,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 100)],
    width: 0,
    height: 100,
  });
  return { frame, stroke, elementsMap: arrayToMap([frame, stroke]) };
};

// the view shows scene 0..100 on both axes
const view = {
  zoom: { value: 1 as NormalizedZoomValue },
  offsetLeft: 0,
  offsetTop: 0,
  scrollX: 0,
  scrollY: 0,
};

describe("a stroke's paint reaching past its centre line", () => {
  it("is exported with the frame its ink crosses into", () => {
    const { frame, stroke, elementsMap } = scene(40);
    expect(
      getElementsOverlappingFrame([stroke], frame, elementsMap).map(
        (element) => element.id,
      ),
    ).toEqual([stroke.id]);
  });

  it("is left out of a frame its ink does not reach", () => {
    const { frame, stroke, elementsMap } = scene(400);
    expect(getElementsOverlappingFrame([stroke], frame, elementsMap)).toEqual(
      [],
    );
  });

  it("is in the viewport when only its ink is on screen", () => {
    const { stroke, elementsMap } = scene(40);
    expect(isElementInViewport(stroke, 100, 100, view, elementsMap)).toBe(true);
  });

  it("is out of the viewport when its ink is off screen too", () => {
    const { stroke, elementsMap } = scene(400);
    expect(isElementInViewport(stroke, 100, 100, view, elementsMap)).toBe(
      false,
    );
  });
});
