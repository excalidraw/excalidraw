/**
 * Final-scene collision / hierarchy diagnostics for the pipeline view.
 *
 * Defines, on the converted Excalidraw elements, what "no overlaps or broken
 * hierarchies" means for the semantic-placement work
 * (docs/pipeline-semantic-placement-audit.md). Used as the acceptance gate by
 * tests and by the audit metrics instrument.
 *
 * Collision categories (first-applicable order) per
 * REGION_SUBNET_VERTICAL_BANDS_PLAN.md §"Collision Diagnostic Specification":
 *   region-region | same-vpc-subnet-subnet | frame-title-primary-cluster |
 *   non-ancestor-topology-frame
 * Ancestor containment (a frame inside its own ancestor) is valid and excluded.
 */
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  frameTitleRect,
  rectsOverlap,
  topologyFrameCollisionHull,
  yIntervalsOverlap,
  type Rect,
} from "./terraformPipelineTopologyGeometry";
// M5: the centering median is shared with the model-level acceptance gate so the
// rendered `hubCenteringRate` and the deterministic model gate never drift.
import { median } from "./terraformPipelineCoordinateAssignment";

export type CollisionCategory =
  | "region-region"
  | "same-vpc-subnet-subnet"
  | "frame-title-primary-cluster"
  | "non-ancestor-topology-frame";

export type FinalSceneCollision = {
  category: CollisionCategory;
  a: { id: string; role: string; key: string | null };
  b: { id: string; role: string; key: string | null };
};

export type SemanticEdgeViolation = { source: string; target: string };

export type PipelineSceneDiagnostics = {
  collisionCount: number;
  collisions: FinalSceneCollision[];
  collisionsByCategory: Record<CollisionCategory, number>;
  bandInterleave: {
    regionYIntervalSharedPairs: number;
    accountYIntervalSharedPairs: number;
  };
  semanticEdgeViolations: SemanticEdgeViolation[];
  dataflow: {
    tfdArrowCount: number;
    crossings: number;
    medianVerticalDeviationPx: number;
    meanVerticalDeviationPx: number;
    fractionNearStraight: number;
    // RCLL readability metrics (REQ-11 / §17). Rates are fractions in [0,1];
    // each pairs with a count so a vacuous 0/0 reads as 0 with count 0, not a
    // misleading 1.0 (RFC DEC-6 gate; see *_PX tolerances below).
    fanoutColumnRate: number;
    fanoutSetCount: number;
    hubCenteringRate: number;
    hubCount: number;
    aspect: number;
  };
};

// Metric tolerances, derived from the layout spacing in
// terraformPipelineLayoutShared.ts (kept local so this diagnostics leaf does
// not depend on the heavy layout module). If that spacing changes, update here.
//   FANOUT_COLUMN_TOLERANCE_PX = PIPELINE_COLUMN_GAP (150) / 2
//   CENTERING_EPSILON_PX       = PIPELINE_CLUSTER_GAP_Y (36)
const FANOUT_COLUMN_TOLERANCE_PX = 75;
const CENTERING_EPSILON_PX = 36;
const NEAR_STRAIGHT_MAX_PX = 24;

const TOPOLOGY_ROLES = new Set([
  "provider",
  "account",
  "region",
  "vpc",
  "subnetZone",
]);

type Frame = ExcalidrawElement & {
  customData?: Record<string, unknown>;
};

const rectOf = (el: ExcalidrawElement): Rect => ({
  x: el.x,
  y: el.y,
  width: el.width,
  height: el.height,
});

const roleOf = (el: Frame): string =>
  typeof el.customData?.terraformTopologyRole === "string"
    ? (el.customData.terraformTopologyRole as string)
    : "";

const keyOf = (el: Frame): string | null =>
  typeof el.customData?.terraformTopologyKey === "string"
    ? (el.customData.terraformTopologyKey as string)
    : null;

const pathOf = (el: Frame): string[] => {
  const p = el.customData?.terraformTopologyPath;
  return Array.isArray(p)
    ? (p.filter((s) => typeof s === "string") as string[])
    : [];
};

const isPrefix = (a: string[], b: string[]): boolean =>
  a.length <= b.length && a.every((s, i) => s === b[i]);

const relOf = (el: ExcalidrawElement) => {
  const r = (el.customData as { relationship?: unknown } | undefined)
    ?.relationship;
  return r && typeof r === "object" ? (r as Record<string, unknown>) : null;
};

