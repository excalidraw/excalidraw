import { simplify } from "points-on-curve";

import {
  distanceToLineSegment,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointDistance,
  pointFrom,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { isTransparent } from "@excalidraw/common";

import type { Bounds } from "@excalidraw/common";
import type { GlobalPoint, LineSegment } from "@excalidraw/math";

import {
  doBoundsIntersect,
  getElementBounds,
  getElementLineSegments,
} from "./bounds";
import { intersectElementWithLineSegment, isPointInElement } from "./collision";
import { hasBackground } from "./comparisons";
import { isFreeDrawElement, isLineElement, isValidPolygon } from "./typeChecks";
import { isPathALoop } from "./utils";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./types";

/**
 * Pure geometry for the bucket fill tool. No React, no app state, no DOM.
 *
 * Given a click point and the scene elements, this computes the closed polygon
 * (in scene/global coordinates) that fills the enclosed region under the
 * pointer. The Excalidraw app layer converts the returned `scenePoints` into a
 * local `line` polygon and inserts it.
 *
 * All fills go through a single path: a planar segment arrangement is built
 * (segments split at intersections) and the smallest bounded face containing
 * the click is selected. Candidates come from the owner's surroundings when
 * the click lands inside a closed element, or — for regions formed by open
 * lines, including against other elements' outside walls — from an expanding
 * search box around the click (owner-less fallback).
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
  maxGeneratedPoints: 256,
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

const isBucketFill = (element: ExcalidrawElement): boolean =>
  !!element.customData?.bucketFill;

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

/** invisible or generated elements never participate in a fill */
const isExcludedFromFill = (element: ExcalidrawElement): boolean =>
  element.opacity <= 0 || isBucketFill(element);

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

const isEligibleBoundary = (element: ExcalidrawElement): boolean =>
  !isExcludedFromFill(element) &&
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
    if (isExcludedFromFill(element)) {
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
  //   can be generous (8px) without distorting the shape, because bridging
  //   never moves existing vertices.
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
  // "Dangling end" is a ONE-SIDED node, not just a degree-1 node: rough
  // rendering draws strokes as two jittery passes, so a stroke END is a node
  // whose (two) incident edges both leave in nearly the same direction.
  // Formally: all incident edge directions fit inside a narrow cone, i.e.
  // the largest angular gap between them exceeds 225°. Interior chain nodes
  // (~180° apart) and genuine crossings (edges all around) don't qualify;
  // sharp corners (~270° gap) do, which is desirable — a corner sitting a
  // few px from another stroke is exactly the kind of sketchy joint to
  // close.
  // ---------------------------------------------------------------------------
  const bridgeRadius = Math.max(eps, options.gapTolerance);
  const DANGLING_END_MIN_GAP = (Math.PI * 5) / 4; // 225°
  const isDanglingEnd = (node: number): boolean => {
    const unique = [...new Set(adjacency.get(node) ?? [])];
    if (unique.length === 0) {
      return false;
    }
    if (unique.length === 1) {
      return true;
    }
    // more than 4 distinct directions is a busy junction, never a stroke end
    if (unique.length > 4) {
      return false;
    }
    const angles = unique
      .map((neighbour) =>
        Math.atan2(
          store.nodes[neighbour][1] - store.nodes[node][1],
          store.nodes[neighbour][0] - store.nodes[node][0],
        ),
      )
      .sort((a, b) => a - b);
    let maxGap = angles[0] + Math.PI * 2 - angles[angles.length - 1];
    for (let i = 1; i < angles.length; i++) {
      maxGap = Math.max(maxGap, angles[i] - angles[i - 1]);
    }
    return maxGap > DANGLING_END_MIN_GAP;
  };
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

    // a single sweep can spend an end's bridge on a useless nearby target
    // (e.g. the unmerged twin endpoint of a rough double-pass stroke); such
    // an end usually remains one-sided, so iterate to a fixed point
    for (let round = 0; round < 3; round++) {
      let bridgedAny = false;
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
          nodeElement.get(loose) ?? segments[0]?.elementId ?? "";
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
          bridgedAny = true;
        } else if (bestNode >= 0) {
          addEdge(loose, bestNode, bridgeElement);
          liveEdges.push({ u: loose, v: bestNode });
          bridgedAny = true;
        }
      }
      if (!bridgedAny) {
        break;
      }
    }
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
        });
      }
    }
  }

  return faces;
};

/**
 * Select the smallest bounded face that contains the click point. The single
 * unbounded face has the largest absolute area; faces sharing its orientation
 * are skipped, which leaves only true (bounded) cells.
 */
