import { pointsOnBezierCurves, simplify } from "points-on-curve";
import { curveToBezier } from "points-on-curve/lib/curve-to-bezier";

import {
  distanceToLineSegment,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointDistance,
  pointFrom,
  pointRotateRads,
  polygonIncludesPoint,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { isTransparent } from "@excalidraw/common";

import type { Bounds } from "@excalidraw/common";
import type {
  GlobalPoint,
  LineSegment,
  LocalPoint,
  Polygon,
} from "@excalidraw/math";

import {
  doBoundsIntersect,
  elementCenterPoint,
  getElementBounds,
  getElementLineSegments,
} from "./bounds";
import { intersectElementWithLineSegment, isPointInElement } from "./collision";
import { hasBackground } from "./comparisons";
import { getFreedrawStrokeCenterPoints } from "./shape";
import {
  isFreeDrawElement,
  isLinearElement,
  isLineElement,
  isValidPolygon,
} from "./typeChecks";
import { isPathALoop } from "./utils";

import type { Point } from "points-on-curve";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLineElement,
  NonDeletedExcalidrawElement,
} from "./types";

/**
 * Pure geometry helpers for the bucket fill tool.
 *
 * Given a click point and the scene elements, this computes the closed polygon
 * (in scene/global coordinates) that fills the enclosed region under the
 * pointer. The Excalidraw app layer converts the returned `scenePoints` into a
 * local `line` polygon and inserts it.
 *
 * All fills go through a single path: a planar segment arrangement is built
 * (segments split at intersections) and the smallest bounded face containing
 * the click is selected.
 *
 * The OWNER is the topmost closed, visible element containing the click
 * point — a shape, a closed (`polygon`) line, or a looped freedraw. It is
 * not the fill's boundary per se; it anchors the fast common case: only
 * elements near the owner's bounds feed the arrangement, and the app layer
 * inherits the fill's frame/group membership from it. When no owner exists
 * (regions formed by open lines, including against other elements' outside
 * walls), candidates come from an expanding search box around the click
 * instead — the owner-less fallback. Fill-compatible paint (see
 * `isBucketFillCompatible`) never becomes an owner: clicking it restyles
 * the existing paint (app layer) or re-derives the region from the actual
 * strokes around it.
 *
 * Islands (disconnected outlines fully inside the selected region) become
 * holes: their contours are spliced into the returned ring as zero-width
 * "keyhole" bridges, so the result stays a single closed polygon that
 * renders with unpainted hole interiors. Looped-line fills are painted with
 * the even-odd rule (roughjs uses it for solid polygon/curve fills and the
 * SVG export sets `fill-rule="evenodd"` explicitly; pattern fills use
 * scanline parity, which behaves the same) — the doubled bridge edges
 * cancel under it. Holes are nonetheless spliced with opposite winding, so
 * the path stays correct under the nonzero rule too.
 */

/**
 * How big a visual gap between strokes still counts as closed, in scene px.
 *
 * This is a BRIDGING radius, not a snapping radius: gaps are closed by
 * adding short connector edges between loose stroke ends (see the bridging
 * pass in `buildFaces`), never by relocating vertices — so a generous value
 * here does not distort the filled shape.
 */
const BUCKET_FILL_GAP_TOLERANCE = 6;

/**
 * How far apart, in scene px, two fill outlines' bounds may lie and still
 * count as the same region (see `findRestylableBucketFill`). Covers the
 * pipeline's own jitter — polygon simplification (~0.75px) and node
 * canonicalization (`snapEpsilon`) — while staying under typical stroke
 * widths, so "the same region" matches what the user sees.
 */
const BUCKET_FILL_REGION_MATCH_TOLERANCE = 2;

/**
 * Max deviation, in scene px, of a curved (`roundness`) line's sampled
 * boundary from its true rendered curve (see `lineElementIdealSegments`).
 * The fidelity knob for fills along curved lines: lower hugs the curve
 * tighter but feeds more segments into the arrangement — cost grows roughly
 * linearly with segment count.
 *
 * Note the final polygon is independently simplified at ~0.75px
 * (`finalizePolygon`), so values much below that add segments without
 * adding visible fidelity.
 */
const BUCKET_FILL_CURVE_MAX_DEVIATION = 0.5;

export type BucketFillOptions = {
  /**
   * geometric fidelity: vertices closer than this collapse to the same graph
   * node, and a node this close to a stroke splits it (T-junction). Keep
   * SMALL — every merge can relocate a vertex by up to this distance, so
   * this value is the upper bound on how far the filled shape may deviate
   * from the actual strokes.
   */
  snapEpsilon: number;
  /**
   * connectivity: loose stroke ends within this distance of another stroke
   * are bridged with a connector edge so the region reads as closed. Also
   * used as broad-phase padding around the owner bounds. Unlike
   * `snapEpsilon` this does not affect the shape's fidelity (bridges add
   * edges; they never move existing vertices).
   */
  gapTolerance: number;
  /** discard faces / polygons smaller than this absolute area */
  minArea: number;
  /** bail out with `too_complex` above this many input segments */
  maxBoundarySegments: number;
  /** cap on the number of generated polygon points */
  maxGeneratedPoints: number;
  /**
   * initial half-extent of the owner-less search box around the click
   * (doubles up to 3 times while the found face touches the box frontier)
   */
  fallbackSearchRadius: number;
};

export const DEFAULT_BUCKET_FILL_OPTIONS: BucketFillOptions = {
  snapEpsilon: 0.5,
  gapTolerance: BUCKET_FILL_GAP_TOLERANCE,
  minArea: 4,
  maxBoundarySegments: 2000,
  maxGeneratedPoints: 512,
  fallbackSearchRadius: 512,
};

export type BucketFillFailureReason =
  | "no_owner"
  | "open_region"
  | "too_complex"
  | "too_small"
  | "invalid_polygon";

/**
 * Where the generated fill element belongs in the scene order, expressed
 * relative to an existing element so the caller can resolve it against
 * whatever (e.g. deleted-inclusive) array it inserts into.
 */
export type BucketFillInsertion = {
  placement: "above" | "below";
  elementId: ExcalidrawElement["id"];
};

export type BucketFillGeometryResult =
  | {
      ok: true;
      /**
       * the closed element under the click, or null for fills resolved by
       * the owner-less fallback (regions formed by open lines)
       */
      ownerId: ExcalidrawElement["id"] | null;
      boundaryElementIds: ExcalidrawElement["id"][];
      /**
       * closed polygon ring in scene coordinates. When the region contains
       * islands, this is a keyhole path: the hole contours are spliced in
       * via zero-width bridges, so it still renders as one polygon with
       * unpainted hole interiors
       */
      scenePoints: GlobalPoint[];
      insertion: BucketFillInsertion;
    }
  | {
      ok: false;
      reason: BucketFillFailureReason;
    };

// -----------------------------------------------------------------------------
// small geometry helpers
// -----------------------------------------------------------------------------

const expandBounds = ([x1, y1, x2, y2]: Bounds, pad: number): Bounds => [
  x1 - pad,
  y1 - pad,
  x2 + pad,
  y2 + pad,
];

const segmentLength = (s: LineSegment<GlobalPoint>): number =>
  pointDistance(s[0], s[1]);