/**
 * A 2D line segment. Exported so the M6c crossing-min scorer
 * (`terraformPipelineRcllCrossingMin.ts`) can count crossings on box-derived
 * segments through the SAME kernel the rendered diagnostic uses (DRY — RFC DEC-6).
 */
export type Seg = { x1: number; y1: number; x2: number; y2: number };

// Polyline-aware arrow geometry (RFC DEC-6). The previous counter collapsed
// every arrow to a single first→last chord, which mis-counts crossings and
// vertical travel once arrows have bends (e.g. M9 orthogonal routing). We now
// keep all consecutive segments (for crossings) and the polyline's vertical
// extent max_y−min_y (for the ΔY / near-straight metrics). A 2-point straight
// arrow yields exactly one segment whose extent == |Δy|, so today's geometry is
// unchanged — verified by the two-point-regression fixture.
type ArrowGeometry = { segments: Seg[]; verticalExtent: number };

function arrowGeometry(el: ExcalidrawElement): ArrowGeometry | null {
  const pts = (el as { points?: ReadonlyArray<readonly [number, number]> })
    .points;
  if (!Array.isArray(pts) || pts.length < 2) {
    return null;
  }
  const segments: Seg[] = [];
  let minY = el.y + pts[0]![1];
  let maxY = minY;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    segments.push({
      x1: el.x + a[0],
      y1: el.y + a[1],
      x2: el.x + b[0],
      y2: el.y + b[1],
    });
    const ay = el.y + a[1];
    const by = el.y + b[1];
    minY = Math.min(minY, ay, by);
    maxY = Math.max(maxY, ay, by);
  }
  return { segments, verticalExtent: maxY - minY };
}

/** True if any segment of arrow `a` crosses any segment of arrow `b`. */
function arrowsCross(a: ArrowGeometry, b: ArrowGeometry): boolean {
  for (const sa of a.segments) {
    for (const sb of b.segments) {
      if (segmentsCross(sa, sb)) {
        return true;
      }
    }
  }
  return false;
}

function orient(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  return v > 1e-6 ? 1 : v < -1e-6 ? -1 : 0;
}

/**
 * Proper-crossing test for two segments. Endpoint-sharing (within 1px) is treated
 * as NON-crossing — two edges that meet at a shared node do not "cross" in the
 * layered sense. Exported as the shared rendered-crossing kernel (RFC DEC-6) used
 * by both this diagnostic and the M6c box-coordinate scorer.
 */
export function segmentsCross(a: Seg, b: Seg): boolean {
  const share =
    (Math.abs(a.x1 - b.x1) < 1 && Math.abs(a.y1 - b.y1) < 1) ||
    (Math.abs(a.x1 - b.x2) < 1 && Math.abs(a.y1 - b.y2) < 1) ||
    (Math.abs(a.x2 - b.x1) < 1 && Math.abs(a.y2 - b.y1) < 1) ||
    (Math.abs(a.x2 - b.x2) < 1 && Math.abs(a.y2 - b.y2) < 1);
  if (share) {
    return false;
  }
  const o1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return o1 !== o2 && o3 !== o4;
}

/**
 * Classify a colliding topology-frame pair into the first applicable category.
 * Returns null when the pair does not collide or is a valid ancestor pair.
 */
function classifyFramePair(a: Frame, b: Frame): CollisionCategory | null {
  const roleA = roleOf(a);
  const roleB = roleOf(b);
  const hullA = topologyFrameCollisionHull(rectOf(a));
  const hullB = topologyFrameCollisionHull(rectOf(b));
  const hullsOverlap = rectsOverlap(hullA, hullB);

  if (roleA === "region" && roleB === "region" && hullsOverlap) {
    return "region-region";
  }
  if (roleA === "subnetZone" && roleB === "subnetZone" && hullsOverlap) {
    const pa = pathOf(a);
    const pb = pathOf(b);
    // same VPC parent = first 4 path segments equal (provider/account/region/vpc)
    if (
      pa.length >= 4 &&
      pb.length >= 4 &&
      pa.slice(0, 4).join("\0") === pb.slice(0, 4).join("\0")
    ) {
      return "same-vpc-subnet-subnet";
    }
  }
  if (!hullsOverlap) {
    return null;
  }
  const pa = pathOf(a);
  const pb = pathOf(b);
  if (isPrefix(pa, pb) || isPrefix(pb, pa)) {
    return null; // valid ancestor containment
  }
  return "non-ancestor-topology-frame";
}

