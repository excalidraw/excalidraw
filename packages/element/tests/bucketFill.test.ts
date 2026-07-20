import { arrayToMap, ROUNDNESS } from "@excalidraw/common";
import {
  distanceToLineSegment,
  lineSegment,
  pointFrom,
  polygonIncludesPoint,
} from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { GlobalPoint, LocalPoint, Polygon } from "@excalidraw/math";

import { computeBucketFillPolygon, isRestylableFill } from "../src/bucketFill";
import { getFreedrawStrokeCenterPoints } from "../src/shape";

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
    // reads as open even though it renders (and hit-tests) as closed.
    // Realistically dense points (~10px spacing, like actual drawing input) —
    // the boundary follows the streamline-smoothed centerline, which only
    // tracks the input at drawing-like densities
    const points: LocalPoint[] = [];
    const corners = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 5],
    ];
    for (let c = 0; c < corners.length - 1; c++) {
      const [ax, ay] = corners[c];
      const [bx, by] = corners[c + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 10);
      for (let s = 0; s < steps; s++) {
        points.push(
          pointFrom<LocalPoint>(
            ax + ((bx - ax) * s) / steps,
            ay + ((by - ay) * s) / steps,
          ),
        );
      }
    }
    points.push(pointFrom<LocalPoint>(0, 5));
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

  it("fills an exactly-closed freedraw loop", () => {
    // the sibling of the gapped-closure test: last point === first point,
    // so no synthetic closing segment is needed at all
    const points: LocalPoint[] = [];
    const corners = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];
    for (let c = 0; c < corners.length - 1; c++) {
      const [ax, ay] = corners[c];
      const [bx, by] = corners[c + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 10);
      for (let s = 0; s < steps; s++) {
        points.push(
          pointFrom<LocalPoint>(
            ax + ((bx - ax) * s) / steps,
            ay + ((by - ay) * s) / steps,
          ),
        );
      }
    }
    points.push(pointFrom<LocalPoint>(0, 0));
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

  const lineSquare = (half: number) => {
    const mkLine = (x: number, y: number, dx: number, dy: number) =>
      API.createElement({
        type: "line",
        x,
        y,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(dx, dy)],
      });
    return [
      mkLine(-half, -half, 2 * half, 0),
      mkLine(half, -half, 0, 2 * half),
      mkLine(half, half, -2 * half, 0),
      mkLine(-half, half, 0, -2 * half),
    ] as NonDeletedExcalidrawElement[];
  };

  it("the owner-less fallback keeps expanding past an empty first radius", () => {
    // regression: an empty candidate set at the first radius used to return
    // no_owner immediately — a 2,000px square of open lines around the
    // click has all its strokes beyond the initial 512px box
    const { elements, elementsMap } = setup(lineSquare(1000));

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(0, 0),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(polygonArea(result.scenePoints)).toBeCloseTo(4_000_000, -5);
  });

  it("the owner-less fallback accepts a complete face touching the frontier", () => {
    // regression: all four lines fit the first 512px box, but the ring's
    // vertices at ±508 graze the frontier — with every eligible element
    // already in range the face is complete and must be accepted, not
    // rejected as possibly-unfinished
    const { elements, elementsMap } = setup(lineSquare(508));

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(0, 0),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(polygonArea(result.scenePoints)).toBeCloseTo(1016 * 1016, -4);
  });

  it("a fully invisible closed element cannot own a fill", () => {
    // regression: a rect with transparent stroke AND transparent background
    // renders no pixels — clicking the seemingly empty canvas used to
    // conjure a fill out of it
    const ghost = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      strokeColor: "transparent",
      backgroundColor: "transparent",
    });
    const { elements, elementsMap } = setup([ghost]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 50),
      elements,
      elementsMap,
    });

    expect(result).toEqual({ ok: false, reason: "no_owner" });
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

  it("fill-compatible paint never becomes the owner", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
    });
    // a strokeless bg polygon (what a generated fill is — no marker, fills
    // are recognized by shape) sitting ON TOP of the rect. Hachure, so it
    // exercises the ownership exclusion in isolation without also acting
    // as an opaque coverer that would clip the rect's coincident outline
    const priorFill = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
      polygon: true,
      backgroundColor: "#b2f2bb",
      fillStyle: "hachure",
      strokeColor: "transparent",
    });
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
    // owner is the rectangle, not the paint on top of it
    expect(result.ownerId).toBe(rect.id);
  });

  it("inserts below a visible non-contributor inside the region", () => {
    // a floating line inside the rect doesn't subdivide the region (its
    // dangling chain forms no face), so it isn't a contributor — but it's
    // visible, and an opaque fill above it would bury it
    const floating = API.createElement({
      type: "line",
      x: 30,
      y: 50,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(40, 0)],
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    // scene order: line lowest — the fill must slot in below it
    const { elements, elementsMap } = setup([floating, rect]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(10, 10),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.insertion).toEqual({
      placement: "below",
      elementId: floating.id,
    });
  });

  it("inserts below a text label inside the region", () => {
    const label = API.createElement({
      type: "text",
      x: 30,
      y: 40,
      text: "hi",
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    const { elements, elementsMap } = setup([label, rect]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(10, 10),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.insertion).toEqual({
      placement: "below",
      elementId: label.id,
    });
  });

  it("inserts above a covering non-participant (sub-region refill)", () => {
    // whole-rect fill exists; a line then subdivides the region and the top
    // half is filled anew — the new fill must go ABOVE the old opaque fill
    // (not below the participants, where the old fill would hide it)
    const oldFill = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
      polygon: true,
      backgroundColor: "#b2f2bb",
      fillStyle: "solid",
      strokeColor: "transparent",
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    const splitter = API.createElement({
      type: "line",
      x: -5,
      y: 50,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(110, 0)],
    });
    const { elements, elementsMap } = setup([oldFill, rect, splitter]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 25),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.insertion).toEqual({
      placement: "above",
      elementId: oldFill.id,
    });
  });

  it("an opaque prior fill hides strokes beneath it from new fills", () => {
    // the line crossing the rect would normally split it in two — but it
    // lies UNDER an opaque fill, so the user can't see it and it must not
    // stop the new fill either
    const buried = API.createElement({
      type: "line",
      x: -5,
      y: 50,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(110, 0)],
    });
    const priorFill = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
      polygon: true,
      backgroundColor: "#b2f2bb",
      fillStyle: "solid",
      strokeColor: "transparent",
    });
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    // realistic fill stacking: buried line lowest, fill above it, owner on top
    const { elements, elementsMap } = setup([buried, priorFill, rect]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(50, 25),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // the whole rect, not the top half the buried line would carve out
    expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -2);
    expect(result.boundaryElementIds).not.toContain(buried.id);
  });

  it("isRestylableFill accepts strokeless bg polygons covering the region", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    const { elements, elementsMap } = setup([rect]);
    const click = pointFrom<GlobalPoint>(50, 50);
    const result = computeBucketFillPolygon({
      point: click,
      elements,
      elementsMap,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const scenePoints = result.scenePoints;

    // NOTE deliberately no `customData.bucketFill` — restylability is
    // shape-based (the marker goes stale once the user restyles a fill)
    const mkFill = (size: number, overrides: object = {}) =>
      API.createElement({
        type: "line",
        x: 0,
        y: 0,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(size, 0),
          pointFrom<LocalPoint>(size, size),
          pointFrom<LocalPoint>(0, size),
          pointFrom<LocalPoint>(0, 0),
        ],
        polygon: true,
        backgroundColor: "#b2f2bb",
        fillStyle: "solid",
        strokeColor: "transparent",
        ...overrides,
      });

    // fill-like polygon covering the clicked region -> restylable
    const fill = mkFill(100);
    expect(
      isRestylableFill({
        hitElement: fill,
        scenePoints,
        elementsMap: setup([fill, rect]).elementsMap,
      }),
    ).toBe(true);

    // a fill the user gave a visible stroke has been repurposed into an
    // outline (it participates as a boundary instead) -> not restylable
    const stroked = mkFill(100, { strokeColor: "#1e1e1e" });
    expect(
      isRestylableFill({
        hitElement: stroked,
        scenePoints,
        elementsMap: setup([stroked, rect]).elementsMap,
      }),
    ).toBe(false);

    // covers a smaller region than the computed one -> not restylable
    const subRegion = mkFill(20);
    expect(
      isRestylableFill({
        hitElement: subRegion,
        scenePoints,
        elementsMap: setup([subRegion, rect]).elementsMap,
      }),
    ).toBe(false);

    // a plain shape is never restylable
    expect(
      isRestylableFill({
        hitElement: rect,
        scenePoints,
        elementsMap,
      }),
    ).toBe(false);
  });

  it("a fill given a visible stroke afterwards acts as a boundary", () => {
    const strokedFill = API.createElement({
      type: "line",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
      polygon: true,
      backgroundColor: "#b2f2bb",
      fillStyle: "solid",
      strokeColor: "#1e1e1e",
    });
    const outer = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      roundness: null,
      backgroundColor: "transparent",
    });
    const { elements, elementsMap } = setup([strokedFill, outer]);

    const annulus = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(25, 100),
      elements,
      elementsMap,
    });

    expect(annulus.ok).toBe(true);
    if (!annulus.ok) {
      return;
    }
    // the stroked fill is a visible outline now: it islands the region
    expect(polygonArea(annulus.scenePoints)).toBeCloseTo(30000, -2);
    expect(annulus.boundaryElementIds).toContain(strokedFill.id);

    // ...but a fill still never becomes an OWNER: clicking inside it falls
    // through to the rect while the fill's outline bounds the region
    const inside = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(100, 100),
      elements,
      elementsMap,
    });
    expect(inside.ok).toBe(true);
    if (!inside.ok) {
      return;
    }
    expect(inside.ownerId).toBe(outer.id);
    expect(polygonArea(inside.scenePoints)).toBeCloseTo(10000, -2);
  });

  it("fills a sparse freedraw along its rendered (smoothed) centerline", () => {
    // raw freedraw points can sit 20px+ apart; the renderer draws a
    // streamline-smoothed path between them, so the fill boundary must
    // sample that same path, not the raw chords (which visibly poke out)
    // prettier-ignore
    const CIRCLE_POINTS: [number, number][] = [[240,120],[238.18,140.84],[232.76,161.04],[223.92,180],[211.93,197.13],[197.13,211.93],[180,223.92],[161.04,232.76],[140.84,238.18],[120,240],[99.16,238.18],[78.96,232.76],[60,223.92],[42.87,211.93],[28.07,197.13],[16.08,180],[7.24,161.04],[1.82,140.84],[0,120],[1.82,99.16],[7.24,78.96],[16.08,60],[28.07,42.87],[42.87,28.07],[60,16.08],[78.96,7.24],[99.16,1.82],[120,0],[140.84,1.82],[161.04,7.24],[180,16.08],[197.13,28.07],[211.93,42.87],[223.92,60],[232.76,78.96],[238.18,99.16],[239.93,115.81]];
    const circle = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 240,
      height: 240,
      points: CIRCLE_POINTS.map((p) => pointFrom<LocalPoint>(p[0], p[1])),
    });
    const { elements, elementsMap } = setup([
      circle as NonDeletedExcalidrawElement,
    ]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(120, 120),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const distToPolyline = (p: GlobalPoint, poly: [number, number][]) => {
      let best = Infinity;
      for (let i = 0; i < poly.length - 1; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const l2 = dx * dx + dy * dy;
        const t = l2
          ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2))
          : 0;
        best = Math.min(
          best,
          Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)),
        );
      }
      return best;
    };
    const rawPolyline = [...CIRCLE_POINTS, CIRCLE_POINTS[0]];
    const smoothedPolyline = [
      ...getFreedrawStrokeCenterPoints(circle),
      CIRCLE_POINTS[0],
    ] as [number, number][];
    // every fill vertex lies ON the smoothed centerline (RDP only removes
    // vertices, it never moves them)...
    const deviationFromSmoothed = Math.max(
      ...result.scenePoints.map((v) => distToPolyline(v, smoothedPolyline)),
    );
    expect(deviationFromSmoothed).toBeLessThan(0.5);
    // ...and measurably OFF the raw polyline, proving the boundary follows
    // the rendered path rather than the raw chords
    const deviationFromRaw = Math.max(
      ...result.scenePoints.map((v) => distToPolyline(v, rawPolyline)),
    );
    expect(deviationFromRaw).toBeGreaterThan(1.5);
  });

  it("fills a freedraw whose closure only exists in the smoothed stroke", () => {
    // real-world repro: the raw ends sit ~21px apart and ~14px from the
    // rest of the raw path — but the RENDERED (smoothed) stroke passes
    // within ~3px of its own tail, which reads as visually closed and must
    // be bridgeable
    // prettier-ignore
    const BLOB_POINTS: [number, number][] = [[0,0],[0,-0.3],[0,-0.6],[-0.6,-0.6],[-2.1,-0.6],[-4.7,-0.6],[-7.9,-0.6],[-11.2,0.3],[-18.2,3.8],[-26.2,7.9],[-33.8,13.2],[-42.3,20.0],[-50.9,27.6],[-56.7,34.7],[-62.0,43.5],[-63.2,50.3],[-63.8,54.7],[-60.0,60.3],[-51.7,65.3],[-38.2,69.1],[-21.5,72.3],[-3.5,73.8],[16.5,75.0],[36.7,75.0],[66.7,75.0],[74.4,75.8],[76.1,75.8],[76.1,76.1],[75.6,76.7],[71.1,77.9],[59.7,80.5],[46.2,85.0],[33.5,89.1],[21.2,95.0],[12.6,101.1],[6.8,106.7],[4.4,112.6],[4.4,116.4],[5.6,119.9],[10.3,124.1],[18.8,127.3],[32.0,129.6],[47.3,131.7],[62.6,131.7],[80.5,131.7],[97.3,129.1],[114.4,126.4],[139.0,123.5],[147.0,122.0],[150.2,122.0],[152.9,121.7],[154.6,120.2],[155.8,118.5],[157.9,114.1],[162.0,104.9],[167.0,93.2],[172.3,81.4],[177.3,69.7],[181.4,60.6],[184.6,52.0],[186.4,46.2],[187.3,42.3],[187.8,39.7],[187.8,37.6],[187.8,36.2],[185.5,34.4],[181.1,32.0],[172.9,29.4],[158.7,25.0],[144.3,21.8],[128.2,19.1],[100.0,14.4],[90.8,13.2],[86.7,12.1],[85.8,11.5],[85.5,11.5],[85.5,11.2],[86.1,10.9],[87.6,9.7],[88.8,7.9],[89.4,6.5],[89.4,5.6],[89.4,4.4],[86.7,2.9],[81.4,1.5],[74.1,0.3],[62.6,-0.6],[50.9,-1.2],[42.0,-1.2],[31.7,-1.2],[23.2,-0.6],[17.1,0.6],[12.1,1.5],[9.7,2.1],[8.5,2.1],[7.9,2.1],[7.6,2.1],[7.3,2.1],[6.5,1.5],[4.7,0],[1.8,-1.2],[-1.5,-2.4],[-5.6,-2.9],[-10.0,-3.8],[-14.7,-4.1],[-17.6,-4.4],[-21.5,-5.3],[-23.8,-5.6],[-25.6,-5.9],[-26.8,-6.2],[-27.0,-6.2],[-27.3,-6.2],[-27.3,-5.3],[-27.3,-4.4],[-26.8,-2.9],[-25.9,-1.5],[-24.7,-0.3],[-24.1,0.3],[-23.2,1.2],[-22.6,1.5],[-22.0,1.8],[-21.8,2.1],[-21.5,2.1],[-21.5,2.1]];
    const blob = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 252,
      height: 138,
      points: BLOB_POINTS.map((p) => pointFrom<LocalPoint>(p[0], p[1])),
    });
    const { elements, elementsMap } = setup([
      blob as NonDeletedExcalidrawElement,
    ]);

    const result = computeBucketFillPolygon({
      point: pointFrom<GlobalPoint>(126, 69),
      elements,
      elementsMap,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(polygonArea(result.scenePoints)).toBeGreaterThan(15000);
  });

  describe("islands (holes)", () => {
    const rect = (x: number, y: number, size: number) =>
      API.createElement({
        type: "rectangle",
        x,
        y,
        width: size,
        height: size,
        roundness: null,
        backgroundColor: "transparent",
      });

    // NOTE: `polygonArea` (abs shoelace) doubles as the NET area for keyhole
    // rings — the zero-width bridges cancel and holes subtract

    /**
     * containment under the even-odd rule — the rule the renderer paints
     * looped-line fills with, so this asserts what actually shows on screen
     */
    const evenOddContains = (pts: GlobalPoint[], p: GlobalPoint): boolean =>
      polygonIncludesPoint(p, pts as unknown as Polygon<GlobalPoint>);

    it("punches a hole for an island inside the filled region", () => {
      const outer = rect(0, 0, 200);
      const inner = rect(50, 50, 100);
      const { elements, elementsMap } = setup([outer, inner]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(25, 100), // in the annulus
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      // annulus, not the whole outer interior (which would be ~40000)
      expect(polygonArea(result.scenePoints)).toBeCloseTo(30000, -2);
      expect(isClosed(result.scenePoints)).toBe(true);
      // the island bounds the fill too
      expect(result.boundaryElementIds).toContain(inner.id);
      // and participates in z-order: below the lowest participant
      expect(result.insertion).toEqual({
        placement: "below",
        elementId: outer.id,
      });
    });

    it("clicking inside the island still fills just the island", () => {
      const outer = rect(0, 0, 200);
      const inner = rect(50, 50, 100);
      const { elements, elementsMap } = setup([outer, inner]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(100, 100),
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.ownerId).toBe(inner.id);
      expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -2);
    });

    it("subtracts only outermost islands (island-in-island)", () => {
      const outer = rect(0, 0, 300);
      const middle = rect(50, 50, 200);
      const innermost = rect(100, 100, 100);
      const { elements, elementsMap } = setup([outer, middle, innermost]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(25, 150), // outer annulus
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      // outer minus middle; the innermost sits inside the hole and is
      // irrelevant to the clicked region
      expect(polygonArea(result.scenePoints)).toBeCloseTo(90000 - 40000, -2);
    });

    it("subtracts a subdivided island by its outside contour", () => {
      const outer = rect(0, 0, 200);
      const inner = rect(50, 50, 100);
      // line splitting the island into two faces — the island's footprint
      // must still be subtracted as ONE contour
      const splitter = API.createElement({
        type: "line",
        x: 50,
        y: 100,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      });
      const { elements, elementsMap } = setup([outer, inner, splitter]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(25, 100),
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(polygonArea(result.scenePoints)).toBeCloseTo(30000, -2);
    });

    it("an island connected to the boundary is not a hole", () => {
      const outer = rect(0, 0, 200);
      const inner = rect(50, 50, 100);
      // line connecting the island to the outer wall merges the components;
      // the click region becomes a C-shaped single face instead
      const connector = API.createElement({
        type: "line",
        x: 150,
        y: 100,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(50, 0)],
      });
      const { elements, elementsMap } = setup([outer, inner, connector]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(25, 100),
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      // same net region as the annulus, reached without any hole splicing
      expect(polygonArea(result.scenePoints)).toBeCloseTo(30000, -2);
    });

    it("an open line island does not punch a hole", () => {
      const owner = rect(0, 0, 100);
      const floating = API.createElement({
        type: "line",
        x: 30,
        y: 50,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(40, 0)],
      });
      const { elements, elementsMap } = setup([owner, floating]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(10, 10),
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(polygonArea(result.scenePoints)).toBeCloseTo(10000, -2);
    });

    it("punches multiple sibling islands", () => {
      const outer = rect(0, 0, 300);
      const a = rect(30, 30, 80);
      const b = rect(190, 190, 80);
      const { elements, elementsMap } = setup([outer, a, b]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(150, 20),
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(polygonArea(result.scenePoints)).toBeCloseTo(90000 - 2 * 6400, -2);
      expect(
        evenOddContains(result.scenePoints, pointFrom<GlobalPoint>(70, 70)),
      ).toBe(false);
      expect(
        evenOddContains(result.scenePoints, pointFrom<GlobalPoint>(230, 230)),
      ).toBe(false);
      expect(
        evenOddContains(result.scenePoints, pointFrom<GlobalPoint>(150, 150)),
      ).toBe(true);
    });

    it("overlapping islands punch their union regardless of element order", () => {
      // regression: bounded-vs-unbounded face orientation used to be
      // inferred from the largest |area| face, but the outermost outline's
      // interior and outside contour tie on |area|, making the outcome an
      // enumeration-order coin flip — overlapping islands then decomposed
      // into arbitrary sub-face "holes" (lenses filling, islands vanishing)
      const mkRect = (x: number, y: number) =>
        API.createElement({
          type: "rectangle",
          x,
          y,
          width: 120,
          height: 80,
          roundness: null,
          backgroundColor: "transparent",
        });
      const outer = rect(0, 0, 400);
      const a = mkRect(40, 100);
      const b = mkRect(140, 140);
      const c = mkRect(240, 100);

      for (const order of [
        [a, b, c, outer],
        [c, b, a, outer],
        [b, a, c, outer],
      ]) {
        const { elements, elementsMap } = setup(order);

        const result = computeBucketFillPolygon({
          point: pointFrom<GlobalPoint>(200, 30),
          elements,
          elementsMap,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
          return;
        }
        // outer minus the union: 3×(120×80) − two 20×40 lenses
        expect(polygonArea(result.scenePoints)).toBeCloseTo(
          160000 - (3 * 9600 - 2 * 800),
          -2,
        );
        // what renders (even-odd): every part of the union is unpainted —
        // the lenses, the single-rect parts — and the outer region is painted
        expect(
          evenOddContains(result.scenePoints, pointFrom<GlobalPoint>(150, 160)),
        ).toBe(false); // a∩b lens
        expect(
          evenOddContains(result.scenePoints, pointFrom<GlobalPoint>(80, 140)),
        ).toBe(false); // a only
        expect(
          evenOddContains(result.scenePoints, pointFrom<GlobalPoint>(200, 170)),
        ).toBe(false); // b only
        expect(
          evenOddContains(result.scenePoints, pointFrom<GlobalPoint>(200, 30)),
        ).toBe(true); // outer region
      }
    });

    it("inserts below the island when the island is lowest in z-order", () => {
      const inner = rect(50, 50, 100);
      const outer = rect(0, 0, 200);
      // island BELOW the outer shape in scene order: the fill must still go
      // below the island so its outline stays visible
      const { elements, elementsMap } = setup([inner, outer]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(25, 100),
        elements,
        elementsMap,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.insertion).toEqual({
        placement: "below",
        elementId: inner.id,
      });
    });

    it("a hole dropped for the point budget leaves boundaries but keeps z-order", () => {
      const inner = rect(50, 50, 100);
      const outer = rect(0, 0, 200);
      const { elements, elementsMap } = setup([inner, outer]);

      const result = computeBucketFillPolygon({
        point: pointFrom<GlobalPoint>(25, 100),
        elements,
        elementsMap,
        // the outer ring fits the cap, the hole does not
        options: { maxGeneratedPoints: 6 },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      // the fill paints through the dropped island...
      expect(polygonArea(result.scenePoints)).toBeCloseTo(40000, -2);
      // ...so it must NOT claim the island as a boundary...
      expect(result.boundaryElementIds).not.toContain(inner.id);
      // ...but still inserts below it, keeping the painted-over island
      // visible (deliberate: see the participant-set note in the source)
      expect(result.insertion).toEqual({
        placement: "below",
        elementId: inner.id,
      });
    });
  });
});
