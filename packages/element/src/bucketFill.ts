import {
  lineSegment,
  lineSegmentIntersectionPoints,
  pointDistance,
  pointFrom,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";
import type { GlobalPoint, LineSegment } from "@excalidraw/math";

import {
  doBoundsIntersect,
  getElementBounds,
  getElementLineSegments,
} from "./bounds";
import { intersectElementWithLineSegment, isPointInElement } from "./collision";
import { isLineElement, isValidPolygon } from "./typeChecks";
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
 * Two paths:
 * - owner-only (v1): when nothing overlaps the owner, the owner outline is
 *   chained into a single ring directly (robust, no arrangement needed).
 * - overlap-aware: when other boundary elements overlap the owner, a planar
 *   segment arrangement is built (segments split at intersections) and the
 *   smallest bounded face containing the click is selected.
 */

export type BucketFillOptions = {
  /** endpoints closer than this collapse to the same graph node */
  snapEpsilon: number;
  /** broad-phase padding around the owner bounds */
  gapTolerance: number;
  /** discard faces / polygons smaller than this absolute area */
  minArea: number;
  /** bail out with `too_complex` above this many input segments */
  maxBoundarySegments: number;
  /** cap on the number of generated polygon points */
  maxGeneratedPoints: number;
};

export const DEFAULT_BUCKET_FILL_OPTIONS: BucketFillOptions = {
  snapEpsilon: 0.5,
  gapTolerance: 2,
  minArea: 4,
  maxBoundarySegments: 2000,
  maxGeneratedPoints: 256,
};

export type BucketFillFailureReason =
  | "no_owner"
  | "open_region"
  | "too_complex"
  | "too_small"
  | "invalid_polygon";

export type BucketFillGeometryResult =
  | {
      ok: true;
      ownerId: ExcalidrawElement["id"];
      boundaryElementIds: ExcalidrawElement["id"][];
      scenePoints: GlobalPoint[];
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

const distanceToSegment = (
  q: GlobalPoint,
  a: GlobalPoint,
  b: GlobalPoint,
): number => {
  const t = Math.max(0, Math.min(1, projectParam(a, b, q)));
  const px = a[0] + t * (b[0] - a[0]);
  const py = a[1] + t * (b[1] - a[1]);
  return Math.hypot(q[0] - px, q[1] - py);
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

const isClosedOwnerCandidate = (element: ExcalidrawElement): boolean => {
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "frame":
    case "magicframe":
      return true;
    case "line":
      return (
        isLineElement(element) &&
        element.polygon &&
        isValidPolygon(element.points)
      );
    case "freedraw":
      return isPathALoop(element.points);
    default:
      return false;
  }
};

const isEligibleBoundary = (element: ExcalidrawElement): boolean => {
  if (element.opacity <= 0 || isBucketFill(element)) {
    return false;
  }
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "frame":
    case "magicframe":
    case "line":
    case "freedraw":
      // skip outlines that don't render a visible stroke
      return element.strokeColor !== "transparent";
    default:
      // text, image, embeddable, iframe and arrows are excluded in v1
      return false;
  }
};

const findOwner = (
  point: GlobalPoint,
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
): NonDeletedExcalidrawElement | null => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (element.opacity <= 0 || isBucketFill(element)) {
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
// owner-only ring assembly (no intersections)
// -----------------------------------------------------------------------------

/**
 * Chain a set of segments that form a single closed loop into an ordered ring
 * of points. Returns null if the segments don't form exactly one closed loop
 * with every node of degree 2 (e.g. an open stroke).
 */
const assembleRing = (
  segments: LineSegment<GlobalPoint>[],
  eps: number,
): GlobalPoint[] | null => {
  const store = new NodeStore(eps);
  const adjacency = new Map<number, number[]>();
  const edgeSet = new Set<string>();

  const link = (u: number, v: number) => {
    const list = adjacency.get(u);
    if (list) {
      list.push(v);
    } else {
      adjacency.set(u, [v]);
    }
  };

  for (const segment of segments) {
    const a = store.getOrCreate(segment[0]);
    const b = store.getOrCreate(segment[1]);
    if (a === b) {
      continue;
    }
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeSet.has(key)) {
      continue;
    }
    edgeSet.add(key);
    link(a, b);
    link(b, a);
  }

  if (store.nodes.length < 3) {
    return null;
  }

  // every node must have exactly two neighbours for a single simple loop
  for (const [, neighbours] of adjacency) {
    if (neighbours.length !== 2) {
      return null;
    }
  }

  const start = 0;
  const ring: GlobalPoint[] = [];
  let previous = -1;
  let current = start;
  do {
    ring.push(store.nodes[current]);
    const neighbours = adjacency.get(current);
    if (!neighbours || neighbours.length !== 2) {
      return null;
    }
    const next = neighbours[0] !== previous ? neighbours[0] : neighbours[1];
    previous = current;
    current = next;
  } while (current !== start && ring.length <= store.nodes.length);

  if (current !== start) {
    return null;
  }

  return ring;
};

// -----------------------------------------------------------------------------
// planar arrangement + face extraction (overlap-aware)
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
 * Known gap (see spec): collinear/overlapping segments are not split against
 * each other; transversal intersections and T-junctions are handled.
 */
const buildFaces = (
  rawSegments: SourceSegment[],
  options: BucketFillOptions,
): Face[] | null => {
  const eps = options.snapEpsilon;
  const store = new NodeStore(eps);
  const segments: WorkingSegment[] = [];

  for (const { segment, elementId } of rawSegments) {
    if (segmentLength(segment) < eps) {
      continue;
    }
    const a = store.getOrCreate(segment[0]);
    const b = store.getOrCreate(segment[1]);
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

  // transversal intersections (broad-phase by bbox)
  for (let i = 0; i < segments.length; i++) {
    const si = segments[i];
    const li = lineSegment(si.pa, si.pb);
    for (let j = i + 1; j < segments.length; j++) {
      const sj = segments[j];
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

  // T-junctions: split any segment that passes through an existing node
  for (const segment of segments) {
    for (let n = 0; n < store.nodes.length; n++) {
      if (n === segment.a || n === segment.b) {
        continue;
      }
      const q = store.nodes[n];
      if (
        q[0] < segment.box[0] - eps ||
        q[0] > segment.box[2] + eps ||
        q[1] < segment.box[1] - eps ||
        q[1] > segment.box[3] + eps
      ) {
        continue;
      }
      const t = projectParam(segment.pa, segment.pb, q);
      if (t <= 0 || t >= 1) {
        continue;
      }
      if (distanceToSegment(q, segment.pa, segment.pb) <= eps) {
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
    return null;
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

/** Ramer–Douglas–Peucker on an open polyline (endpoints preserved). */
const ramerDouglasPeucker = (
  pts: GlobalPoint[],
  tolerance: number,
): GlobalPoint[] => {
  if (pts.length < 3) {
    return pts.slice();
  }
  let maxDistance = 0;
  let index = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(pts[i], pts[0], pts[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance > tolerance) {
    const left = ramerDouglasPeucker(pts.slice(0, index + 1), tolerance);
    const right = ramerDouglasPeucker(pts.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[end]];
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

  let tolerance = 0.75;
  let simplified = ramerDouglasPeucker(pts, tolerance);
  while (simplified.length > options.maxGeneratedPoints && tolerance < 1e6) {
    tolerance *= 2;
    simplified = ramerDouglasPeucker(pts, tolerance);
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
  ownerIndexHint?: number;
  options?: Partial<BucketFillOptions>;
}): BucketFillGeometryResult => {
  const options = { ...DEFAULT_BUCKET_FILL_OPTIONS, ...args.options };
  const { point, elements, elementsMap } = args;

  // 1. owner under the pointer
  const owner = findOwner(point, elements, elementsMap);
  if (!owner) {
    return { ok: false, reason: "no_owner" };
  }

  // 2. boundary elements overlapping the owner (z-order agnostic membership)
  const ownerBounds = getElementBounds(owner, elementsMap);
  const pad = options.gapTolerance + 2 + Math.max(owner.strokeWidth ?? 1, 1);
  const expandedOwner = expandBounds(ownerBounds, pad);
  const overlapsOwner = (element: ExcalidrawElement) =>
    doBoundsIntersect(expandedOwner, getElementBounds(element, elementsMap));
  const extraBoundaries = elements.filter(
    (element) =>
      element.id !== owner.id &&
      isEligibleBoundary(element) &&
      overlapsOwner(element),
  );

  // z-order index + the opaque elements that hide outlines beneath them
  const indexOf = new Map<string, number>();
  elements.forEach((element, i) => indexOf.set(element.id, i));
  const coverers = elements.filter(
    (element) =>
      element.opacity > 0 &&
      element.backgroundColor !== "transparent" &&
      !isBucketFill(element) &&
      overlapsOwner(element),
  );

  // 3. flatten to segments tagged with their source element, clipping each
  // outline to its visible parts (portions hidden behind an opaque element
  // above are not boundaries — only what the user actually sees can stop fill)
  const rawSegments: SourceSegment[] = [];
  const collect = (element: ExcalidrawElement) => {
    const elementIndex = indexOf.get(element.id) ?? 0;
    const coverersAbove = coverers.filter(
      (coverer) =>
        coverer.id !== element.id &&
        (indexOf.get(coverer.id) ?? 0) > elementIndex,
    );
    for (const segment of getElementLineSegments(element, elementsMap)) {
      if (segmentLength(segment) < options.snapEpsilon) {
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
        rawSegments.push({ segment: lineSegment(a, b), elementId: element.id });
      }
    }
  };
  collect(owner);
  for (const element of extraBoundaries) {
    collect(element);
  }
  if (rawSegments.length > options.maxBoundarySegments) {
    return { ok: false, reason: "too_complex" };
  }

  // 4. select the ring to fill and the elements whose outlines bound it
  let ring: GlobalPoint[] | null;
  let contributors: Set<string>;
  if (extraBoundaries.length === 0) {
    // owner-only fill: chain the owner outline into a single ring
    ring = assembleRing(
      rawSegments.map((source) => source.segment),
      options.snapEpsilon,
    );
    contributors = new Set([owner.id]);
  } else {
    const faces = buildFaces(rawSegments, options);
    if (!faces) {
      return { ok: false, reason: "too_complex" };
    }
    const face = selectFaceFromArrangement(faces, point, options);
    ring = face ? face.ring : null;
    contributors = face ? face.contributors : new Set();
  }
  if (!ring) {
    return { ok: false, reason: "open_region" };
  }

  // 5. simplify and validate
  const scenePoints = finalizePolygon(ring, options);
  if (!scenePoints) {
    return { ok: false, reason: "invalid_polygon" };
  }
  if (Math.abs(signedArea(scenePoints)) < options.minArea) {
    return { ok: false, reason: "too_small" };
  }

  return {
    ok: true,
    ownerId: owner.id,
    // elements (other than the owner) whose outlines actually bound the fill;
    // the app inserts the fill below the lowest of these + the owner
    boundaryElementIds: [...contributors].filter((id) => id !== owner.id),
    scenePoints,
  };
};