/** Standard shoelace signed area. Sign encodes ring orientation. */
const signedArea = (pts: GlobalPoint[]): number => {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return area / 2;
};

const ringBounds = (ring: readonly GlobalPoint[]): Bounds => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
};

/** Parametric position of `q` projected onto the line through a-b. */
const projectParam = (
  a: GlobalPoint,
  b: GlobalPoint,
  q: GlobalPoint,
): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return 0;
  }
  return ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / len2;
};

const perpendicularDistance = (
  p: GlobalPoint,
  a: GlobalPoint,
  b: GlobalPoint,
): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    return pointDistance(p, a);
  }
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
};

const pointAtParam = (a: GlobalPoint, b: GlobalPoint, t: number): GlobalPoint =>
  pointFrom<GlobalPoint>(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);

/** Remove the `cuts` parameter intervals from the `base` parameter intervals. */
const subtractIntervals = (
  base: [number, number][],
  cuts: [number, number][],
): [number, number][] => {
  let result = base;
  for (const [c0, c1] of cuts) {
    const next: [number, number][] = [];
    for (const [b0, b1] of result) {
      if (c1 <= b0 || c0 >= b1) {
        next.push([b0, b1]);
        continue;
      }
      if (c0 > b0) {
        next.push([b0, c0]);
      }
      if (c1 < b1) {
        next.push([c1, b1]);
      }
    }
    result = next;
  }
  return result;
};

/**
 * Boundary segments for a line element from its LOGICAL path (the element's
 * points), not its rough rendering.
 *
 * Rough rendering draws lines as two jittery passes; using those as
 * boundaries makes the fill hug the inner pass and leaves an unfilled
 * sliver between the passes. The logical path runs down the stroke's
 * centerline, so the fill straddles the sketchy stroke — exactly how
 * Excalidraw draws shape backgrounds (fill from the ideal path, rough
 * stroke on top). It also makes line endpoints genuine degree-1 graph
 * nodes, which is what the bridging pass keys on.
 *
 * Curved (`roundness`) lines deviate slightly at bends since the points are
 * the pre-smoothing polyline; the stroke width hides it.
 */
const lineElementIdealSegments = (
  element: ExcalidrawLineElement,
  elementsMap: ElementsMap,
): LineSegment<GlobalPoint>[] => {
  const center = elementCenterPoint(element, elementsMap);
  // curved (`roundness`) lines render a smooth curve fitted through the
  // points — sample that same fit (curveToBezier is what roughjs' curve op
  // uses) so the boundary follows what's actually on screen instead of
  // cutting corners along the raw polyline
  const localPoints =
    element.roundness && element.points.length > 2
      ? (pointsOnBezierCurves(
          curveToBezier(element.points as unknown as Point[]),
          // near-exact adaptive subdivision (the lib default); the sample
          // count is then bounded by the RDP pass below, which is the
          // actual fidelity knob
          0.15,
          BUCKET_FILL_CURVE_MAX_DEVIATION,
        ) as unknown as readonly LocalPoint[])
      : element.points;
  const points = localPoints.map((point) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
      center,
      element.angle,
    ),
  );
  const segments: LineSegment<GlobalPoint>[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(lineSegment(points[i], points[i + 1]));
  }
  return segments;
};

/**
 * Boundary segments for a freedraw element from its RENDERED centerline
 * (perfect-freehand's streamline-smoothed stroke points), not its raw
 * input points.
 *
 * Raw freedraw points can sit 20px+ apart and the renderer smooths the
 * path between them, so raw chords visibly deviate from the stroke on
 * screen: fills poke out at raw vertices, slivers open along sagging
 * chords, and closures that only exist in the smoothed path (the stroke
 * crossing itself near its start) are missed entirely.
 */
const freedrawIdealSegments = (
  element: ExcalidrawFreeDrawElement,
  elementsMap: ElementsMap,
): LineSegment<GlobalPoint>[] => {
  const center = elementCenterPoint(element, elementsMap);
  const points = getFreedrawStrokeCenterPoints(element).map((point) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
      center,
      element.angle,
    ),
  );
  const segments: LineSegment<GlobalPoint>[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(lineSegment(points[i], points[i + 1]));
  }
  return segments;
};

/**
 * Clip a segment to only its visible parts: the portions covered by an opaque
 * (non-transparent background) element above the segment's source are hidden
 * and removed. Returns the visible sub-segments (possibly empty).
 */
const clipSegmentToVisible = (
  a: GlobalPoint,
  b: GlobalPoint,
  coverers: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
  eps: number,
): [GlobalPoint, GlobalPoint][] => {
  let intervals: [number, number][] = [[0, 1]];
  for (const coverer of coverers) {
    if (intervals.length === 0) {
      break;
    }
    const hits = intersectElementWithLineSegment(
      coverer,
      elementsMap,
      lineSegment(a, b),
    );
    const breaks = [
      0,
      ...hits
        .map((p) => projectParam(a, b, p))
        .filter((t) => t > 0 && t < 1)
        .sort((x, y) => x - y),
      1,
    ];
    const covered: [number, number][] = [];
    for (let k = 0; k < breaks.length - 1; k++) {
      const t0 = breaks[k];
      const t1 = breaks[k + 1];
      if (t1 - t0 < 1e-9) {
        continue;
      }
      if (
        isPointInElement(
          pointAtParam(a, b, (t0 + t1) / 2),
          coverer,
          elementsMap,
        )
      ) {
        covered.push([t0, t1]);
      }
    }
    if (covered.length) {
      intervals = subtractIntervals(intervals, covered);
    }
  }
  return intervals
    .filter(
      ([t0, t1]) =>
        pointDistance(pointAtParam(a, b, t0), pointAtParam(a, b, t1)) >= eps,
    )
    .map(([t0, t1]) => [pointAtParam(a, b, t0), pointAtParam(a, b, t1)]);
};

/**
 * Spatial-hash node store that merges points within `eps` into one node so the
 * planar graph is free of near-duplicate vertices.
 */
class NodeStore {
  nodes: GlobalPoint[] = [];

  private cells = new Map<string, number[]>();

  private cellSize: number;

  constructor(private eps: number) {
    this.cellSize = Math.max(eps, 1);
  }

  private cellKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  getOrCreate(p: GlobalPoint): number {
    const cx = Math.floor(p[0] / this.cellSize);
    const cy = Math.floor(p[1] / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.cells.get(this.cellKey(cx + dx, cy + dy));
        if (bucket) {
          for (const idx of bucket) {
            if (pointDistance(this.nodes[idx], p) <= this.eps) {
              return idx;
            }
          }
        }
      }
    }
    const idx = this.nodes.length;
    this.nodes.push(p);
    const key = this.cellKey(cx, cy);
    const bucket = this.cells.get(key);
    if (bucket) {
      bucket.push(idx);
    } else {
      this.cells.set(key, [idx]);
    }
    return idx;
  }
}

// -----------------------------------------------------------------------------
// owner & boundary selection
// -----------------------------------------------------------------------------

/**
 * Whether the element visually paints an opaque background fill — i.e. can
 * actually hide outlines beneath it. Element types that never render their
 * `backgroundColor` (text, image, frames), see-through fill styles
 * (hachure/cross-hatch), partial opacity, and alpha colors all don't count.
 *
 * Shared with the app layer's z-order pass so "covers" means the same thing
 * in boundary clipping and in fill insertion.
 */
