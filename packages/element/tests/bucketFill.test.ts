import { arrayToMap, ROUNDNESS } from "@excalidraw/common";
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

  it("ignores outline portions hidden behind an opaque element on top", () => {
    // `hidden` sits below `owner`; the part of its outline inside `owner` is
    // covered by owner's opaque fill, so it must not act as a boundary
    const hidden = API.createElement({
      type: "rectangle",
      x: 40,
      y: 40,
      width: 100,
      height: 100,
      roundness: null,
    });
    const owner = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "#ffd43b",
    });
    // owner drawn last => on top, with an opaque fill
    const { elements, elementsMap } = setup([hidden, owner]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(20, 20),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBe(owner.id);
    // the whole visible owner fills (~10000); the hidden outline does NOT carve
    // out the ~6400 L-shape it would if it were visible
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(9000);
  });

  it("respects outlines visible through a transparent element on top", () => {
    // same geometry, but `owner` is transparent, so the lower rectangle's
    // outline shows through and splits the region
    const lower = API.createElement({
      type: "rectangle",
      x: 40,
      y: 40,
      width: 100,
      height: 100,
      roundness: null,
    });
    const owner = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    const { elements, elementsMap } = setup([lower, owner]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(20, 20),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // the visible outline carves out the overlap corner => ~6400 L-shape
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(6000);
    expect(polygonArea(result.scenePoints)).toBeLessThan(7000);
  });

  it("fills the whole top element when clicking an opaque overlap", () => {
    // clicking the overlap of two OPAQUE shapes fills the whole top shape, not
    // the small overlap: the lower outline is hidden behind the top shape's
    // opaque fill, so it does not subdivide the visible region
    const lower = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "#ffd43b",
    });
    const top = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "#ffd43b",
    });
    const { elements, elementsMap } = setup([lower, top]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(75, 75), // inside the 50x50 overlap
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBe(top.id);
    // the whole top rectangle (~10000), NOT the 50x50 overlap (~2500)
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(9000);
  });

  it("fills a rounded owner partially covered by a thin opaque overlap", () => {
    // regression: a thin opaque coverer crossing the owner's ROUNDED corners
    // left sub-pixel gaps in the clipped outline, opening the region. The
    // gapTolerance-based node merging in the arrangement bridges them.
    const rounded = { type: ROUNDNESS.ADAPTIVE_RADIUS } as const;
    const owner = API.createElement({
      type: "rectangle",
      x: 180,
      y: 650,
      width: 240,
      height: 195,
      roundness: rounded,
      backgroundColor: "#ffd43b",
    });
    const sideways = API.createElement({
      type: "rectangle",
      x: 5,
      y: 690,
      width: 230,
      height: 160,
      roundness: rounded,
      backgroundColor: "#ffd43b",
    });
    // thin opaque cover: its bottom edge overlaps the owner's top by ~5px,
    // crossing the owner's rounded top corners
    const cover = API.createElement({
      type: "rectangle",
      x: 110,
      y: 510,
      width: 245,
      height: 145,
      roundness: rounded,
      backgroundColor: "#a5d8ff",
    });
    const { elements, elementsMap } = setup([sideways, owner, cover]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(300, 740),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBe(owner.id);
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