const selectFaceFromArrangement = (
  faces: Face[],
  point: GlobalPoint,
  options: BucketFillOptions,
): Face | null => {
  if (faces.length === 0) {
    return null;
  }

  let outerSign = 0;
  let maxAbsArea = -1;
  for (const face of faces) {
    const area = signedArea(face.ring);
    if (Math.abs(area) > maxAbsArea) {
      maxAbsArea = Math.abs(area);
      outerSign = Math.sign(area);
    }
  }

  let best: Face | null = null;
  let bestArea = Infinity;
  for (const face of faces) {
    const area = signedArea(face.ring);
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

  return best;
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
 * Simplify a ring of points and return it explicitly closed (first point
 * repeated as last). Returns null when it cannot form a valid polygon.
 */
const finalizePolygon = (
  ring: GlobalPoint[],
  options: BucketFillOptions,
): GlobalPoint[] | null => {
  const pts = dedupeConsecutive(ring, options.snapEpsilon);
  if (pts.length < 3) {
    return null;
  }

  // Ramer–Douglas–Peucker via the same `simplify` the freedraw renderer
  // uses (identical default tolerance), escalating until under the point cap
  let tolerance = 0.75;
  let simplified = simplify(pts, tolerance) as GlobalPoint[];
  while (simplified.length > options.maxGeneratedPoints && tolerance < 1e6) {
    tolerance *= 2;
    simplified = simplify(pts, tolerance) as GlobalPoint[];
  }
  if (simplified.length > options.maxGeneratedPoints) {
    return null;
  }

  simplified = removeCollinear(simplified, 0.05);
  if (simplified.length < 3) {
    return null;
  }

  // close the polygon exactly once
  return [...simplified, simplified[0]];
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
    // the opaque elements that hide outlines beneath them
    const coverers = elements.filter(
      (element) =>
        !isBucketFill(element) &&
        rendersOpaqueFill(element) &&
        inRange(element),
    );

    const rawSegments: SourceSegment[] = [];
    const collect = (element: ExcalidrawElement) => {
      const elementIndex = indexOf.get(element.id) ?? 0;
      const coverersAbove = coverers.filter(
        (coverer) =>
          coverer.id !== element.id &&
          (indexOf.get(coverer.id) ?? 0) > elementIndex,
      );
      const segments = getElementLineSegments(element, elementsMap);
      // freedraw and non-polygon line loops render as closed once their
      // endpoints are within LINE_CONFIRM_THRESHOLD (isPathALoop), but their
      // segment chain leaves that closure gap open — bridge it explicitly so
      // the region reads as closed here too
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
    if (primary) {
      collect(primary);
    }
    for (const element of boundaries) {
      collect(element);
    }
    return rawSegments.length > options.maxBoundarySegments
      ? null
      : rawSegments;
  };

  const buildAndSelect = (
    rawSegments: SourceSegment[],
  ): Face | null | "too_complex" => {
    const faces = buildFaces(rawSegments, options);
    if (!faces) {
      return "too_complex";
    }
    return selectFaceFromArrangement(faces, point, options);
  };

  // 4. resolve the face under the click
  let face: Face | null = null;
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
    face = selected;
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
    let radius = options.fallbackSearchRadius;
    for (let attempt = 0; attempt < 4 && !face; attempt++, radius *= 2) {
      const box: Bounds = [
        point[0] - radius,
        point[1] - radius,
        point[0] + radius,
        point[1] + radius,
      ];
      const rawSegments = collectSegments(box, null);
      // the fallback is speculative — never toast on its failures. Over the
      // segment cap counts as a failure, not a "too complex" complaint.
      if (!rawSegments || rawSegments.length === 0) {
        return { ok: false, reason: "no_owner" };
      }
      const selected = buildAndSelect(rawSegments);
      if (selected === "too_complex") {
        return { ok: false, reason: "no_owner" };
      }
      const isLastAttempt = attempt === 3;
      if (
        selected &&
        (isLastAttempt ||
          selected.ring.every(
            (p) =>
              p[0] > box[0] + options.gapTolerance &&
              p[1] > box[1] + options.gapTolerance &&
              p[0] < box[2] - options.gapTolerance &&
              p[1] < box[3] - options.gapTolerance,
          ))
      ) {
        face = selected;
      }
      // growing only helps when it brings NEW elements into range; if every
      // eligible boundary in the scene is already a candidate, a bigger box
      // rebuilds the identical arrangement — bail out instead of burning up
      // to 3 more full builds on a miss
      if (!face) {
        const inRange = elements.reduce(
          (count, element) =>
            count +
            (isEligibleBoundary(element) &&
            doBoundsIntersect(box, getElementBounds(element, elementsMap))
              ? 1
              : 0),
          0,
        );
        if (inRange === totalEligible) {
          break;
        }
      }
    }
    if (!face) {
      // no enclosed region under the pointer — stay silent like `no_owner`;
      // clicking open canvas shouldn't nag
      return { ok: false, reason: "no_owner" };
    }
  }
  const { ring, contributors } = face;

  // 5. simplify and validate
  const scenePoints = finalizePolygon(ring, options);
  if (!scenePoints) {
    return { ok: false, reason: "invalid_polygon" };
  }
  if (Math.abs(signedArea(scenePoints)) < options.minArea) {
    return { ok: false, reason: "too_small" };
  }

  // 6. z-order: the fill should sit above any participating element whose
  // opaque background would otherwise render over (hide) it, but below
  // participants that only contribute an outline, so their borders stay
  // visible. A participant "covers" the fill when it paints an opaque
  // background (same predicate boundary clipping uses) and the filled
  // region lies inside it (the click lands inside).
  const participantIds = new Set<string>(
    owner ? [owner.id, ...contributors] : contributors,
  );
  let lowestParticipant: ExcalidrawElement | null = null;
  let covering: ExcalidrawElement | null = null;
  for (const element of elements) {
    if (!participantIds.has(element.id)) {
      continue;
    }
    lowestParticipant = lowestParticipant ?? element;
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
        elementId: (lowestParticipant ?? elements[elements.length - 1]).id,
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