export const rendersOpaqueFill = (element: ExcalidrawElement): boolean => {
  if (
    !hasBackground(element.type) ||
    element.fillStyle !== "solid" ||
    element.opacity < 100 ||
    isTransparent(element.backgroundColor)
  ) {
    return false;
  }
  // open strokes never paint their background
  if (
    (isLineElement(element) || isFreeDrawElement(element)) &&
    !isPathALoop(element.points)
  ) {
    return false;
  }
  return true;
};

/**
 * Element types whose outlines can participate in a fill — as the owner
 * (when closed) and as boundaries. Text, image, embeddable, iframe and
 * arrows are excluded in v1.
 */
const FILL_BOUNDARY_TYPES = new Set<ExcalidrawElement["type"]>([
  "rectangle",
  "diamond",
  "ellipse",
  "frame",
  "magicframe",
  "line",
  "freedraw",
]);

/** fully invisible elements never participate in a fill */
const isInvisible = (element: ExcalidrawElement): boolean =>
  element.opacity <= 0;

/**
 * Whether the element renders any pixels at all: a visible stroke (doubles
 * as the text color for text elements), a background its type actually
 * paints, or image content.
 */
const rendersAnyMark = (element: ExcalidrawElement): boolean =>
  !isInvisible(element) &&
  (element.type === "image" ||
    !isTransparent(element.strokeColor) ||
    (hasBackground(element.type) && !isTransparent(element.backgroundColor)));

/**
 * Whether the element renders as pure paint the bucket tool could have
 * produced: a closed, visible line polygon with a background and no visible
 * stroke. Recognition is by SHAPE, not by a metadata marker — any marker
 * would go stale the moment the user restyles a fill, and a hand-drawn
 * strokeless background polygon is indistinguishable from a generated fill
 * anyway. Such paint never becomes an owner and is what the app layer
 * restyles in place on re-click (see `isRestylableFill`).
 */
export const isBucketFillCompatible = (
  element: ExcalidrawElement,
): element is ExcalidrawLineElement =>
  isLineElement(element) &&
  element.polygon &&
  isValidPolygon(element.points) &&
  !isInvisible(element) &&
  !isTransparent(element.backgroundColor) &&
  isTransparent(element.strokeColor);

const isClosedOwnerCandidate = (element: ExcalidrawElement): boolean => {
  if (!FILL_BOUNDARY_TYPES.has(element.type)) {
    return false;
  }
  if (isLineElement(element)) {
    return element.polygon && isValidPolygon(element.points);
  }
  if (isFreeDrawElement(element)) {
    return isPathALoop(element.points);
  }
  return true;
};

// Boundary and coverer roles are decided by VISIBILITY, not provenance:
// generated fills participate like any other element. In practice their
// default transparent stroke keeps them out of the boundary set — but once
// the user gives a fill a visible stroke, that outline genuinely bounds
// regions on screen and must bound new fills too.
const isEligibleBoundary = (element: ExcalidrawElement): boolean =>
  !isInvisible(element) &&
  FILL_BOUNDARY_TYPES.has(element.type) &&
  // skip outlines that don't render a visible stroke
  !isTransparent(element.strokeColor);

const findOwner = (
  point: GlobalPoint,
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
): NonDeletedExcalidrawElement | null => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    // fill-compatible paint is deliberately never an OWNER (unlike its
    // boundary / coverer roles): re-clicking a filled region should either
    // restyle the paint (app layer) or re-derive the region from the
    // actual strokes, not from the previous fill's ring — and keyhole
    // rings (zero-width bridges) make degenerate owner outlines.
    // Elements that render no pixels can't own either — an invisible
    // (transparent stroke + transparent background) shape would otherwise
    // let a click on seemingly empty canvas conjure a fill out of nowhere.
    if (!rendersAnyMark(element) || isBucketFillCompatible(element)) {
      continue;
    }
    if (!isClosedOwnerCandidate(element)) {
      continue;
    }
    if (isPointInElement(point, element, elementsMap)) {
      return element;
    }
  }
  return null;
};

// -----------------------------------------------------------------------------
// planar arrangement + face extraction
// -----------------------------------------------------------------------------

type WorkingSegment = {
  a: number;
  b: number;
  pa: GlobalPoint;
  pb: GlobalPoint;
  box: Bounds;
  elementId: string;
  splits: { node: number; t: number }[];
};

/** A segment paired with the element it was extracted from. */
type SourceSegment = {
  segment: LineSegment<GlobalPoint>;
  elementId: string;
};

/** An extracted face ring plus the ids of the elements whose outlines bound it. */
type Face = {
  ring: GlobalPoint[];
  contributors: Set<string>;
  /**
   * connected component of the arrangement graph this face belongs to —
   * faces of OTHER components lying inside a selected face are islands
   * (holes), while faces of the same component are just its subdivisions
   */
  componentId: number;
};

/**
 * Build the planar straight-line graph from the input segments (split at
 * intersections and T-junctions) and extract its face rings. Each face records
 * which source elements contributed an edge to its boundary.
 *
 * Returns `[]` when there are no usable edges (no enclosed region), or `null`
 * when the arrangement is too complex to process.
 *
 * Collinear/overlapping segments need no dedicated pass: a 1D overlap always
 * puts at least one segment's endpoint (a node) on the other segment, so the
 * T-junction pass splits them and `addEdge`'s node-pair dedupe collapses the
 * coincident pieces into one edge.
 */
