import { arrayToMap, ROUNDNESS } from "@excalidraw/common";
import {
  distanceToLineSegment,
  lineSegment,
  pointFrom,
} from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

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
    // transparent owner => the fill goes below it
    expect(result.insertion).toEqual({
      placement: "below",
      elementId: rect.id,
    });
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

  it("fills a curved line polygon along its smoothed path", () => {
    // curved (`roundness`) lines render a curve fitted through the points;
    // the fill boundary must sample that curve, not cut corners along the
    // raw polyline
    const points = [
      pointFrom<LocalPoint>(0, 50),
      pointFrom<LocalPoint>(35, 0),
      pointFrom<LocalPoint>(100, 20),
      pointFrom<LocalPoint>(90, 80),
      pointFrom<LocalPoint>(30, 100),
      pointFrom<LocalPoint>(0, 50),
    ];
    const blob = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points,
      polygon: true,
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    });
    const { elements, elementsMap } = setup([blob]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // the smoothed curve bulges away from the polyline between sparse
    // points — some fill vertex must deviate from every polyline chord by
    // clearly more than the snap epsilon (a polyline-based boundary would
    // keep all vertices within ~1px of the chords)
    const chords = points
      .slice(0, -1)
      .map((p, i) => lineSegment(p as any, points[i + 1] as any));
    const maxDeviation = Math.max(
      ...result.scenePoints.map((vertex) =>
        Math.min(
          ...chords.map((chord) => distanceToLineSegment(vertex, chord as any)),
        ),
      ),
    );
    expect(maxDeviation).toBeGreaterThan(2);
  });

  it("fills a diamond", () => {
    // regression: a roundness:null diamond still has tiny (~2px chord) corner
    // arcs whose densely-subdivided segments used to be dropped by the
    // sub-epsilon length filter, disconnecting the outline at the corners
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      roundness: null,
    });
    const { elements, elementsMap } = setup([diamond]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(100, 75),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(isClosed(result.scenePoints)).toBe(true);
    // diamond area = w*h/2 = 15000
    expect(polygonArea(result.scenePoints)).toBeCloseTo(15000, -3);
  });

  it("fills a freedraw loop with a hand-drawn closure gap", () => {
    // regression: isPathALoop accepts closure gaps up to LINE_CONFIRM_THRESHOLD
    // (8px), so the segment chain must be bridged explicitly or the region
    // reads as open even though it renders (and hit-tests) as closed
    const points: LocalPoint[] = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 0),
      pointFrom<LocalPoint>(100, 100),
      pointFrom<LocalPoint>(0, 100),
      pointFrom<LocalPoint>(0, 5),
    ];
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points,
    });
    const { elements, elementsMap } = setup([freedraw]);

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
    expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -3);
  });

  it("fills a line polygon", () => {
    const triangle = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(50, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
      ],
      polygon: true,
    });
    const { elements, elementsMap } = setup([triangle]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 70),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(isClosed(result.scenePoints)).toBe(true);
    expect(polygonArea(result.scenePoints)).toBeCloseTo(5000, -3);
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
    // both participants are transparent => below the lowest one
    expect(result.insertion).toEqual({
      placement: "below",
      elementId: below.id,
    });
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

  it("ignores a text element's never-rendered backgroundColor", () => {
    // text elements inherit currentItemBackgroundColor on creation but never
    // paint it — such a text box overlapping the owner outline must neither
    // cover (clip) the outline nor act as a boundary
    const owner = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const text = API.createElement({
      type: "text",
      x: 80,
      y: 40,
      width: 60,
      height: 25,
      backgroundColor: "#ffec99",
    });
    const { elements, elementsMap } = setup([owner, text]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -1);
  });

  it("does not treat a hachure-filled element as covering", () => {
    // hachure fill is see-through: the lower outline stays visible through it
    // and must still act as a boundary
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
      backgroundColor: "#ffd43b",
      fillStyle: "hachure",
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
    // the outline visible through the hachure carves out the overlap corner
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(6000);
    expect(polygonArea(result.scenePoints)).toBeLessThan(7000);
  });

  it("does not treat a semi-transparent element as covering", () => {
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
      backgroundColor: "#ffd43b",
      opacity: 50,
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
    // the outline blended through the 50% fill still bounds the region
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
    // the opaque owner would hide a fill beneath it => above it
    expect(result.insertion).toEqual({
      placement: "above",
      elementId: top.id,
    });
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

  it("fills a region enclosed only by open lines (owner-less)", () => {
    // 4 open lines forming a diamond; no closed element anywhere
    const mkLine = (pts: [number, number][]) =>
      API.createElement({
        type: "line",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        points: pts.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
      });
    const l1 = mkLine([
      [50, 0],
      [100, 50],
    ]);
    const l2 = mkLine([
      [100, 50],
      [50, 100],
    ]);
    const l3 = mkLine([
      [50, 100],
      [0, 50],
    ]);
    const l4 = mkLine([
      [0, 50],
      [50, 0],
    ]);
    const { elements, elementsMap } = setup([l1, l2, l3, l4]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBeNull();
    expect(result.boundaryElementIds.sort()).toEqual(
      [l1.id, l2.id, l3.id, l4.id].sort(),
    );
    expect(isClosed(result.scenePoints)).toBe(true);
    // diamond with diagonals 100 => area 5000
    expect(polygonArea(result.scenePoints)).toBeCloseTo(5000, -3);
  });

  it("fills a loop formed by a single self-crossing open polyline", () => {
    // open polyline that crosses itself, enclosing a triangle
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(100, 0),
      ],
    });
    const { elements, elementsMap } = setup([line]);

    // click inside the enclosed lower triangle (50,50)-(0,100)-(100,100)...
    // actually the loop is the triangle between the two crossing diagonals
    // and the bottom edge; its centroid is around (50, 83)
    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 80),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBeNull();
    expect(result.boundaryElementIds).toEqual([line.id]);
    // triangle (50,50)-(0,100)-(100,100) => area 2500
    expect(polygonArea(result.scenePoints)).toBeCloseTo(2500, -3);
  });

  it("fills a region closed by an open line against a shape's outside wall", () => {
    // an open V-line whose two ends touch the rectangle's right edge,
    // enclosing a region OUTSIDE the rectangle
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const line = API.createElement({
      type: "line",
      x: 100,
      y: 20,
      width: 60,
      height: 60,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(60, 30),
        pointFrom<LocalPoint>(0, 60),
      ],
    });
    const { elements, elementsMap } = setup([rect, line]);

    // inside the triangle right of the rectangle's wall
    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(115, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ownerId).toBeNull();
    expect(result.boundaryElementIds.sort()).toEqual([line.id, rect.id].sort());
    // triangle (100,20)-(160,50)-(100,80) => area 1800
    expect(polygonArea(result.scenePoints)).toBeCloseTo(1800, -3);
  });

  it("fills only the clicked lobe of a self-intersecting (figure-eight) polygon", () => {
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
      polygon: true,
    });
    const { elements, elementsMap } = setup([line]);

    // left lobe: triangle (0,0)-(50,50)-(0,100), centroid ~(17, 50)
    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(17, 50),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // one lobe (area 2500), not the whole figure-eight
    expect(polygonArea(result.scenePoints)).toBeCloseTo(2500, -3);
  });

  it("handles a line retracing part of the owner's edge (collinear overlap)", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    // line running exactly along the rect's top edge, extending past it
    const retrace = API.createElement({
      type: "line",
      x: -50,
      y: 0,
      width: 200,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
    });
    const { elements, elementsMap } = setup([rect, retrace]);

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
    expect(isClosed(result.scenePoints)).toBe(true);
    expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -3);
  });

  it("bridges endpoint gaps up to gapTolerance without distorting the shape", () => {
    // triangle of open lines whose corners have ~5px gaps: bridged by the
    // default tolerance (8), unfillable with a stricter one
    const mkLine = (pts: [number, number][]) =>
      API.createElement({
        type: "line",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        points: pts.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
      });
    const l1 = mkLine([
      [4, 0],
      [96, 0],
    ]);
    const l2 = mkLine([
      [100, 4],
      [52, 96],
    ]);
    const l3 = mkLine([
      [48, 96],
      [0, 4],
    ]);
    const { elements, elementsMap } = setup([l1, l2, l3]);
    const point = pointFrom<GlobalPoint>(50, 30);

    const result = computeBucketFillPolygon({ point, elements, elementsMap });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // fidelity: gaps are closed by ADDING connector edges, never by moving
    // vertices — every polygon vertex must lie (near-)on one of the strokes,
    // not be dragged toward a merged corner position
    const strokes = [
      lineSegment(pointFrom<GlobalPoint>(4, 0), pointFrom<GlobalPoint>(96, 0)),
      lineSegment(
        pointFrom<GlobalPoint>(100, 4),
        pointFrom<GlobalPoint>(52, 96),
      ),
      lineSegment(pointFrom<GlobalPoint>(48, 96), pointFrom<GlobalPoint>(0, 4)),
    ];
    for (const vertex of result.scenePoints) {
      const distance = Math.min(
        ...strokes.map((stroke) => distanceToLineSegment(vertex, stroke)),
      );
      expect(distance).toBeLessThanOrEqual(2);
    }

    const strict = computeBucketFillPolygon({
      point,
      elements,
      elementsMap,
      options: { gapTolerance: 2 },
    });
    expect(strict.ok).toBe(false);
  });

  it("bridges a stroke ending short of a long edge at the projection point", () => {
    // chord stopping 6px short of both rectangle walls: the nearest NODES on
    // those walls are the far-away corners, so bridging must split the wall
    // edge at the chord end's projection instead of snapping to a corner
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    const chord = API.createElement({
      type: "line",
      x: 6,
      y: 50,
      width: 88,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(88, 0)],
    });
    const { elements, elementsMap } = setup([rect, chord]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 25),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // upper half of the rectangle, not the whole thing
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(4500);
    expect(polygonArea(result.scenePoints)).toBeLessThan(5500);
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
