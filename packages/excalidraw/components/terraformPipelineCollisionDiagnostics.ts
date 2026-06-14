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
  };
};

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

type Seg = { x1: number; y1: number; x2: number; y2: number };

function arrowSegment(el: ExcalidrawElement): Seg | null {
  const pts = (el as { points?: ReadonlyArray<readonly [number, number]> })
    .points;
  if (!Array.isArray(pts) || pts.length < 2) {
    return null;
  }
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return {
    x1: el.x + first[0],
    y1: el.y + first[1],
    x2: el.x + last[0],
    y2: el.y + last[1],
  };
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

function segmentsCross(a: Seg, b: Seg): boolean {
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

  // dataflow metrics
  const segs = tfdArrows.map(arrowSegment).filter((s): s is Seg => s != null);
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segmentsCross(segs[i]!, segs[j]!)) {
        crossings += 1;
      }
    }
  }
  const dys = segs.map((s) => Math.abs(s.y2 - s.y1)).sort((a, b) => a - b);
  const median = dys.length ? dys[Math.floor(dys.length / 2)]! : 0;
  const mean = dys.length ? dys.reduce((a, b) => a + b, 0) / dys.length : 0;
  const nearStraight = dys.filter((d) => d <= 24).length;

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
      tfdArrowCount: segs.length,
      crossings,
      medianVerticalDeviationPx: Math.round(median * 100) / 100,
      meanVerticalDeviationPx: Math.round(mean * 100) / 100,
      fractionNearStraight: segs.length
        ? Math.round((nearStraight / segs.length) * 100) / 100
        : 0,
    },
  };
}