const buildFaces = (
  rawSegments: SourceSegment[],
  options: BucketFillOptions,
): Face[] | null => {
  const eps = options.snapEpsilon;
  // Two distinct radii, deliberately decoupled:
  // - `eps` (snapEpsilon) governs node merging and T-junction snapping. It
  //   must stay small: merging RELOCATES vertices to the first-seen position
  //   and T-junctions route edges THROUGH off-stroke nodes, so this radius
  //   is the upper bound on how far the filled shape can deviate from the
  //   actual strokes.
  // - `gapTolerance` governs the bridging pass further down, which closes
  //   visual gaps by ADDING short connector edges at loose stroke ends. It
  //   can be generous (see BUCKET_FILL_GAP_TOLERANCE) without distorting
  //   the shape, because bridging never moves existing vertices.
  const store = new NodeStore(eps);
  const segments: WorkingSegment[] = [];
  // first element that produced each node — used to attribute bridge edges
  const nodeElement = new Map<number, string>();

  for (const { segment, elementId } of rawSegments) {
    // NOTE: sub-epsilon segments are NOT dropped here — their endpoints merge
    // into the same node (a === b below) which collapses them while keeping
    // the outline chain connected. Dropping them instead would disconnect
    // densely subdivided curves (e.g. the tiny corner arcs a diamond has even
    // with roundness: null) and leave the region open.
    const a = store.getOrCreate(segment[0]);
    const b = store.getOrCreate(segment[1]);
    if (!nodeElement.has(a)) {
      nodeElement.set(a, elementId);
    }
    if (!nodeElement.has(b)) {
      nodeElement.set(b, elementId);
    }
    if (a === b) {
      continue;
    }
    const pa = store.nodes[a];
    const pb = store.nodes[b];
    segments.push({
      a,
      b,
      pa,
      pb,
      elementId,
      box: [
        Math.min(pa[0], pb[0]),
        Math.min(pa[1], pb[1]),
        Math.max(pa[0], pb[0]),
        Math.max(pa[1], pb[1]),
      ],
      splits: [
        { node: a, t: 0 },
        { node: b, t: 1 },
      ],
    });
  }

  // transversal intersections. Broad phase: sort by bbox minX and sweep, so
  // each segment is only tested against x-overlapping ones (near-linear for
  // spread-out scenes instead of all-pairs)
  const byMinX = segments
    .map((_, index) => index)
    .sort((a, b) => segments[a].box[0] - segments[b].box[0]);
  for (let oi = 0; oi < byMinX.length; oi++) {
    const si = segments[byMinX[oi]];
    const li = lineSegment(si.pa, si.pb);
    const sweepMaxX = si.box[2] + eps;
    for (let oj = oi + 1; oj < byMinX.length; oj++) {
      const sj = segments[byMinX[oj]];
      if (sj.box[0] > sweepMaxX) {
        break;
      }
      if (!doBoundsIntersect(expandBounds(si.box, eps), sj.box)) {
        continue;
      }
      const intersection = lineSegmentIntersectionPoints(
        li,
        lineSegment(sj.pa, sj.pb),
        eps,
      );
      if (!intersection) {
        continue;
      }
      const node = store.getOrCreate(intersection);
      // intersection nodes need a source too — one may end up a loose end
      // (after visibility clipping) and get bridged, and bridge attribution
      // reads `nodeElement`
      if (!nodeElement.has(node)) {
        nodeElement.set(node, si.elementId);
      }
      si.splits.push({
        node,
        t: projectParam(si.pa, si.pb, store.nodes[node]),
      });
      sj.splits.push({
        node,
        t: projectParam(sj.pa, sj.pb, store.nodes[node]),
      });
    }
  }

  // safety: intersection splitting can inflate the node count quadratically
  // in pathological scenes; bail before the O(segments × nodes) T-junction
  // pass turns a click into a multi-second freeze
  if (store.nodes.length > options.maxBoundarySegments * 4) {
    return null;
  }

  // T-junctions: split any segment that passes through (within `eps` of) an
  // existing node. Deliberately tight — routing an edge through a node that
  // sits further off the stroke would visibly bend the filled shape; wider
  // gaps are closed by the bridging pass below instead.
  // Broad phase: nodes sorted by x (stable during this pass — no nodes are
  // created here), binary-searched per segment so only x-overlapping nodes
  // are inspected
  const nodesByX = store.nodes
    .map((_, index) => index)
    .sort((a, b) => store.nodes[a][0] - store.nodes[b][0]);
  for (const segment of segments) {
    const fromX = segment.box[0] - eps;
    const toX = segment.box[2] + eps;
    // lower bound of fromX in nodesByX
    let lo = 0;
    let hi = nodesByX.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (store.nodes[nodesByX[mid]][0] < fromX) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    for (let k = lo; k < nodesByX.length; k++) {
      const n = nodesByX[k];
      const q = store.nodes[n];
      if (q[0] > toX) {
        break;
      }
      if (n === segment.a || n === segment.b) {
        continue;
      }
      if (q[1] < segment.box[1] - eps || q[1] > segment.box[3] + eps) {
        continue;
      }
      const t = projectParam(segment.pa, segment.pb, q);
      if (t <= 0 || t >= 1) {
        continue;
      }
      if (
        distanceToLineSegment(q, lineSegment(segment.pa, segment.pb)) <= eps
      ) {
        segment.splits.push({ node: n, t });
      }
    }
  }

  // emit atomic edges
  const edgeSet = new Set<string>();
  const adjacency = new Map<number, number[]>();
  // atomic edge -> ids of the elements whose segments produced it
  const edgeToElements = new Map<string, Set<string>>();
  const edgeKey = (u: number, v: number) => (u < v ? `${u}-${v}` : `${v}-${u}`);
  const link = (u: number, v: number) => {
    const list = adjacency.get(u);
    if (list) {
      list.push(v);
    } else {
      adjacency.set(u, [v]);
    }
  };
  const addEdge = (u: number, v: number, elementId: string) => {
    if (u === v) {
      return;
    }
    if (pointDistance(store.nodes[u], store.nodes[v]) < eps) {
      return;
    }
    const key = edgeKey(u, v);
    const owners = edgeToElements.get(key);
    if (owners) {
      owners.add(elementId);
    } else {
      edgeToElements.set(key, new Set([elementId]));
    }
    if (edgeSet.has(key)) {
      return;
    }
    edgeSet.add(key);
    link(u, v);
    link(v, u);
  };

  for (const segment of segments) {
    const byNode = new Map<number, number>();
    for (const split of segment.splits) {
      if (!byNode.has(split.node)) {
        byNode.set(split.node, split.t);
      }
    }
    const ordered = [...byNode.entries()]
      .map(([node, t]) => ({ node, t }))
      .sort((a, b) => a.t - b.t);
    for (let k = 0; k < ordered.length - 1; k++) {
      addEdge(ordered[k].node, ordered[k + 1].node, segment.elementId);
    }
  }

  if (edgeSet.size === 0) {
    // nothing usable — not an error, just no enclosed region
    return [];
  }

  // ---------------------------------------------------------------------------
  // bridging pass — close visual gaps up to `gapTolerance` so sketchy joints
  // (a stroke stopping a few px short of another) still enclose a region.
  //
  // Additive by design: each dangling stroke end gets a short connector EDGE
  // to its nearest reachable geometry — either an existing node, or a point
  // ON a nearby edge (the edge is split at the projection, which lies
  // exactly on the stroke). Existing vertices are never relocated, so unlike
  // snapping, a generous radius here cannot distort the filled shape — the
  // worst artifact is a tiny connector edge spanning the visual gap,
  // typically hidden under the stroke width.
  //
  // A dangling end is simply a degree-1 node. This relies on boundaries
  // being single-pass paths: line elements use their logical points (see
  // `lineElementIdealSegments`), freedraw its smoothed centerline (see
  // `freedrawIdealSegments`), and closed shapes their ideal outlines —
  // none of them produce the rough renderer's double-pass geometry, whose
  // ends would be degree-2.
  // ---------------------------------------------------------------------------
  const bridgeRadius = Math.max(eps, options.gapTolerance);
  const isDanglingEnd = (node: number): boolean =>
    new Set(adjacency.get(node) ?? []).size === 1;
  const looseEnds: number[] = [];
  for (const node of adjacency.keys()) {
    if (isDanglingEnd(node)) {
      looseEnds.push(node);
    }
  }
  if (looseEnds.length > 0) {
    // live edge list; updated as bridging splits edges / adds connectors
    const liveEdges: { u: number; v: number }[] = [];
    for (const key of edgeSet) {
      const [u, v] = key.split("-").map(Number);
      liveEdges.push({ u, v });
    }
    const unlink = (u: number, v: number) => {
      const key = edgeKey(u, v);
      edgeSet.delete(key);
      const owners = edgeToElements.get(key);
      edgeToElements.delete(key);
      const listU = adjacency.get(u);
      const listV = adjacency.get(v);
      listU?.splice(listU.indexOf(v), 1);
      listV?.splice(listV.indexOf(u), 1);
      return owners;
    };

    for (const loose of looseEnds) {
      // skip ends already closed by an earlier bridge
      if (!isDanglingEnd(loose)) {
        continue;
      }
      const p = store.nodes[loose];
      const neighbours = adjacency.get(loose) ?? [];

      // nearest non-adjacent node within the bridge radius. Candidates
      // closer than the snap epsilon are skipped — they're effectively the
      // same point and `addEdge` refuses such degenerate edges anyway
      let bestNode = -1;
      let bestNodeDistance = Infinity;
      for (let n = 0; n < store.nodes.length; n++) {
        if (n === loose || neighbours.includes(n)) {
          continue;
        }
        const distance = pointDistance(p, store.nodes[n]);
        if (
          distance >= eps &&
          distance <= bridgeRadius &&
          distance < bestNodeDistance
        ) {
          bestNodeDistance = distance;
          bestNode = n;
        }
      }

      // nearest edge (not incident to the loose end) whose interior the
      // loose end projects onto, within the bridge radius
      let bestEdge: { u: number; v: number } | null = null;
      let bestEdgeDistance = Infinity;
      let bestEdgeT = 0;
      for (const edge of liveEdges) {
        if (
          !edgeSet.has(edgeKey(edge.u, edge.v)) ||
          edge.u === loose ||
          edge.v === loose
        ) {
          continue;
        }
        const eu = store.nodes[edge.u];
        const ev = store.nodes[edge.v];
        if (
          p[0] < Math.min(eu[0], ev[0]) - bridgeRadius ||
          p[0] > Math.max(eu[0], ev[0]) + bridgeRadius ||
          p[1] < Math.min(eu[1], ev[1]) - bridgeRadius ||
          p[1] > Math.max(eu[1], ev[1]) + bridgeRadius
        ) {
          continue;
        }
        const t = projectParam(eu, ev, p);
        if (t <= 0 || t >= 1) {
          continue;
        }
        const distance = distanceToLineSegment(p, lineSegment(eu, ev));
        if (distance <= bridgeRadius && distance < bestEdgeDistance) {
          bestEdgeDistance = distance;
          bestEdge = edge;
          bestEdgeT = t;
        }
      }

      const bridgeElement =
        // every node gets a source at creation; the fallback is defensive
        nodeElement.get(loose) ?? segments[0].elementId;
      if (bestEdge && bestEdgeDistance < bestNodeDistance) {
        // split the edge at the projection (a point ON the stroke) and
        // connect the loose end to it
        const eu = store.nodes[bestEdge.u];
        const ev = store.nodes[bestEdge.v];
        const projection = store.getOrCreate(pointAtParam(eu, ev, bestEdgeT));
        if (projection === bestEdge.u || projection === bestEdge.v) {
          // projection merged into an endpoint — plain node bridge
          addEdge(loose, projection, bridgeElement);
          liveEdges.push({ u: loose, v: projection });
        } else {
          if (!nodeElement.has(projection)) {
            nodeElement.set(
              projection,
              edgeToElements
                .get(edgeKey(bestEdge.u, bestEdge.v))
                ?.values()
                .next().value ?? bridgeElement,
            );
          }
          const owners =
            unlink(bestEdge.u, bestEdge.v) ?? new Set([bridgeElement]);
          for (const owner of owners) {
            addEdge(bestEdge.u, projection, owner);
            addEdge(projection, bestEdge.v, owner);
          }
          liveEdges.push(
            { u: bestEdge.u, v: projection },
            { u: projection, v: bestEdge.v },
          );
          addEdge(loose, projection, bridgeElement);
          liveEdges.push({ u: loose, v: projection });
        }
      } else if (bestNode >= 0) {
        addEdge(loose, bestNode, bridgeElement);
        liveEdges.push({ u: loose, v: bestNode });
      }
    }
  }

  // connected components of the final graph (bridges included, so a bridged
  // island shares a component with what it bridged to and can't become a
  // hole) — used to tell true islands from same-component subdivisions
  const componentOf = new Map<number, number>();
  let componentCount = 0;
  for (const start of adjacency.keys()) {
    if (componentOf.has(start)) {
      continue;
    }
    const queue = [start];
    componentOf.set(start, componentCount);
    while (queue.length) {
      const node = queue.pop()!;
      for (const neighbour of adjacency.get(node) ?? []) {
        if (!componentOf.has(neighbour)) {
          componentOf.set(neighbour, componentCount);
          queue.push(neighbour);
        }
      }
    }
    componentCount++;
  }

  // sort outgoing half-edges by angle around each node
  const angleOf = (from: number, to: number): number =>
    Math.atan2(
      store.nodes[to][1] - store.nodes[from][1],
      store.nodes[to][0] - store.nodes[from][0],
    );
  const sortedOut = new Map<number, number[]>();
  const positionOf = new Map<number, Map<number, number>>();
  for (const [node, neighbours] of adjacency) {
    const unique = Array.from(new Set(neighbours));
    unique.sort((p, q) => angleOf(node, p) - angleOf(node, q));
    sortedOut.set(node, unique);
    const positions = new Map<number, number>();
    unique.forEach((neighbour, index) => positions.set(neighbour, index));
    positionOf.set(node, positions);
  }

  // walk half-edges into face rings
  const visited = new Set<string>();
  const faces: Face[] = [];
  const maxSteps = edgeSet.size * 2 + 4;
  for (const [node, neighbours] of adjacency) {
    for (const first of neighbours) {
      if (visited.has(`${node}->${first}`)) {
        continue;
      }
      const ring: number[] = [];
      let from = node;
      let to = first;
      let steps = 0;
      while (steps++ <= maxSteps) {
        visited.add(`${from}->${to}`);
        ring.push(from);
        const outs = sortedOut.get(to)!;
        const twinPosition = positionOf.get(to)!.get(from)!;
        // the next edge in the face is the one immediately clockwise from the
        // reverse (twin) direction
        const nextPosition = (twinPosition - 1 + outs.length) % outs.length;
        const next = outs[nextPosition];
        from = to;
        to = next;
        if (from === node && to === first) {
          break;
        }
      }
      if (ring.length >= 3) {
        const contributors = new Set<string>();
        for (let k = 0; k < ring.length; k++) {
          const owners = edgeToElements.get(
            edgeKey(ring[k], ring[(k + 1) % ring.length]),
          );
          if (owners) {
            for (const id of owners) {
              contributors.add(id);
            }
          }
        }
        faces.push({
          ring: ring.map((index) => store.nodes[index]),
          contributors,
          componentId: componentOf.get(node) ?? -1,
        });
      }
    }
  }

  return faces;
};