export function diagnosePipelineScene(
  elements: readonly ExcalidrawElement[],
): PipelineSceneDiagnostics {
  const frames = elements.filter(
    (el): el is Frame =>
      el.type === "frame" &&
      !el.isDeleted &&
      TOPOLOGY_ROLES.has(roleOf(el as Frame)),
  );
  const primaryClusters = elements.filter(
    (el) =>
      el.type === "frame" &&
      !el.isDeleted &&
      (el.customData as { terraformTopologyRole?: string } | undefined)
        ?.terraformTopologyRole === "primaryCluster",
  );

  const collisions: FinalSceneCollision[] = [];
  const collisionsByCategory: Record<CollisionCategory, number> = {
    "region-region": 0,
    "same-vpc-subnet-subnet": 0,
    "frame-title-primary-cluster": 0,
    "non-ancestor-topology-frame": 0,
  };
  const record = (cat: CollisionCategory, a: Frame, b: Frame) => {
    collisions.push({
      category: cat,
      a: { id: a.id, role: roleOf(a), key: keyOf(a) },
      b: { id: b.id, role: roleOf(b), key: keyOf(b) },
    });
    collisionsByCategory[cat] += 1;
  };

  // frame-title vs primary cluster (count even when the cluster is a descendant —
  // title space is not valid content space).
  for (const f of frames) {
    const title = frameTitleRect(rectOf(f));
    for (const pc of primaryClusters) {
      if (rectsOverlap(title, rectOf(pc))) {
        record("frame-title-primary-cluster", f, pc as Frame);
      }
    }
  }

  // topology-frame pairs (region-region / same-vpc-subnet / non-ancestor)
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const cat = classifyFramePair(frames[i]!, frames[j]!);
      if (cat) {
        record(cat, frames[i]!, frames[j]!);
      }
    }
  }

  // Y-band interleave (forced-band purity): same-role frames whose vertical
  // intervals overlap regardless of X.
  const byRole = (role: string) => frames.filter((f) => roleOf(f) === role);
  const yShared = (els: Frame[]) => {
    let n = 0;
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        if (yIntervalsOverlap(rectOf(els[i]!), rectOf(els[j]!))) {
          n += 1;
        }
      }
    }
    return n;
  };

  // semantic edge violations: declared edge whose target column is left of source.
  const frameByAddress = new Map<string, Frame>();
  for (const pc of primaryClusters) {
    const addr = (pc.customData as { terraformPrimaryAddress?: string })
      ?.terraformPrimaryAddress;
    if (typeof addr === "string") {
      frameByAddress.set(addr, pc as Frame);
    }
  }
  const centerX = (f: Frame) => f.x + f.width / 2;
  const centerY = (f: Frame) => f.y + f.height / 2;
  const semanticEdgeViolations: SemanticEdgeViolation[] = [];

  const allArrows = elements.filter((el) => el.type === "arrow");
  const tfdArrows = allArrows.filter((el) => {
    const r = relOf(el);
    return (
      r != null &&
      typeof r.source === "string" &&
      typeof r.target === "string" &&
      r.aggregated !== true
    );
  });
  for (const arrow of tfdArrows) {
    const r = relOf(arrow)!;
    const src = frameByAddress.get(r.source as string);
    const tgt = frameByAddress.get(r.target as string);
    if (src && tgt && centerX(tgt) < centerX(src) - 1) {
      semanticEdgeViolations.push({
        source: r.source as string,
        target: r.target as string,
      });
    }
  }

  // dataflow metrics — polyline-aware (RFC DEC-6).
  const geoms = tfdArrows
    .map(arrowGeometry)
    .filter((g): g is ArrowGeometry => g != null);
  // Crossings: count each arrow PAIR at most once, even if multiple of their
  // segments intersect ("edges that cross", not segment intersections). For
  // 2-point arrows this reduces to the previous chord-vs-chord count.
  let crossings = 0;
  for (let i = 0; i < geoms.length; i++) {
    for (let j = i + 1; j < geoms.length; j++) {
      if (arrowsCross(geoms[i]!, geoms[j]!)) {
        crossings += 1;
      }
    }
  }
  // Vertical deviation / near-straight use the polyline's vertical extent
  // (max_y−min_y), so an orthogonal jog reads as deviating even when its
  // endpoints share a Y. Equals |Δy| for a straight arrow.
  const dys = geoms.map((g) => g.verticalExtent).sort((a, b) => a - b);
  const medianDeltaY = dys.length ? dys[Math.floor(dys.length / 2)]! : 0;
  const meanDeltaY = dys.length
    ? dys.reduce((a, b) => a + b, 0) / dys.length
    : 0;
  const nearStraight = dys.filter((d) => d <= NEAR_STRAIGHT_MAX_PX).length;

  // Fan-out / convergence readability (REQ-3/T4, REQ-6/T5). Reconstruct sets
  // from the TFD arrow relationships and resolve endpoints to primary-cluster
  // frames by terraformPrimaryAddress (same map as the semantic-edge gate).
  // Coverage depends on the builder: under the compound fallback this resolves
  // in Compact (every cluster card carries terraformPrimaryAddress) but is
  // empty in Full, where the inlined-satellite cluster frames carry no such
  // address — so Full reads 0 with fanoutSetCount/hubCount 0 (the companion
  // counts make that "measured nothing" explicit rather than a false 1.0).
  // RCLL geometry (M2+) tags frames consistently, closing the Full gap.
  const targetsBySource = new Map<string, Set<string>>();
  const sourcesByTarget = new Map<string, Set<string>>();
  const addTo = (map: Map<string, Set<string>>, key: string, value: string) => {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  };
  for (const arrow of tfdArrows) {
    const r = relOf(arrow)!;
    const source = r.source as string;
    const target = r.target as string;
    if (source === target) {
      continue;
    }
    addTo(targetsBySource, source, target);
    addTo(sourcesByTarget, target, source);
  }

  // fanoutColumnRate: of fan-out sets with ≥2 resolvable targets, the fraction
  // whose targets share a column (centerX spread ≤ tolerance).
  let fanoutSetCount = 0;
  let fanoutColumnAligned = 0;
  // hubCenteringRate: of nodes that fan out OR converge (≥2 resolvable
  // neighbours) and resolve to a frame, the fraction centered within ε on the
  // median of those neighbours (both directions, RFC §13 gate).
  let hubCount = 0;
  let hubCentered = 0;
  const evaluate = (
    nodeAddr: string,
    neighbours: Set<string>,
    countColumn: boolean,
  ) => {
    const neighbourFrames = [...neighbours]
      .map((addr) => frameByAddress.get(addr))
      .filter((f): f is Frame => f != null);
    if (neighbourFrames.length < 2) {
      return;
    }
    if (countColumn) {
      fanoutSetCount += 1;
      const xs = neighbourFrames.map(centerX);
      if (Math.max(...xs) - Math.min(...xs) <= FANOUT_COLUMN_TOLERANCE_PX) {
        fanoutColumnAligned += 1;
      }
    }
    const node = frameByAddress.get(nodeAddr);
    if (node) {
      hubCount += 1;
      if (
        Math.abs(centerY(node) - median(neighbourFrames.map(centerY))) <=
        CENTERING_EPSILON_PX
      ) {
        hubCentered += 1;
      }
    }
  };
  for (const [source, targets] of targetsBySource) {
    evaluate(source, targets, true);
  }
  for (const [target, sources] of sourcesByTarget) {
    evaluate(target, sources, false);
  }

  // aspect = content bounding box W:H over topology frames + clusters.
  const aspectEls = [...frames, ...primaryClusters];
  let aspect = 0;
  if (aspectEls.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of aspectEls) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    const height = maxY - minY;
    aspect = height > 0 ? (maxX - minX) / height : 0;
  }

  const rate = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 100) / 100 : 0;

  return {
    collisionCount: collisions.length,
    collisions,
    collisionsByCategory,
    bandInterleave: {
      regionYIntervalSharedPairs: yShared(byRole("region")),
      accountYIntervalSharedPairs: yShared(byRole("account")),
    },
    semanticEdgeViolations,
    dataflow: {
      tfdArrowCount: geoms.length,
      crossings,
      medianVerticalDeviationPx: Math.round(medianDeltaY * 100) / 100,
      meanVerticalDeviationPx: Math.round(meanDeltaY * 100) / 100,
      fractionNearStraight: rate(nearStraight, geoms.length),
      fanoutColumnRate: rate(fanoutColumnAligned, fanoutSetCount),
      fanoutSetCount,
      hubCenteringRate: rate(hubCentered, hubCount),
      hubCount,
      aspect: Math.round(aspect * 100) / 100,
    },
  };
}
