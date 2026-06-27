import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint } from "@excalidraw/math";

import { computeBucketFillPolygon } from "../src/bucketFill";

import type { ElementsMap, NonDeletedExcalidrawElement } from "../src/types";

const setup = (elements: NonDeletedExcalidrawElement[]) => ({
  elements,
  elementsMap: arrayToMap(elements) as ElementsMap,
});

const polygonArea = (pts: GlobalPoint[]): number => {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(area / 2);
};

const isClosed = (pts: GlobalPoint[]): boolean =>
  pts.length > 3 &&
  pts[0][0] === pts[pts.length - 1][0] &&
  pts[0][1] === pts[pts.length - 1][1];

describe("computeBucketFillPolygon", () => {
  it("fills a simple rectangle and returns a closed polygon", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const { elements, elementsMap } = setup([rect]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBe(rect.id);
    expect(result.boundaryElementIds).toEqual([]);
    expect(isClosed(result.scenePoints)).toBe(true);
    expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -1);
  });

  it("fills a rotated rectangle", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 5,
      roundness: null,
    });
    const { elements, elementsMap } = setup([rect]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(isClosed(result.scenePoints)).toBe(true);
    expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -1);
  });

  it("fills an ellipse with a bounded point count", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const { elements, elementsMap } = setup([ellipse]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(isClosed(result.scenePoints)).toBe(true);
    // circle of r=50 ~ 7854; simplified polygon is slightly smaller
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(7000);
    expect(polygonArea(result.scenePoints)).toBeLessThan(7900);
    expect(result.scenePoints.length).toBeLessThanOrEqual(64);
    expect(result.scenePoints.length).toBeGreaterThan(6);
  });

  it("fills the overlap region split by a rectangle below the owner", () => {
    const below = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const owner = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      roundness: null,
    });
    // `owner` is drawn last => topmost => chosen as owner; `below` is lower
    // z-order but must still participate in the boundary graph.
    const { elements, elementsMap } = setup([below, owner]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(75, 75),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBe(owner.id);
    expect(result.boundaryElementIds).toContain(below.id);
    // overlap region is the 50x50 square (50,50)-(100,100) => area 2500,
    // much smaller than either full 100x100 rectangle
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(2300);
    expect(polygonArea(result.scenePoints)).toBeLessThan(2700);
  });

  it("fills the owner-minus-overlap region when clicking outside the overlap", () => {
    const below = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const owner = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      roundness: null,
    });
    const { elements, elementsMap } = setup([below, owner]);

    // (130,130) is inside `owner` but outside `below`
    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(130, 130),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // owner (10000) minus overlap (2500) => 7500
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(7200);
    expect(polygonArea(result.scenePoints)).toBeLessThan(7800);
  });

  it("returns no_owner for open canvas", () => {
    const { elements, elementsMap } = setup([]);
    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(10, 10),
      elements,
      elementsMap,
    });
    expect(result).toEqual({ ok: false, reason: "no_owner" });
  });

  it("returns no_owner when clicking outside every closed shape", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      roundness: null,
    });
    const { elements, elementsMap } = setup([rect]);
    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(500, 500),
      elements,
      elementsMap,
    });
    expect(result.ok).toBe(false);
  });

  it("returns too_complex when the segment cap is exceeded", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const { elements, elementsMap } = setup([rect]);
    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
      options: { maxBoundarySegments: 2 },
    });
    expect(result).toEqual({ ok: false, reason: "too_complex" });
  });

  it("ignores prior bucket fills when detecting an owner", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const priorFill = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    (priorFill as any).customData = { bucketFill: { version: 1 } };
    const { elements, elementsMap } = setup([rect, priorFill]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // owner is the rectangle, not the prior fill on top of it
    expect(result.ownerId).toBe(rect.id);
  });
});