type FaceSelection = {
  face: Face;
  /** island contours to punch out of the face — see `selectFaceFromArrangement` */
  holes: Face[];
};

/**
 * Select the smallest bounded face that contains the click point. The single
 * unbounded face has the largest absolute area; faces sharing its orientation
 * are skipped, which leaves only true (bounded) cells.
 *
 * Also collects the face's holes: each disconnected component has exactly one
 * outer-orientation ring (its outside contour), and when that contour lies
 * inside the selected face the component is an island the flood fill must
 * flow around. Only outermost islands count — an island nested inside
 * another island already sits inside a hole.
 */
const selectFaceFromArrangement = (
  faces: Face[],
  point: GlobalPoint,
  options: BucketFillOptions,
): FaceSelection | null => {
  if (faces.length === 0) {
    return null;
  }

  // The half-edge walk ("next = the neighbour immediately clockwise of the
  // twin", in screen coordinates with y pointing down) traces every BOUNDED
  // face with negative shoelace area and every component's outside contour
  // with positive area — a structural invariant of the walk rule. Bounded vs
  // unbounded must be decided by this sign alone, NOT by comparing areas:
  // the outermost outline's interior face and outside contour trace the same
  // polygon with equal |area|, so any size-based heuristic degenerates into
  // an enumeration-order coin flip (which made hole detection depend on
  // element order/position — see the overlapping-islands regression tests).
  const outerSign = 1;
  const areaOf = new Map<Face, number>();
  for (const face of faces) {
    areaOf.set(face, signedArea(face.ring));
  }

  let best: Face | null = null;
  let bestArea = Infinity;
  for (const face of faces) {
    const area = areaOf.get(face)!;
    if (Math.sign(area) === outerSign) {
      continue;
    }
    const absArea = Math.abs(area);
    if (absArea < options.minArea) {
      continue;
    }
    if (!polygonIncludesPointNonZero(point, face.ring)) {
      continue;
    }
    if (absArea < bestArea) {
      bestArea = absArea;
      best = face;
    }
  }

  if (!best) {
    return null;
  }
  const selected = best;

  const islandCandidates = faces.filter(
    (face) =>
      face.componentId !== selected.componentId &&
      // a component's outside contour shares the unbounded face's orientation
      Math.sign(areaOf.get(face)!) === outerSign &&
      Math.abs(areaOf.get(face)!) >= options.minArea &&
      // the click face never sits inside one of its own holes (defensive —
      // the smallest-containing-face selection above already guarantees it)
      !polygonIncludesPointNonZero(point, face.ring) &&
      // components never intersect (crossings would have merged them), so a
      // single-vertex test decides containment
      polygonIncludesPointNonZero(face.ring[0], selected.ring),
  );
  const holes = islandCandidates.filter(
    (hole) =>
      !islandCandidates.some(
        (other) =>
          other !== hole &&
          polygonIncludesPointNonZero(hole.ring[0], other.ring),
      ),
  );

  return { face: selected, holes };
};

// -----------------------------------------------------------------------------
// simplification
// -----------------------------------------------------------------------------

const dedupeConsecutive = (pts: GlobalPoint[], eps: number): GlobalPoint[] => {
  const out: GlobalPoint[] = [];
  for (const p of pts) {
    if (out.length === 0 || pointDistance(out[out.length - 1], p) >= eps) {
      out.push(p);
    }
  }
  while (out.length > 1 && pointDistance(out[0], out[out.length - 1]) < eps) {
    out.pop();
  }
  return out;
};

const removeCollinear = (
  pts: GlobalPoint[],
  tolerance: number,
): GlobalPoint[] => {
  if (pts.length <= 3) {
    return pts;
  }
  const out: GlobalPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = out[out.length - 1] ?? pts[pts.length - 1];
    const next = pts[(i + 1) % pts.length];
    if (perpendicularDistance(pts[i], prev, next) >= tolerance) {
      out.push(pts[i]);
    }
  }
  return out.length >= 3 ? out : pts;
};

/**
 * Simplify an open ring under a point budget. Returns null when it collapses
 * below a triangle or cannot fit the budget.
 */
const simplifyRing = (
  ring: GlobalPoint[],
  options: BucketFillOptions,
  budget: number,
): GlobalPoint[] | null => {
  const pts = dedupeConsecutive(ring, options.snapEpsilon);
  if (pts.length < 3) {
    return null;
  }

  // Ramer–Douglas–Peucker via the same `simplify` the freedraw renderer
  // uses (identical default tolerance), escalating until under the point cap
  let tolerance = 0.75;
  let simplified = simplify(pts, tolerance) as GlobalPoint[];
  while (simplified.length > budget && tolerance < 1e6) {
    tolerance *= 2;
    simplified = simplify(pts, tolerance) as GlobalPoint[];
  }
  if (simplified.length > budget) {
    return null;
  }

  simplified = removeCollinear(simplified, 0.05);
  return simplified.length >= 3 ? simplified : null;
};

/**
 * Splice a hole contour into the ring as a zero-width "keyhole": walk the
 * ring to the attachment vertex, bridge to the hole, traverse the hole, and
 * bridge back along the same edge. The doubled bridge cancels under the
 * even-odd rule the renderer uses for looped-line fills (and under the
 * pattern fills' scanline parity), leaving the hole interior unpainted
 * while the result stays one closed polygon.
 */
const spliceHoleIntoRing = (
  ring: GlobalPoint[],
  hole: GlobalPoint[],
): GlobalPoint[] => {
  // opposite winding: even-odd doesn't care, but this keeps the path
  // correct under the nonzero rule as well (defense against renderer or
  // export changes)
  const oriented =
    Math.sign(signedArea(hole)) === Math.sign(signedArea(ring))
      ? [...hole].reverse()
      : hole;

  // shortest bridge, so the (invisible) channel never spans the region
  let bestRingIndex = 0;
  let bestHoleIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < ring.length; i++) {
    for (let j = 0; j < oriented.length; j++) {
      const distance = pointDistance(ring[i], oriented[j]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestRingIndex = i;
        bestHoleIndex = j;
      }
    }
  }

  const out: GlobalPoint[] = ring.slice(0, bestRingIndex + 1);
  // full hole loop, ending back on its attachment vertex
  for (let k = 0; k <= oriented.length; k++) {
    out.push(oriented[(bestHoleIndex + k) % oriented.length]);
  }
  out.push(ring[bestRingIndex]);
  out.push(...ring.slice(bestRingIndex + 1));
  return out;
};

/**
 * Simplify the face ring and its hole contours (each independently, so the
 * keyhole bridges stay exactly zero-width), splice the holes in, and return
 * the result explicitly closed (first point repeated as last), along with
 * the indices of the holes that were actually spliced. Returns null when
 * the outer ring cannot form a valid polygon; holes that cannot fit the
 * remaining point budget are dropped (the island then just gets painted
 * over, the pre-hole-support behavior).
 */
const finalizePolygon = (
  outerRing: GlobalPoint[],
  holeRings: GlobalPoint[][],
  options: BucketFillOptions,
): { scenePoints: GlobalPoint[]; splicedHoleIndices: number[] } | null => {
  let ring = simplifyRing(outerRing, options, options.maxGeneratedPoints);
  if (!ring) {
    return null;
  }

  // largest first, so a tight point budget drops the least visible islands
  const byAreaDesc = holeRings
    .map((holeRing, index) => ({ holeRing, index }))
    .sort(
      (a, b) =>
        Math.abs(signedArea(b.holeRing)) - Math.abs(signedArea(a.holeRing)),
    );
  const splicedHoleIndices: number[] = [];
  for (const { holeRing, index } of byAreaDesc) {
    // a spliced hole costs its own points + 2 bridge duplicates
    const budget = options.maxGeneratedPoints - ring.length - 2;
    if (budget < 3) {
      break;
    }
    const hole = simplifyRing(holeRing, options, budget);
    if (!hole) {
      continue;
    }
    ring = spliceHoleIntoRing(ring, hole);
    splicedHoleIndices.push(index);
  }

  // close the polygon exactly once
  return { scenePoints: [...ring, ring[0]], splicedHoleIndices };
};

// -----------------------------------------------------------------------------
// public API
// -----------------------------------------------------------------------------

export const computeBucketFillPolygon = (args: {
  point: GlobalPoint;
  elements: readonly NonDeletedExcalidrawElement[];
  elementsMap: ElementsMap;
  options?: Partial<BucketFillOptions>;
}): BucketFillGeometryResult => {
  const options = { ...DEFAULT_BUCKET_FILL_OPTIONS, ...args.options };
  const { point, elements, elementsMap } = args;

  // 1. owner under the pointer — the fast common case (click inside a closed
  // element). When there is none (regions formed by open lines, or
  // self-intersecting outlines whose hit-test fails), the owner-less
  // fallback below builds the arrangement from everything near the click.
  const owner = findOwner(point, elements, elementsMap);

  const indexOf = new Map<string, number>();
  elements.forEach((element, i) => indexOf.set(element.id, i));

  // 2+3. collect boundary segments within `candidateBounds`, tagged with
  // their source element and clipped to their visible parts (portions hidden
  // behind an opaque element above are not boundaries — only what the user
  // actually sees can stop fill). Returns null when over the segment cap.
  const collectSegments = (
    candidateBounds: Bounds,
    primary: NonDeletedExcalidrawElement | null,
  ): SourceSegment[] | null => {
    const inRange = (element: ExcalidrawElement) =>
      doBoundsIntersect(
        candidateBounds,
        getElementBounds(element, elementsMap),
      );
    const boundaries = elements.filter(
      (element) =>
        element.id !== primary?.id &&
        isEligibleBoundary(element) &&
        inRange(element),
    );
    // the opaque elements that hide outlines beneath them — including
    // existing bucket fills: an outline buried under an opaque fill is
    // invisible, so it must not stop a new fill either
    const coverers = elements.filter(
      (element) => rendersOpaqueFill(element) && inRange(element),
    );

    const rawSegments: SourceSegment[] = [];
    const collect = (element: ExcalidrawElement) => {
      const elementIndex = indexOf.get(element.id) ?? 0;
      const coverersAbove = coverers.filter(
        (coverer) =>
          coverer.id !== element.id &&
          (indexOf.get(coverer.id) ?? 0) > elementIndex,
      );
      const segments = isLineElement(element)
        ? lineElementIdealSegments(element, elementsMap)
        : isFreeDrawElement(element)
        ? freedrawIdealSegments(element, elementsMap)
        : getElementLineSegments(element, elementsMap);
      // freedraw and non-polygon line loops render as closed once their
      // endpoints are within LINE_CONFIRM_THRESHOLD (isPathALoop), but their
      // segment chain leaves that closure gap open — bridge it explicitly so
      // the region reads as closed here too. Deliberately isPathALoop (the
      // renderer's own closure rule), NOT gapTolerance: whether an element
      // paints its background must match whether fill treats it as closed.
      if (
        (element.type === "freedraw" ||
          (isLineElement(element) && !element.polygon)) &&
        isPathALoop(element.points) &&
        segments.length > 0
      ) {
        const first = segments[0][0];
        const last = segments[segments.length - 1][1];
        if (pointDistance(first, last) >= options.snapEpsilon) {
          segments.push(lineSegment(last, first));
        }
      }
      for (const segment of segments) {
        // enforce the segment budget WHILE collecting: without this, a huge
        // scene does all the expensive visibility clipping before the cap
        // is ever consulted
        if (rawSegments.length > options.maxBoundarySegments) {
          return;
        }
        // keep sub-epsilon segments: buildFaces collapses them via node
        // merging without breaking the chain (see note there); only true
        // zero-length degenerates are noise
        if (segmentLength(segment) === 0) {
          continue;
        }
        if (coverersAbove.length === 0) {
          rawSegments.push({ segment, elementId: element.id });
          continue;
        }
        for (const [a, b] of clipSegmentToVisible(
          segment[0],
          segment[1],
          coverersAbove,
          elementsMap,
          options.snapEpsilon,
        )) {
          rawSegments.push({
            segment: lineSegment(a, b),
            elementId: element.id,
          });
        }
      }
    };
    for (const element of primary ? [primary, ...boundaries] : boundaries) {
      if (rawSegments.length > options.maxBoundarySegments) {
        break;
      }
      collect(element);
    }
    return rawSegments.length > options.maxBoundarySegments
      ? null
      : rawSegments;
  };

  const buildAndSelect = (
    rawSegments: SourceSegment[],
  ): FaceSelection | null | "too_complex" => {
    const faces = buildFaces(rawSegments, options);
    if (!faces) {
      return "too_complex";
    }
    return selectFaceFromArrangement(faces, point, options);
  };

  // 4. resolve the face under the click
  let selection: FaceSelection | null = null;
  if (owner) {
    const pad = options.gapTolerance + 2 + Math.max(owner.strokeWidth ?? 1, 1);
    const searchBounds = expandBounds(
      getElementBounds(owner, elementsMap),
      pad,
    );
    const rawSegments = collectSegments(searchBounds, owner);
    if (!rawSegments) {
      return { ok: false, reason: "too_complex" };
    }
    const selected = buildAndSelect(rawSegments);
    if (selected === "too_complex") {
      return { ok: false, reason: "too_complex" };
    }
    if (!selected) {
      return { ok: false, reason: "open_region" };
    }
    selection = selected;
  } else {
    // owner-less fallback: search an expanding box around the click. A face
    // is final once its ring stays clear of the box frontier — any element
    // that could still subdivide it would intersect the box and is already
    // included; a ring touching the frontier may be missing far-away
    // boundaries, so grow and retry.
    const totalEligible = elements.reduce(
      (count, element) => count + (isEligibleBoundary(element) ? 1 : 0),
      0,
    );
    if (totalEligible === 0) {
      return { ok: false, reason: "no_owner" };
    }
    let radius = options.fallbackSearchRadius;
    for (let attempt = 0; attempt < 4 && !selection; attempt++, radius *= 2) {
      const box: Bounds = [
        point[0] - radius,
        point[1] - radius,
        point[0] + radius,
        point[1] + radius,
      ];
      const inRange = elements.reduce(
        (count, element) =>
          count +
          (isEligibleBoundary(element) &&
          doBoundsIntersect(box, getElementBounds(element, elementsMap))
            ? 1
            : 0),
        0,
      );
      // every eligible element is in range: whatever this box yields is
      // FINAL — a bigger box would rebuild the identical arrangement, and
      // the frontier heuristic below only exists to approximate exactly
      // this condition
      const isFinalAttempt = attempt === 3 || inRange === totalEligible;
      if (inRange === 0) {
        // empty at this radius — the region may still lie farther out, so
        // keep growing (a distant enclosure, e.g. a huge line square whose
        // strokes are all beyond the first box)
        continue;
      }
      const rawSegments = collectSegments(box, null);
      // the fallback is speculative — never toast on its failures. Over the
      // segment cap counts as a failure, not a "too complex" complaint.
      if (!rawSegments) {
        return { ok: false, reason: "no_owner" };
      }
      const selected = buildAndSelect(rawSegments);
      if (selected === "too_complex") {
        return { ok: false, reason: "no_owner" };
      }
      if (
        selected &&
        (isFinalAttempt ||
          selected.face.ring.every(
            (p) =>
              p[0] > box[0] + options.gapTolerance &&
              p[1] > box[1] + options.gapTolerance &&
              p[0] < box[2] - options.gapTolerance &&
              p[1] < box[3] - options.gapTolerance,
          ))
      ) {
        selection = selected;
      }
      if (!selection && isFinalAttempt) {
        // nothing more can enter range — no point burning further builds
        break;
      }
    }
    if (!selection) {
      // no enclosed region under the pointer — stay silent like `no_owner`;
      // clicking open canvas shouldn't nag
      return { ok: false, reason: "no_owner" };
    }
  }
  const { face, holes } = selection;

  // 5. simplify and validate. Note the returned ring may be a keyhole path
  // (holes spliced in via zero-width bridges); its signed area is then the
  // NET filled area, which is exactly what the size check should measure.
  const finalized = finalizePolygon(
    face.ring,
    holes.map((hole) => hole.ring),
    options,
  );
  if (!finalized) {
    return { ok: false, reason: "invalid_polygon" };
  }
  const { scenePoints, splicedHoleIndices } = finalized;
  if (Math.abs(signedArea(scenePoints)) < options.minArea) {
    return { ok: false, reason: "too_small" };
  }

  // spliced islands genuinely bound the visible fill, so they join the
  // boundary metadata (and, via the app layer, group inheritance)
  const contributors = new Set<string>(face.contributors);
  for (const index of splicedHoleIndices) {
    for (const id of holes[index].contributors) {
      contributors.add(id);
    }
  }

  // 6. z-order. Two constraints, applied over ALL scene elements (not just
  // the region's participants):
  //
  // - the fill goes ABOVE the topmost opaque element containing the click
  //   (same "covers" predicate boundary clipping uses) — anything whose
  //   opaque background would otherwise hide the fill;
  // - otherwise it goes BELOW the lowest element that must stay visible:
  //   every participant (their outlines border the fill; deliberately
  //   including islands whose hole was dropped for the point budget — the
  //   fill paints straight through those, so staying below them is what
  //   keeps them visible at all), plus any visible NON-participant whose
  //   mark lies inside the region (a floating line, a label, an icon — an
  //   opaque fill would bury them). A visible stroke merely CROSSING the
  //   region would have subdivided the face and be a participant already,
  //   so sampling the element center + path points is enough to catch the
  //   wholly-inside marks that remain. The even-odd containment matches
  //   the render rule, so elements inside a keyhole hole are correctly NOT
  //   constrained (the fill doesn't paint there).
  //
  // When both constraints apply, above-the-coverer wins: anything below
  // the coverer is hidden by it anyway, so placing the fill above changes
  // nothing the user can see.
  const participantIds = new Set<string>(
    owner ? [owner.id, ...contributors] : contributors,
  );
  for (const hole of holes) {
    for (const id of hole.contributors) {
      participantIds.add(id);
    }
  }

  const fillRegion = scenePoints as unknown as Polygon<GlobalPoint>;
  const [regionMinX, regionMinY, regionMaxX, regionMaxY] =
    ringBounds(scenePoints);
  const markInsideRegion = (element: ExcalidrawElement): boolean => {
    const [minX, minY, maxX, maxY] = getElementBounds(element, elementsMap);
    if (
      maxX < regionMinX ||
      minX > regionMaxX ||
      maxY < regionMinY ||
      minY > regionMaxY
    ) {
      return false;
    }
    const samples: GlobalPoint[] = [
      pointFrom<GlobalPoint>((minX + maxX) / 2, (minY + maxY) / 2),
    ];
    if (isLinearElement(element) || isFreeDrawElement(element)) {
      const center = elementCenterPoint(element, elementsMap);
      const step = Math.max(1, Math.floor(element.points.length / 8));
      for (let i = 0; i < element.points.length; i += step) {
        samples.push(
          pointRotateRads(
            pointFrom<GlobalPoint>(
              element.x + element.points[i][0],
              element.y + element.points[i][1],
            ),
            center,
            element.angle,
          ),
        );
      }
    }
    return samples.some((sample) => polygonIncludesPoint(sample, fillRegion));
  };

  let lowestAbove: ExcalidrawElement | null = null;
  let covering: ExcalidrawElement | null = null;
  for (const element of elements) {
    const mustStayAbove =
      participantIds.has(element.id) ||
      (rendersAnyMark(element) && markInsideRegion(element));
    if (!mustStayAbove) {
      continue;
    }
    lowestAbove = lowestAbove ?? element;
    if (
      rendersOpaqueFill(element) &&
      isPointInElement(point, element, elementsMap)
    ) {
      covering = element;
    }
  }
  // a face always has contributors from `elements`, so a participant exists;
  // the last-element fallback is defensive only
  const insertion: BucketFillInsertion = covering
    ? { placement: "above", elementId: covering.id }
    : {
        placement: "below",
        elementId: (lowestAbove ?? elements[elements.length - 1]).id,
      };

  return {
    ok: true,
    ownerId: owner?.id ?? null,
    // elements (other than the owner) whose outlines actually bound the fill
    boundaryElementIds: [...contributors].filter((id) => id !== owner?.id),
    scenePoints,
    insertion,
  };
};

/**
 * Whether the element the click landed on is a fill the bucket tool should
 * restyle in place (instead of stacking an identical fill on top), given
 * the computed region.
 *
 * Fill-compatibility is decided by shape (`isBucketFillCompatible`): a fill
 * the user gave a stroke to has been repurposed into an outline and
 * participates as a boundary instead of being restyled.
 *
 * One guard on top: the computed region's net area and bounds must match
 * the element's. Without it, a click inside a shape drawn ON TOP of a
 * filled region would recolor the underlying fill instead of filling that
 * shape; a click on a since-subdivided part of an old fill likewise
 * creates a new (smaller) fill rather than restyling the old one.
 */
export const isRestylableFill = (args: {
  hitElement: ExcalidrawElement;
  scenePoints: readonly GlobalPoint[];
  elementsMap: ElementsMap;
}): boolean => {
  const { hitElement, scenePoints, elementsMap } = args;
  if (!isBucketFillCompatible(hitElement)) {
    return false;
  }

  const center = elementCenterPoint(hitElement, elementsMap);
  const ring = hitElement.points.map((p) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(hitElement.x + p[0], hitElement.y + p[1]),
      center,
      hitElement.angle,
    ),
  );
  // same region? net areas (keyhole bridges cancel) and bounds must agree
  const fillArea = Math.abs(signedArea(ring));
  const regionArea = Math.abs(signedArea(scenePoints as GlobalPoint[]));
  const sameArea =
    Math.abs(fillArea - regionArea) <= 0.05 * Math.max(fillArea, regionArea);
  const [aMinX, aMinY, aMaxX, aMaxY] = ringBounds(ring);
  const [bMinX, bMinY, bMaxX, bMaxY] = ringBounds(scenePoints);
  const tolerance = BUCKET_FILL_REGION_MATCH_TOLERANCE;
  const sameBounds =
    Math.abs(aMinX - bMinX) <= tolerance &&
    Math.abs(aMinY - bMinY) <= tolerance &&
    Math.abs(aMaxX - bMaxX) <= tolerance &&
    Math.abs(aMaxY - bMaxY) <= tolerance;

  return sameArea && sameBounds;
};
