/**
 * RCLL (Recursive Compound Layered Layout) — Placement (Stage 1d/2). M3a drew the
 * first geometry; **M3b** added hull-aware cyclic placement (this file's headline).
 *
 * Source of truth: docs/pipeline-rcll-layout-design.md §7.2 (recursive container
 * layout), §8 (per-level forced/packed policy), §11 (local columns), §13 (CON-3/4/5
 * + CON-12 gates), §22 (stage contract). Decisions: RFC §34.1 DI-M3a-* / DI-M3b-*.
 *
 * M2 wrote `localColumn` per container; placement turns those columns into a global
 * `box` per node, from which export derives hull frames (`boundsOf(childBoxes)+pad`)
 * and routes arrows. No centering (M5) or push-right (M7) yet.
 *
 *   localColumn (M2) ──► columnX (per container)   ──┐
 *   tree + roles     ──► policy (forced/packed/…)  ──┼─► node.box (local) ─► globalize ─► box (global px)
 *   D_H cyclic ──► SCC decompose: 2-way → swimlane, 1-way → staircase + DEC-1 Y-rise ┘
 *
 * ## The box model (why it is collision-free by construction)
 *
 * Each container's `box` is a **footprint** that RESERVES its own frame title at the
 * top (for roles that render a titled topology frame). Because the title lives
 * inside the footprint, stacking two sibling footprints with any positive gap keeps
 * their derived frame rectangles AND title strips disjoint — so the four collision
 * classes (region-region, same-vpc-subnet-subnet, frame-title-primary-cluster,
 * non-ancestor-topology-frame) all hold without per-gap title arithmetic.
 *
 *   ┌───────────────── container footprint ─────────────────┐
 *   │  [ title strip  — TITLE_HEIGHT ]      (role has frame) │
 *   │  [ PAD ]                                               │
 *   │  [ PAD ] child child child …  [ PAD ]   ← children area│
 *   │  [ PAD ]                                               │
 *   └────────────────────────────────────────────────────────┘
 *   frame rect (derived in export) = childrenBBox ± PAD; title renders above it,
 *   inside the reserved strip ⇒ never overlaps a sibling band or a descendant card.
 *
 * Determinism (CON-8): children are already `(minDescendantSequence, key)`-sorted
 * (M1); forced bands order by `(localColumn, minDescendantSequence, key)`; packed
 * columns stack by `(minDescendantSequence, key)`; coords snapped to 1px. No
 * randomness, no timings.
 */
import {
  boundsOf,
  columnOffsetsFromWidths,
  longestPath,
  PIPELINE_CLUSTER_GAP_Y,
  PIPELINE_COLUMN_GAP,
  PIPELINE_FRAME_PAD,
  stronglyConnectedComponents,
} from "./terraformPipelineLayoutShared";
import { PIPELINE_FRAME_TITLE_HEIGHT } from "./terraformPipelineTopologyGeometry";
import {
  barycenterReorder,
  type OrderableLeaf,
} from "./terraformPipelineOrdering";
import { hubCenteringOverBoxes } from "./terraformPipelineCoordinateAssignment";
import { deDensifyColumns } from "./terraformPipelineDeDensify";
import {
  compactColumns,
  type ColumnCompactMeasure,
} from "./terraformPipelineColumnCompact";
import type { RankSeparateMeta } from "./terraformPipelineRcllRankSeparate";
import { computeGlobalSeparatedFloor } from "./terraformPipelineRcllRankSeparate";
import {
  collapsedEdgesFromFanout,
  minimizeCrossings,
  type CrossingMinResult,
} from "./terraformPipelineRcllCrossingMin";
import {
  straightenColumns,
  type StraightenLeaf,
} from "./terraformPipelineStraighten";

import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";
import type { DeBandLevel } from "./terraformPipelineLayoutProfiles";
import type {
  CollapsedPipelineEdge,
  PipelineCluster,
} from "./terraformPipelineLayoutShared";
import type {
  CompoundNode,
  HullEdge,
  Lattice,
  RcllOptions,
  RcllTopologyRole,
  StageResult,
} from "./terraformPipelineRcllTypes";

/** M5c column-compaction stats, summed across all swimlane groups in the tree. */
export type ColumnCompactStats = {
  moved: number;
  reclaimedCols: number;
  evalCapReached: boolean;
};

/** Threaded placement context (avoids param sprawl through the recursion). */
type PlaceCtx = {
  cyclic: ReadonlySet<string>;
  floor: ReadonlyMap<string, number>;
  hullEdges: ReadonlyMap<string, readonly HullEdge[]>;
  /** DEC-1: X-disjoint SCC groups rise to share Y (default true). */
  staircaseOverlap: boolean;
  /** M4 (default false): inside a swimlane, X-disjoint lanes RISE to share Y rows
   * (DEC-1 extended to swimlane interiors) instead of pure Y-stacking. CON-12-safe
   * (leaf shared-column X is preserved). The A/B toggle. */
  swimlaneLaneRise: boolean;
  /** M6 (default false): within-column leaf order is chosen by a per-container
   * barycenter reorder (strict-improve crossing gate) instead of model order. The
   * A/B toggle. X (columns) is untouched — order only. */
  reorder: boolean;
  /** M5 (default false): after the per-column stack, assign each leaf a Brandes–Köpf
   * Y that straightens its adjacent-column dataflow edges (RFC §9 Axis-1). Y only —
   * X (columns) and within-column ORDER (M6) untouched. The A/B toggle. */
  straighten: boolean;
  /** M5b (default false): de-density — promote SAFE independent leaves one column to
   * thin crowded swimlane columns (Axis-2 B, RFC §9.3; internal/measurement-only).
   * CON-12-safe by construction (forward single-column move). The A/B toggle. */
  deDensify: boolean;
  /** M5b width dial: max brand-new columns de-density may add (default 0 == off). */
  deDensifyMaxCols: number;
  /** M5c (default false): column compaction — pull SAFE independent leaves LEFT into an
   * earlier column's whitespace to shrink swimlane width, measure-gated so the hull never
   * grows wider or taller (Axis-2 A, RFC §9.4). Mutually exclusive with `deDensify`. */
  columnCompact: boolean;
  /** M5c stats accumulator (mutated across swimlane groups; read by `placementStage`). */
  columnCompactStats?: ColumnCompactStats;
  /** De-band depth (default "none"): collapse the chosen container level + all deeper
   * levels, lifting their leaf clusters to direct children of the surviving parent so that
   * subtree shares one column stack (height → merged max-column-occupancy). X
   * (`colByCluster`) untouched ⇒ CON-12-safe at any level. A pre-pass tree rewrite in
   * `layoutPlacement`; suppresses the dissolved frames. */
  deBandLevel: DeBandLevel;
  /** out(u): fan-out target cluster ids by source id (M6 adjacency / M5 straighten). */
  fanout: ReadonlyMap<string, readonly string[]>;
  /** in(w): fan-in source cluster ids by target id (M5 straighten). */
  fanin: ReadonlyMap<string, readonly string[]>;
  /** M6c (default empty): a global pre-order rank per node key proposed by the
   * container-aware crossing-min search. When non-empty it determines every container's
   * SIBLING order (lanes/sub-hulls + within-column leaves); model order is the tiebreak.
   * Empty ⇒ model/M6 order ⇒ byte-identical. X is never a function of order, so this
   * moves only Y (CON-12 untouched). See terraformPipelineRcllCrossingMin.ts. */
  orderOverride: ReadonlyMap<string, number>;
};

/**
 * Sibling comparator honoring the M6c order override: when BOTH siblings carry an
 * override rank they sort by it, else fall back to model order `(mds, key)`. An empty
 * override ⇒ pure model order (OFF byte-identical).
 */
function preferredOrder(
  override: ReadonlyMap<string, number>,
): (a: CompoundNode, b: CompoundNode) => number {
  return (a, b) => {
    const ra = override.get(a.key);
    const rb = override.get(b.key);
    if (ra != null && rb != null && ra !== rb) {
      return ra - rb;
    }
    return byModelOrder(a, b);
  };
}

/**
 * M6 within-column reorder. Returns a **stable global sort rank** per child key.
 * OFF (or no crossing improvement) ⇒ exactly the model order `(mds, key)`, so the
 * scene stays byte-identical. ON ⇒ leaf clusters are permuted to a per-container
 * barycenter order **within their column only**; non-leaf children (sub-hulls)
 * keep their model-order slots. Because the per-column stack groups by column, a
 * caller that sorts ALL children by this rank gets: containers untouched, leaves
 * reordered for fewer crossings. `colOf` reads the placement column a child will
 * occupy (`localColumn` for packed, the shared `denseRank` axis for swimlanes).
 */
function reorderRankByKey(
  children: readonly CompoundNode[],
  colOf: (child: CompoundNode) => number,
  ctx: PlaceCtx,
): Map<string, number> {
  const model = [...children].sort(
    (a, b) =>
      a.minDescendantSequence - b.minDescendantSequence ||
      a.key.localeCompare(b.key),
  );
  const modelRank = new Map<string, number>(model.map((c, i) => [c.key, i]));
  // M6c: a non-empty crossing-min override decides sibling order outright (it is the
  // hierarchical superset of M6; the toggle guard makes crossingMin win over reorder).
  if (ctx.orderOverride.size > 0) {
    const ordered = [...children].sort(preferredOrder(ctx.orderOverride));
    return new Map<string, number>(ordered.map((c, i) => [c.key, i]));
  }
  if (!ctx.reorder) {
    return modelRank;
  }

  const leaves = children.filter((c) => c.cluster && c.children.length === 0);
  if (leaves.length < 2) {
    return modelRank;
  }
  const orderable: OrderableLeaf[] = leaves.map((l) => ({
    key: l.key,
    clusterId: l.cluster!.id,
    col: colOf(l),
  }));
  const ids = new Set(orderable.map((o) => o.clusterId));
  // In-container collapsed edges (both endpoints leaves here), from fan-out.
  const edges: [string, string][] = [];
  for (const o of orderable) {
    for (const t of ctx.fanout.get(o.clusterId) ?? []) {
      if (ids.has(t)) {
        edges.push([o.clusterId, t]);
      }
    }
  }
  const leafColRank = barycenterReorder(
    orderable,
    (k) => modelRank.get(k) ?? 0,
    edges,
  );

  // Merge: walk model order; at each leaf slot, substitute the leaf that the
  // barycenter order wants next for that column. Non-leaf slots stay fixed, so
  // the global rank only permutes leaves within their own column.
  const colOfKey = new Map(orderable.map((o) => [o.key, o.col]));
  const leavesByColModel = new Map<number, CompoundNode[]>();
  for (const c of model) {
    if (!colOfKey.has(c.key)) {
      continue;
    }
    const col = colOfKey.get(c.key)!;
    (leavesByColModel.get(col) ?? leavesByColModel.set(col, []).get(col)!).push(
      c,
    );
  }
  // Within each column, the ordered leaf sequence by barycenter rank.
  const orderedLeafQueue = new Map<number, CompoundNode[]>();
  for (const [col, ls] of leavesByColModel) {
    orderedLeafQueue.set(
      col,
      [...ls].sort(
        (a, b) =>
          (leafColRank.get(a.key) ?? 0) - (leafColRank.get(b.key) ?? 0) ||
          (modelRank.get(a.key) ?? 0) - (modelRank.get(b.key) ?? 0),
      ),
    );
  }
  const cursor = new Map<number, number>();
  const merged: CompoundNode[] = model.map((c) => {
    if (!colOfKey.has(c.key)) {
      return c; // non-leaf slot fixed
    }
    const col = colOfKey.get(c.key)!;
    const i = cursor.get(col) ?? 0;
    cursor.set(col, i + 1);
    return orderedLeafQueue.get(col)![i]!;
  });
  return new Map<string, number>(merged.map((c, i) => [c.key, i]));
}

/** Synthetic compound-tree root key (mirrors terraformPipelineRcllModel). */
const RCLL_ROOT_KEY = "__rcll_root__";

/** Placement policy for a container's children (§8). */
type Policy = "passthrough" | "forced" | "packed" | "mixed";

/**
 * Per-level policy by parent role (§8). **`root` is `passthrough`** (children = the
 * providers): M3a places providers at their column X but NOT a Y band — the reused
 * `applyCompoundHierarchicalLayout` in export is the sole owner of provider Y
 * stacking (eng-review A3).
 *
 * **Cyclic containers are NOT routed here.** A container whose hull-edge graph
 * `D_H` is cyclic is handled by `arrangeByHullMatrix` in `sizeAndArrange` BEFORE
 * policy is consulted (DEC-8(C) refined, M3b): its `D_H` is decomposed into SCCs —
 * a multi-hull SCC (mutual 2-way cycle) becomes one swimlane (shared axis), the
 * one-way condensation is staircased with a DEC-1 Y-rise. The cluster graph `D` is
 * acyclic, so hull cycles never force resource columns (CON-12 holds). See §26.
 */
export function policyForContainer(role: RcllTopologyRole): Policy {
  switch (role) {
    case "root":
      return "passthrough";
    case "provider":
    case "account":
      return "forced";
    case "vpc":
      return "mixed";
    case "region":
    case "subnetZone":
    default:
      return "packed";
  }
}

/** Roles that render a titled topology frame (so reserve title space). */
function rendersTitledFrame(role: RcllTopologyRole): boolean {
  return (
    role === "provider" ||
    role === "account" ||
    role === "region" ||
    role === "vpc" ||
    role === "subnetZone"
  );
}

/** Deep-clone a node, PRESERVING `localColumn` (M2 output, read by placement);
 * `box` is dropped so placement writes a fresh one (pure transform, §22.1). */
function cloneNode(node: CompoundNode): CompoundNode {
  return {
    key: node.key,
    role: node.role,
    level: node.level,
    minDescendantSequence: node.minDescendantSequence,
    cluster: node.cluster,
    children: node.children.map(cloneNode),
    localColumn: node.localColumn,
  };
}

/**
 * De-band the chosen level → its **absorbing parent** (the role one level shallower).
 * Collapsing at the absorbing parent flattens the WHOLE subtree in one op — because
 * `collectClusterLeaves` already recurses to every descendant leaf, dissolving at the
 * parent cascades all deeper container levels automatically (vpc de-band also dissolves
 * subnets; provider de-band dissolves everything into a single stack under the root).
 */
const ABSORBING_PARENT_ROLE: Record<
  Exclude<DeBandLevel, "none">,
  RcllTopologyRole
> = {
  subnet: "vpc",
  vpc: "region",
  region: "account",
  account: "provider",
  provider: "root",
};

/**
 * De-band pre-pass. Mutates the **cloned** tree (safe — `layoutPlacement` already cloned):
 * for every node whose role is the de-band level's absorbing parent AND which still has a
 * deeper container child, replace its children with ALL of its descendant leaf clusters —
 * dissolving the dissolved level (and everything below it) so the absorbing parent arranges
 * the merged resources in ONE shared column stack instead of stacking each child container
 * into its own disjoint Y band. Height collapses from `Σ(bands)` toward the merged
 * `max-column-occupancy`. X is set later from the shared `colByCluster`/`localColumn`, so
 * forwardness (CON-12) is untouched. The dissolved frames are suppressed downstream
 * (membership restored as per-card rails). Determinism: children re-sorted `(mds, key)`. */
function collapseTreeForDeBand(node: CompoundNode, level: DeBandLevel): void {
  for (const child of node.children) {
    collapseTreeForDeBand(child, level);
  }
  if (level === "none" || node.role !== ABSORBING_PARENT_ROLE[level]) {
    return;
  }
  // Only act when there is a deeper container to dissolve — a node whose children are
  // already all leaves stays byte-identical (matches the original subnet-level guard).
  const hasContainerChild = node.children.some(
    (c) => c.children.length > 0,
  );
  if (!hasContainerChild) {
    return;
  }
  const lifted: CompoundNode[] = [];
  collectClusterLeaves(node, lifted);
  if (lifted.length === 0) {
    return;
  }
  lifted.sort(
    (a, b) =>
      a.minDescendantSequence - b.minDescendantSequence ||
      a.key.localeCompare(b.key),
  );
  node.children = lifted;
}

/** Per-column max width over a set of already-sized children. */
function columnWidths(children: readonly CompoundNode[]): number[] {
  const maxCol = children.reduce((m, c) => Math.max(m, c.localColumn ?? 0), 0);
  const widths = new Array<number>(maxCol + 1).fill(0);
  for (const c of children) {
    const col = c.localColumn ?? 0;
    widths[col] = Math.max(widths[col]!, c.box?.width ?? 0);
  }
  return widths;
}

/** Forced bands: each child its own disjoint Y band; X by column (staircase, CON-6).
 * Returns the Y cursor after the last band. Order: `(localColumn, mds, key)`. */
function placeForcedBands(
  children: readonly CompoundNode[],
  columnX: readonly number[],
  areaX: number,
  startY: number,
  orderOverride: ReadonlyMap<string, number>,
): number {
  // Within a column the band order is model order — or, under M6c, the crossing-min
  // sibling order (Y only; the column X is untouched, so CON-12 holds).
  const pref = preferredOrder(orderOverride);
  const ordered = [...children].sort(
    (a, b) => (a.localColumn ?? 0) - (b.localColumn ?? 0) || pref(a, b),
  );
  let cursorY = startY;
  for (const child of ordered) {
    const col = child.localColumn ?? 0;
    child.box = {
      x: areaX + (columnX[col] ?? 0),
      y: cursorY,
      width: child.box?.width ?? 0,
      height: child.box?.height ?? 0,
    };
    cursorY += (child.box.height ?? 0) + PIPELINE_CLUSTER_GAP_Y;
  }
  return cursorY;
}

/** Packed column-stack: within each column, stack children top→down; columns are
 * independent (X separates them). Order within a column: `(mds, key)`, or the M6
 * barycenter reorder when `ctx.reorder` (leaves only; strict-improve gated). */
function placePackedColumns(
  children: readonly CompoundNode[],
  columnX: readonly number[],
  areaX: number,
  startY: number,
  ctx: PlaceCtx,
): void {
  const rank = reorderRankByKey(
    children,
    (c) => c.localColumn ?? 0,
    ctx,
  );
  const ordered = [...children].sort(
    (a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0),
  );
  const colCursor = new Map<number, number>();
  for (const child of ordered) {
    const col = child.localColumn ?? 0;
    const y = colCursor.get(col) ?? startY;
    child.box = {
      x: areaX + (columnX[col] ?? 0),
      y,
      width: child.box?.width ?? 0,
      height: child.box?.height ?? 0,
    };
    colCursor.set(col, y + (child.box.height ?? 0) + PIPELINE_CLUSTER_GAP_Y);
  }
  // M5 (A1): re-assign leaf Y by Brandes–Köpf straightening, keeping column X +
  // order. Leaf clusters only — sub-hull containers keep their stack slot.
  applyStraightening(
    ordered,
    (c) => c.localColumn ?? 0,
    startY,
    ctx.straighten,
    ctx.fanout,
    ctx.fanin,
  );
}

/**
 * M5 (A1 Brandes–Köpf): when `straighten`, rewrite each leaf child's `box.y` to the
 * straightened Y (X + within-column order untouched). No-op for non-leaf children
 * (sub-hulls keep their stack slot) and when the flag is off. The child's index in the
 * already-sorted `ordered` list IS the M6-settled within-column order (per column).
 */
function applyStraightening(
  ordered: readonly CompoundNode[],
  colOf: (child: CompoundNode) => number,
  segmentTop: number,
  straighten: boolean,
  fanout: ReadonlyMap<string, readonly string[]>,
  fanin: ReadonlyMap<string, readonly string[]>,
): void {
  if (!straighten) {
    return;
  }
  const leaves: StraightenLeaf[] = [];
  ordered.forEach((child, i) => {
    if (child.children.length === 0 && child.cluster && child.box) {
      leaves.push({
        key: child.key,
        clusterId: child.cluster.id,
        col: colOf(child),
        height: child.box.height ?? 0,
        order: i,
      });
    }
  });
  if (leaves.length === 0) {
    return;
  }
  const y = straightenColumns(
    leaves,
    fanout,
    fanin,
    segmentTop,
    PIPELINE_CLUSTER_GAP_Y,
  );
  for (const child of ordered) {
    const ny = y.get(child.key);
    if (ny != null && child.box) {
      child.box = { ...child.box, y: ny };
    }
  }
}

/** A shared cluster column axis for a swimlane (cyclic) subtree. */
type LaneContext = {
  /** left-edge X per shared column (column = dense rank of cluster floor). */
  columnX: readonly number[];
  /** cluster id → shared column index (every descendant leaf of the cyclic root). */
  colByCluster: ReadonlyMap<string, number>;
  /** M4: X-disjoint lanes rise to share Y rows (vs pure Y-stack). */
  riseLanes: boolean;
  /** M6: barycenter-reorder leaf Y-order within each shared column (strict-improve
   * gated) instead of model order. */
  reorder: boolean;
  /** M5 (A1): Brandes–Köpf straighten leaf Y after the per-column stack. */
  straighten: boolean;
  /** M6 adjacency / M5 straighten: out(u) cluster-id fan-out targets by source id. */
  fanout: ReadonlyMap<string, readonly string[]>;
  /** M5 straighten: in(w) cluster-id fan-in sources by target id. */
  fanin: ReadonlyMap<string, readonly string[]>;
  /** M6c: the crossing-min global sibling-order override (empty ⇒ model/M6 order). */
  orderOverride: ReadonlyMap<string, number>;
};

/** Collect every descendant **leaf cluster** node under `node`. */
function collectClusterLeaves(node: CompoundNode, out: CompoundNode[]): void {
  if (node.children.length === 0) {
    if (node.cluster) {
      out.push(node);
    }
    return;
  }
  for (const child of node.children) {
    collectClusterLeaves(child, out);
  }
}

/**
 * Assign each leaf cluster a **shared column** = the dense rank of its global
 * longest-path floor (`LB`) among the distinct floors present in the cyclic
 * subtree. `LB` is a longest-path layering, so a TFD edge `u→v` ⇒ `LB(v) > LB(u)`
 * ⇒ `rank(v) > rank(u)`: **no TFD edge shares a column** (CON-1/CON-12), by
 * construction. Dense-ranking removes empty columns so the shared axis is no wider
 * than the number of distinct depths actually present (bounds the §3.4 width cost).
 */
function denseClusterColumns(
  leaves: readonly CompoundNode[],
  floor: ReadonlyMap<string, number>,
): Map<string, number> {
  const distinctFloors = [
    ...new Set(leaves.map((l) => floor.get(l.cluster!.id) ?? 0)),
  ].sort((a, b) => a - b);
  const rankOfFloor = new Map<number, number>(
    distinctFloors.map((f, i) => [f, i]),
  );
  const col = new Map<string, number>();
  for (const l of leaves) {
    col.set(l.cluster!.id, rankOfFloor.get(floor.get(l.cluster!.id) ?? 0) ?? 0);
  }
  return col;
}

/** Build the shared column axis for a swimlane (column X from per-column max
 * cluster width over ALL leaves under the given node set). Scoped to ONE SCC
 * group's members (DEC-8(C) refined) — NOT the whole cyclic container. */
function buildLaneContext(
  nodes: readonly CompoundNode[],
  floor: ReadonlyMap<string, number>,
  riseLanes: boolean,
  reorder: boolean,
  straighten: boolean,
  fanout: ReadonlyMap<string, readonly string[]>,
  fanin: ReadonlyMap<string, readonly string[]>,
  deDensify: boolean,
  deDensifyMaxCols: number,
  orderOverride: ReadonlyMap<string, number>,
): LaneContext {
  const leaves: CompoundNode[] = [];
  for (const n of nodes) {
    collectClusterLeaves(n, leaves);
  }
  // `rankSeparate` (RFC §9.6 / DEC-13) no longer hooks here: the separated floor is
  // computed once globally at `placementStage` and threaded in as `floor`. This lane
  // path just consumes whatever floor it was given (base or separated).
  const effectiveFloor = floor;
  // M5b (Axis-2 B): the dense-rank axis piles independent same-floor clusters into one
  // column. De-density rewrites it, promoting SAFE leaves one column right to make
  // Y-room for the straightener. CON-12-safe by construction (see terraformPipelineDeDensify).
  const colByCluster =
    deDensify && deDensifyMaxCols > 0
      ? deDensifyColumns(
          leaves.map((l) => ({
            clusterId: l.cluster!.id,
            firstSequence: l.cluster!.firstSequence,
          })),
          denseClusterColumns(leaves, effectiveFloor),
          fanout,
          fanin,
          { maxExtraCols: deDensifyMaxCols },
        )
      : denseClusterColumns(leaves, effectiveFloor);
  return laneContextFromColMap(leaves, colByCluster, {
    riseLanes,
    reorder,
    straighten,
    fanout,
    fanin,
    orderOverride,
  });
}

/**
 * Build a `LaneContext` from an already-decided `colByCluster` map: per-column max
 * cluster width → `columnX` offsets, plus the lane flags. Shared by `buildLaneContext`
 * (base/de-densified map) and the M5c compaction measure oracle (trial maps), so the
 * trial measure and the real placement derive identical geometry.
 */
function laneContextFromColMap(
  leaves: readonly CompoundNode[],
  colByCluster: ReadonlyMap<string, number>,
  flags: {
    riseLanes: boolean;
    reorder: boolean;
    straighten: boolean;
    fanout: ReadonlyMap<string, readonly string[]>;
    fanin: ReadonlyMap<string, readonly string[]>;
    orderOverride: ReadonlyMap<string, number>;
  },
): LaneContext {
  const maxCol = leaves.reduce(
    (m, l) => Math.max(m, colByCluster.get(l.cluster!.id) ?? 0),
    0,
  );
  const colWidth = new Array<number>(maxCol + 1).fill(0);
  for (const l of leaves) {
    const c = colByCluster.get(l.cluster!.id) ?? 0;
    colWidth[c] = Math.max(colWidth[c]!, l.cluster!.build.width ?? 0);
  }
  const columnX = columnOffsetsFromWidths(colWidth, 0, PIPELINE_COLUMN_GAP);
  return {
    columnX,
    colByCluster,
    riseLanes: flags.riseLanes,
    reorder: flags.reorder,
    straighten: flags.straighten,
    fanout: flags.fanout,
    fanin: flags.fanin,
    orderOverride: flags.orderOverride,
  };
}

/** Collect every node's box height under `node` (key → px) for the M5c measure. */
function collectHeights(node: CompoundNode, out: Map<string, number>): void {
  out.set(node.key, node.box?.height ?? 0);
  for (const child of node.children) {
    collectHeights(child, out);
  }
}

const byModelOrder = (a: CompoundNode, b: CompoundNode): number =>
  a.minDescendantSequence - b.minDescendantSequence ||
  a.key.localeCompare(b.key);

/**
 * M6 leaf order on a shared swimlane axis. OFF (or no crossing improvement) ⇒
 * model order — byte-identical to M4. ON ⇒ leaves permuted within their shared
 * column (`ctx.colByCluster`) by the barycenter reorder; the strict-improve gate
 * guarantees it never increases crossings. X is untouched (column membership is
 * fixed by `colByCluster`); only the per-column stacking order changes.
 */
function laneLeafOrder(
  leafNodes: readonly CompoundNode[],
  ctx: LaneContext,
): CompoundNode[] {
  const model = [...leafNodes].sort(byModelOrder);
  // M6c: under a crossing-min override, leaves order by (shared column, override rank)
  // — column membership (X) is fixed by colByCluster, so only the within-column Y stack
  // order changes. Takes precedence over M6 (guard makes crossingMin win over reorder).
  if (ctx.orderOverride.size > 0) {
    const pref = preferredOrder(ctx.orderOverride);
    return [...leafNodes].sort(
      (a, b) =>
        (ctx.colByCluster.get(a.cluster!.id) ?? 0) -
          (ctx.colByCluster.get(b.cluster!.id) ?? 0) || pref(a, b),
    );
  }
  if (!ctx.reorder || model.length < 2) {
    return model;
  }
  const orderable: OrderableLeaf[] = model
    .filter((l) => l.cluster)
    .map((l) => ({
      key: l.key,
      clusterId: l.cluster!.id,
      col: ctx.colByCluster.get(l.cluster!.id) ?? 0,
    }));
  const ids = new Set(orderable.map((o) => o.clusterId));
  const edges: [string, string][] = [];
  for (const o of orderable) {
    for (const t of ctx.fanout.get(o.clusterId) ?? []) {
      if (ids.has(t)) {
        edges.push([o.clusterId, t]);
      }
    }
  }
  const modelRank = new Map<string, number>(model.map((l, i) => [l.key, i]));
  const colRank = barycenterReorder(
    orderable,
    (k) => modelRank.get(k) ?? 0,
    edges,
  );
  // Sort by shared column first (stable encounter order for the colCursor),
  // then the per-column barycenter rank, then model order (deterministic).
  return model.sort(
    (a, b) =>
      (ctx.colByCluster.get(a.cluster!.id) ?? 0) -
        (ctx.colByCluster.get(b.cluster!.id) ?? 0) ||
      (colRank.get(a.key) ?? 0) - (colRank.get(b.key) ?? 0) ||
      (modelRank.get(a.key) ?? 0) - (modelRank.get(b.key) ?? 0),
  );
}

/**
 * Lay a set of sibling nodes onto a shared column axis `ctx`, relative to
 * `(originX, originY)`: containers become Y-lanes (stacked top→down, left-aligned
 * so their interior clusters align in X by `ctx.columnX`); leaf clusters pack per
 * shared-column below the lanes. Returns the content extent `{right, bottom}`
 * (before pad). Shared by `arrangeSubtreeOnAxis` (a container's children) and
 * `arrangeSwimlaneGroup` (one SCC group's members).
 */
/** Min shared-column index over a lane's descendant leaf clusters (or 0). */
function laneMinColumn(lane: CompoundNode, ctx: LaneContext): number {
  const leaves: CompoundNode[] = [];
  collectClusterLeaves(lane, leaves);
  let min = Number.POSITIVE_INFINITY;
  for (const l of leaves) {
    const c = ctx.colByCluster.get(l.cluster!.id) ?? 0;
    if (c < min) {
      min = c;
    }
  }
  return Number.isFinite(min) ? min : 0;
}

/** Shift a node's DIRECT children in X by `dx` (descendants follow via the
 * hierarchical box.x + origin globalize, so only the direct children move). */
function translateChildrenX(node: CompoundNode, dx: number): void {
  for (const child of node.children) {
    if (child.box) {
      child.box = { ...child.box, x: child.box.x + dx };
    }
  }
}

type PlacedInterval = { x: number; y: number; w: number; h: number };

function placeLeafAtSharedColumn(
  leaf: CompoundNode,
  ctx: LaneContext,
  originX: number,
  placed: readonly PlacedInterval[],
  startY: number,
): void {
  const col = ctx.colByCluster.get(leaf.cluster!.id) ?? 0;
  const x = originX + (ctx.columnX[col] ?? 0);
  const width = leaf.box?.width ?? 0;
  const height = leaf.box?.height ?? 0;
  const y = riseStackY(x, width, placed, startY, true);
  leaf.box = { x, y, width, height };
}

function applyStraighteningWithOccupancy(
  leaves: readonly CompoundNode[],
  ctx: LaneContext,
  segmentTop: number,
  occupied: readonly PlacedInterval[],
): void {
  if (!ctx.straighten || leaves.length === 0) {
    return;
  }
  const ordered = leaves.filter((leaf) => leaf.cluster && leaf.box);
  const items: StraightenLeaf[] = ordered.map((leaf, i) => ({
    key: leaf.key,
    clusterId: leaf.cluster!.id,
    col: ctx.colByCluster.get(leaf.cluster!.id) ?? 0,
    height: leaf.box!.height ?? 0,
    order: i,
  }));
  const y = straightenColumns(
    items,
    ctx.fanout,
    ctx.fanin,
    segmentTop,
    PIPELINE_CLUSTER_GAP_Y,
  );
  const placed: PlacedInterval[] = [...occupied];
  for (const leaf of ordered) {
    const proposed = y.get(leaf.key);
    if (proposed == null || !leaf.box) {
      continue;
    }
    const targetY = riseStackY(
      leaf.box.x,
      leaf.box.width,
      placed,
      Math.max(segmentTop, proposed),
      true,
    );
    leaf.box = { ...leaf.box, y: targetY };
    placed.push({
      x: leaf.box.x,
      y: leaf.box.y,
      w: leaf.box.width,
      h: leaf.box.height,
    });
  }
}

function layoutLanesOnAxis(
  nodes: readonly CompoundNode[],
  ctx: LaneContext,
  originX: number,
  originY: number,
): { right: number; bottom: number } {
  // M6c: lanes (sub-hulls) order by the crossing-min override (Y only; each lane keeps
  // its content shared-column X). Empty override ⇒ model order (byte-identical).
  const lanes = nodes
    .filter((c) => c.children.length > 0)
    .sort(preferredOrder(ctx.orderOverride));
  let cursorY = originY;
  const placed: PlacedInterval[] = [];
  // M4 (CON-12-safe swimlane lane rise): tighten each lane's frame to its content
  // shared-column range (leaves keep absolute X — forwardness intact) so X-disjoint
  // lanes can RISE to share Y rows instead of pure Y-stacking.
  if (ctx.riseLanes) {
    for (const lane of lanes) {
      const minCol = laneMinColumn(lane, ctx);
      const shift = ctx.columnX[minCol] ?? 0;
      const oldWidth = lane.box?.width ?? 0;
      const gw = Math.max(0, oldWidth - shift);
      const gx = originX + shift;
      const gy = riseStackY(gx, gw, placed, originY, true);
      translateChildrenX(lane, -shift);
      lane.box = { x: gx, y: gy, width: gw, height: lane.box?.height ?? 0 };
      placed.push({
        x: gx,
        y: gy,
        w: gw,
        h: lane.box.height ?? 0,
      });
    }
    cursorY = placed.reduce((m, p) => Math.max(m, p.y + p.h), originY);
    if (placed.length > 0) {
      cursorY += PIPELINE_CLUSTER_GAP_Y;
    }
  } else {
    for (const lane of lanes) {
      lane.box = {
        x: originX,
        y: cursorY,
        width: lane.box?.width ?? 0,
        height: lane.box?.height ?? 0,
      };
      placed.push({
        x: lane.box.x,
        y: lane.box.y,
        w: lane.box.width,
        h: lane.box.height,
      });
      cursorY += (lane.box.height ?? 0) + PIPELINE_CLUSTER_GAP_Y;
    }
  }
  // M6: within-column leaf order — barycenter reorder (strict-improve gated) when
  // ctx.reorder, else model order. The shared `colByCluster` axis is the column.
  const leafNodes = nodes.filter((c) => c.children.length === 0);
  const leaves = laneLeafOrder(leafNodes, ctx);
  if (ctx.straighten) {
    const leafOccupancy: PlacedInterval[] = [...placed];
    for (const leaf of leaves) {
      placeLeafAtSharedColumn(leaf, ctx, originX, leafOccupancy, originY);
      leafOccupancy.push({
        x: leaf.box!.x,
        y: leaf.box!.y,
        w: leaf.box!.width,
        h: leaf.box!.height,
      });
    }
    applyStraighteningWithOccupancy(leaves, ctx, originY, placed);
    const childBoxes = new Map<string, TerraformDependencyLayoutBox>();
    for (const n of nodes) {
      childBoxes.set(n.key, n.box!);
    }
    const bb = boundsOf(
      nodes.map((c) => c.key),
      childBoxes,
    );
    return { right: bb ? bb.x + bb.width : 0, bottom: bb ? bb.y + bb.height : 0 };
  }
  const colCursor = new Map<number, number>();
  for (const leaf of leaves) {
    const col = ctx.colByCluster.get(leaf.cluster!.id) ?? 0;
    const x = originX + (ctx.columnX[col] ?? 0);
    const y = colCursor.get(col) ?? cursorY;
    leaf.box = {
      x,
      y,
      width: leaf.box?.width ?? 0,
      height: leaf.box?.height ?? 0,
    };
    colCursor.set(col, y + (leaf.box.height ?? 0) + PIPELINE_CLUSTER_GAP_Y);
  }
  // M5 (A1): straighten the leaf Y on the shared swimlane axis (column =
  // colByCluster). Runs after the provisional stack + M6 order, before the bbox.
  applyStraightening(
    leaves,
    (leaf) => ctx.colByCluster.get(leaf.cluster!.id) ?? 0,
    cursorY,
    ctx.straighten,
    ctx.fanout,
    ctx.fanin,
  );
  const childBoxes = new Map<string, TerraformDependencyLayoutBox>();
  for (const n of nodes) {
    childBoxes.set(n.key, n.box!);
  }
  const bb = boundsOf(
    nodes.map((c) => c.key),
    childBoxes,
  );
  return { right: bb ? bb.x + bb.width : 0, bottom: bb ? bb.y + bb.height : 0 };
}

/**
 * Lay one subtree onto a shared column axis `ctx` (recursive). The node's
 * footprint box is set at local origin `(0,0)`; its children become Y-lanes /
 * packed leaves on `ctx`. This is the *member body* of a swimlane group: every
 * descendant leaf sits at its shared-column X, so cross-member dataflow reads
 * forward across vertically-separated lanes (no backward, no same-column edge).
 */
function arrangeSubtreeOnAxis(node: CompoundNode, ctx: LaneContext): void {
  if (node.children.length === 0) {
    node.box = {
      x: 0,
      y: 0,
      width: node.cluster?.build.width ?? 0,
      height: node.cluster?.build.height ?? 0,
    };
    return;
  }
  for (const child of node.children) {
    arrangeSubtreeOnAxis(child, ctx);
  }
  const titleReserve = rendersTitledFrame(node.role)
    ? PIPELINE_FRAME_TITLE_HEIGHT
    : 0;
  const { right, bottom } = layoutLanesOnAxis(
    node.children,
    ctx,
    PIPELINE_FRAME_PAD,
    titleReserve + PIPELINE_FRAME_PAD,
  );
  node.box = {
    x: 0,
    y: 0,
    width: right + PIPELINE_FRAME_PAD,
    height: bottom + PIPELINE_FRAME_PAD,
  };
}

/**
 * **Swimlane** placement for a multi-hull SCC group (DEC-8(C) refined). The
 * members are mutually dependent (a genuine 2-way hull cycle), so they MUST share
 * ONE column axis (`denseRank(LB)` over the group's clusters) — only on a shared
 * axis do cross-member resource edges read forward (CON-12). Members lose their
 * independent banding by necessity; that is the swimlane. The group occupies
 * local `[0,width] × [0,height]` (normalized at the origin), so the staircase can
 * place it with a single translation. Returns the normalized rigid box.
 */
function arrangeSwimlaneGroup(
  members: readonly CompoundNode[],
  pctx: PlaceCtx,
): { width: number; height: number } {
  const ctx = buildLaneContext(
    members,
    pctx.floor,
    pctx.swimlaneLaneRise,
    pctx.reorder,
    pctx.straighten,
    pctx.fanout,
    pctx.fanin,
    pctx.deDensify,
    pctx.deDensifyMaxCols,
    pctx.orderOverride,
  );
  // M5c (Axis-2 A): pull SAFE independent leaves LEFT into earlier-column whitespace to
  // shrink width. Measure-driven — `compactColumns` accepts a move only if re-placing a
  // CLONE for the trial column map does not grow the hull width or any inner frame height
  // (the slack is observed, not guessed). Mutually exclusive with de-density (`ctx` here
  // is the dense-rank axis since `deDensify` is false whenever `columnCompact` is true).
  let placeCtx = ctx;
  if (pctx.columnCompact) {
    const leaves: CompoundNode[] = [];
    for (const m of members) {
      collectClusterLeaves(m, leaves);
    }
    const laneFlags = {
      riseLanes: pctx.swimlaneLaneRise,
      reorder: pctx.reorder,
      straighten: pctx.straighten,
      fanout: pctx.fanout,
      fanin: pctx.fanin,
      orderOverride: pctx.orderOverride,
    };
    // `cluster.id` keys are shared between members and their clones (cloneNode keeps
    // cluster refs), so a trial map drives both the geometry (via original `leaves`,
    // whose `cluster.build.width` is identical) and the placement of fresh clones.
    const measure = (trial: ReadonlyMap<string, number>): ColumnCompactMeasure => {
      const trialCtx = laneContextFromColMap(leaves, trial, laneFlags);
      const clones = members.map((m) => cloneNode(m));
      for (const c of clones) {
        arrangeSubtreeOnAxis(c, trialCtx);
      }
      const { right } = layoutLanesOnAxis(clones, trialCtx, 0, 0);
      const nodeHeights = new Map<string, number>();
      for (const c of clones) {
        collectHeights(c, nodeHeights);
      }
      return { width: right, nodeHeights };
    };
    const compacted = compactColumns(
      leaves.map((l) => ({
        clusterId: l.cluster!.id,
        firstSequence: l.cluster!.firstSequence,
      })),
      ctx.colByCluster,
      pctx.fanout,
      pctx.fanin,
      measure,
    );
    if (pctx.columnCompactStats) {
      pctx.columnCompactStats.moved += compacted.movedCount;
      pctx.columnCompactStats.reclaimedCols += compacted.reclaimedCols;
      pctx.columnCompactStats.evalCapReached ||= compacted.evalCapReached;
    }
    placeCtx = laneContextFromColMap(leaves, compacted.colByCluster, laneFlags);
  }
  for (const m of members) {
    arrangeSubtreeOnAxis(m, placeCtx);
  }
  const { right, bottom } = layoutLanesOnAxis(members, placeCtx, 0, 0);
  return { width: right, height: bottom };
}

/** One placed SCC group (rigid box + staircase column + tiebreak keys). */
type SccGroup = {
  rep: string;
  members: readonly CompoundNode[];
  width: number;
  height: number;
  col: number;
  minSeq: number;
  /** M6c within-column placement order key = min override rank over members (else
   * minSeq). Reorders same-staircase-column groups in Y; X (`col`) is untouched. */
  ord: number;
};

/**
 * DEC-1 Y-rise: the lowest `y ≥ startY` at which a group of width `gw` at column-X
 * `gx` does not 2D-overlap an already-placed group. Groups at different staircase
 * columns are X-disjoint (width-aware `columnOffsetsFromWidths`), so they rise to
 * share a row; same-column groups stack. Each group footprint already reserves its
 * members' titles (DI-M3a-8), so a positive gap keeps derived frames + titles
 * disjoint. `staircaseOverlap === false` → a single sequential cursor (no rise).
 */
function riseStackY(
  gx: number,
  gw: number,
  placed: readonly { x: number; y: number; w: number; h: number }[],
  startY: number,
  staircaseOverlap: boolean,
): number {
  let y = startY;
  for (const p of placed) {
    const xOverlap = staircaseOverlap ? gx < p.x + p.w && p.x < gx + gw : true;
    if (xOverlap) {
      y = Math.max(y, p.y + p.h + PIPELINE_CLUSTER_GAP_Y);
    }
  }
  return y;
}

/**
 * **Hull-placement decision matrix** (DEC-8(C) refined M3b). The cyclic container's
 * hull graph `D_H` is decomposed into its strongly-connected components and each
 * child placed by **edge directionality**:
 *
 *   - **Multi-member SCC** (a mutual cycle `A↔B` or longer `A→B→C→A`) → ONE
 *     **swimlane** (`arrangeSwimlaneGroup`): shared X axis, members as Y-lanes.
 *   - **Singleton SCC** (no mutual cycle) → recurse via `sizeAndArrange` (applies the
 *     M3a forced/packed/mixed policy, or re-enters this matrix at a nested cyclic
 *     container), keeping its own structure.
 *
 * The **condensation** (one-way edges between SCC groups) is a DAG, placed as a
 * **staircase** in X (longest-path + width-aware offsets, CON-6) with a **DEC-1
 * Y-rise** (`riseStackY`) so X-disjoint groups share rows — collapsing the
 * single-axis Y-stack that dominated height. A container with **no internal hull
 * edge** ⇒ all groups at column 0 ⇒ a tight vertical stack ("no edge → share
 * column"). The cluster graph `D` is acyclic, so cross-group resource edges read
 * forward by the width-aware staircase, and within-swimlane edges read forward by
 * the shared `LB` axis (CON-12 holds).
 *
 * **Reach:** invoked for cyclic containers (the matrix's swimlane/staircase split is
 * only needed when `D_H` cycles). Acyclic containers use the M3a forced/packed/mixed
 * policies, which on every measured preset produce the same placement this matrix
 * would (longest-path columns + per-column stacking) — see §34.2. The M4 swimlane
 * lane-rise (`ctx.swimlaneLaneRise`) is applied INSIDE this path via `layoutLanesOnAxis`.
 */
function arrangeByHullMatrix(node: CompoundNode, ctx: PlaceCtx): void {
  const childKeys = node.children.map((c) => c.key);
  const edges = ctx.hullEdges.get(node.key) ?? [];
  const rep = stronglyConnectedComponents(childKeys, edges);

  // Group children by SCC representative (children stay in model order).
  const membersByRep = new Map<string, CompoundNode[]>();
  for (const child of node.children) {
    const r = rep.get(child.key) ?? child.key;
    const list = membersByRep.get(r);
    if (list) {
      list.push(child);
    } else {
      membersByRep.set(r, [child]);
    }
  }

  // Size each SCC group as a normalized rigid box at local origin (0,0).
  const groups: SccGroup[] = [];
  for (const [r, members] of membersByRep) {
    let width = 0;
    let height = 0;
    if (members.length === 1) {
      sizeAndArrange(members[0]!, ctx); // singleton: full policy + nested cycles
      width = members[0]!.box?.width ?? 0;
      height = members[0]!.box?.height ?? 0;
    } else {
      const g = arrangeSwimlaneGroup(members, ctx);
      width = g.width;
      height = g.height;
    }
    const minSeq = members.reduce(
      (m, c) => Math.min(m, c.minDescendantSequence),
      Number.POSITIVE_INFINITY,
    );
    const ord =
      ctx.orderOverride.size > 0
        ? members.reduce(
            (m, c) =>
              Math.min(m, ctx.orderOverride.get(c.key) ?? Number.POSITIVE_INFINITY),
            Number.POSITIVE_INFINITY,
          )
        : minSeq;
    groups.push({ rep: r, members, width, height, col: 0, minSeq, ord });
  }

  // Condensation DAG → group columns (longest-path; rank = group minSeq).
  const condSeen = new Set<string>();
  const condEdges: { from: string; to: string }[] = [];
  for (const e of edges) {
    const rf = rep.get(e.from) ?? e.from;
    const rt = rep.get(e.to) ?? e.to;
    if (rf !== rt) {
      const k = `${rf}\u0001${rt}`;
      if (!condSeen.has(k)) {
        condSeen.add(k);
        condEdges.push({ from: rf, to: rt });
      }
    }
  }
  const minSeqByRep = new Map(groups.map((g) => [g.rep, g.minSeq]));
  const { column } = longestPath(
    groups.map((g) => g.rep),
    condEdges,
    (k) => minSeqByRep.get(k) ?? 0,
  );
  for (const g of groups) {
    g.col = column.get(g.rep) ?? 0;
  }

  // Width-aware staircase X: per-column max group width (CON-6 absolute-coord
  // forwardness — group col k+1 starts fully right of every box in col k).
  const maxCol = groups.reduce((m, g) => Math.max(m, g.col), 0);
  const colWidth = new Array<number>(maxCol + 1).fill(0);
  for (const g of groups) {
    colWidth[g.col] = Math.max(colWidth[g.col]!, g.width);
  }
  const columnX = columnOffsetsFromWidths(colWidth, 0, PIPELINE_COLUMN_GAP);

  // Canonical placement order: (col, M6c ord, minSeq, rep) — deterministic (CON-8).
  // `ord` == minSeq when no override, so this is byte-identical OFF; under M6c it
  // reorders same-column groups in Y (X by `col` is untouched, so CON-12 holds).
  groups.sort(
    (a, b) =>
      a.col - b.col ||
      a.ord - b.ord ||
      a.minSeq - b.minSeq ||
      a.rep.localeCompare(b.rep),
  );

  const titleReserve = rendersTitledFrame(node.role)
    ? PIPELINE_FRAME_TITLE_HEIGHT
    : 0;
  const areaX = PIPELINE_FRAME_PAD;
  const areaY = titleReserve + PIPELINE_FRAME_PAD;

  // Place groups: staircase X + DEC-1 Y-rise; translate members (local origin 0).
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  for (const g of groups) {
    const gx = areaX + (columnX[g.col] ?? 0);
    const gy = riseStackY(gx, g.width, placed, areaY, ctx.staircaseOverlap);
    for (const m of g.members) {
      const b = m.box!;
      m.box = { x: b.x + gx, y: b.y + gy, width: b.width, height: b.height };
    }
    placed.push({ x: gx, y: gy, w: g.width, h: g.height });
  }

  const childBoxes = new Map<string, TerraformDependencyLayoutBox>();
  for (const child of node.children) {
    childBoxes.set(child.key, child.box!);
  }
  const bb = boundsOf(
    node.children.map((c) => c.key),
    childBoxes,
  );
  node.box = {
    x: 0,
    y: 0,
    width: bb ? bb.x + bb.width + PIPELINE_FRAME_PAD : 0,
    height: bb ? bb.y + bb.height + PIPELINE_FRAME_PAD : 0,
  };
}

/**
 * Size + locally arrange one node (post-order). Sets `node.box` with **local**
 * x/y (relative to the node's own footprint top-left; the parent assigns the real
 * x/y) and the footprint width/height. Leaves take their card size.
 *
 * A non-root container whose `D_H` is **cyclic** is handled by
 * `arrangeCyclicContainer` (DEC-8(C) refined): its hull graph is decomposed into
 * SCCs — multi-hull SCC → swimlane (shared axis), one-way condensation → staircase
 * + DEC-1 Y-rise. Singleton SCC members recurse back through here, so nested cyclic
 * containers are handled at their own level (not flattened by an ancestor).
 */
function sizeAndArrange(node: CompoundNode, ctx: PlaceCtx): void {
  if (node.children.length === 0) {
    const w = node.cluster?.build.width ?? 0;
    const h = node.cluster?.build.height ?? 0;
    node.box = { x: 0, y: 0, width: w, height: h };
    return;
  }

  if (ctx.cyclic.has(node.key) && node.key !== RCLL_ROOT_KEY) {
    arrangeByHullMatrix(node, ctx);
    return;
  }

  for (const child of node.children) {
    sizeAndArrange(child, ctx);
  }

  const columnX = columnOffsetsFromWidths(
    columnWidths(node.children),
    0,
    PIPELINE_COLUMN_GAP,
  );
  const titleReserve = rendersTitledFrame(node.role)
    ? PIPELINE_FRAME_TITLE_HEIGHT
    : 0;
  const isRoot = node.key === RCLL_ROOT_KEY;
  const areaX = isRoot ? 0 : PIPELINE_FRAME_PAD;
  const areaY = isRoot ? 0 : titleReserve + PIPELINE_FRAME_PAD;

  const policy = policyForContainer(node.role);
  if (policy === "passthrough") {
    // root: providers at column X, all at Y = areaY; reanchor stacks them (A3).
    for (const child of node.children) {
      const col = child.localColumn ?? 0;
      child.box = {
        x: areaX + (columnX[col] ?? 0),
        y: areaY,
        width: child.box?.width ?? 0,
        height: child.box?.height ?? 0,
      };
    }
  } else if (policy === "forced") {
    placeForcedBands(node.children, columnX, areaX, areaY, ctx.orderOverride);
  } else if (policy === "mixed") {
    // vpc: subnet-zone sub-hulls forced into bands, then vpc-direct leaves packed
    // in a block below — disjoint Y regions so the two groups never overlap.
    // Classify by ROLE, not child count: an *empty* subnet-zone (a sub-hull with
    // no children) must still be banded, not packed among the vpc-direct leaves.
    const containerKids = node.children.filter(
      (c) => c.role !== "primaryCluster",
    );
    const leafKids = node.children.filter((c) => c.role === "primaryCluster");
    const afterBands = placeForcedBands(
      containerKids,
      columnX,
      areaX,
      areaY,
      ctx.orderOverride,
    );
    placePackedColumns(leafKids, columnX, areaX, afterBands, ctx);
  } else {
    placePackedColumns(node.children, columnX, areaX, areaY, ctx);
  }

  // Footprint = children bbox + right/bottom PAD (left/top already padded via area).
  const childBoxes = new Map<string, TerraformDependencyLayoutBox>();
  for (const child of node.children) {
    childBoxes.set(child.key, child.box!);
  }
  const bb = boundsOf(
    node.children.map((c) => c.key),
    childBoxes,
  );
  const width = bb ? bb.x + bb.width + PIPELINE_FRAME_PAD : 0;
  const height = bb ? bb.y + bb.height + PIPELINE_FRAME_PAD : 0;
  node.box = { x: 0, y: 0, width, height };
}

/** Pre-order: convert each node's local box to a global box (parent origin + local),
 * snapped to 1px (coordRoundingPx, §30). */
function globalize(node: CompoundNode, originX: number, originY: number): void {
  const gx = Math.round((node.box?.x ?? 0) + originX);
  const gy = Math.round((node.box?.y ?? 0) + originY);
  node.box = {
    x: gx,
    y: gy,
    width: Math.round(node.box?.width ?? 0),
    height: Math.round(node.box?.height ?? 0),
  };
  for (const child of node.children) {
    globalize(child, gx, gy);
  }
}

/**
 * Place the whole compound tree: clone (preserving `localColumn`), size + arrange
 * bottom-up, then globalize top-down. Pure (§22.1) — input tree never mutated.
 */
export function layoutPlacement(
  tree: CompoundNode,
  lattice: Lattice,
  opts?: RcllOptions,
  columnCompactStats?: ColumnCompactStats,
  orderOverride?: ReadonlyMap<string, number>,
): CompoundNode {
  const ctx: PlaceCtx = {
    cyclic: lattice.cyclicContainers ?? new Set<string>(),
    floor: lattice.floor ?? new Map<string, number>(),
    hullEdges: lattice.hullEdges ?? new Map<string, readonly HullEdge[]>(),
    staircaseOverlap: opts?.staircaseBandOverlap !== false,
    swimlaneLaneRise: opts?.swimlaneLaneRise === true,
    reorder: opts?.reorder === true,
    straighten: opts?.straighten === true,
    deDensify: opts?.deDensify === true,
    deDensifyMaxCols: opts?.deDensifyMaxCols ?? 0,
    columnCompact: opts?.columnCompact === true,
    columnCompactStats,
    deBandLevel: opts?.deBandLevel ?? "none",
    fanout: lattice.fanout ?? new Map<string, readonly string[]>(),
    fanin: lattice.fanin ?? new Map<string, readonly string[]>(),
    orderOverride: orderOverride ?? new Map<string, number>(),
  };
  const root = cloneNode(tree);
  if (ctx.deBandLevel !== "none") {
    collapseTreeForDeBand(root, ctx.deBandLevel);
  }
  sizeAndArrange(root, ctx);
  globalize(root, 0, 0);
  return root;
}

/** Flatten boxed tree → `key → box` (for meta + tests). */
function boxByKey(
  tree: CompoundNode,
): Map<string, TerraformDependencyLayoutBox> {
  const out = new Map<string, TerraformDependencyLayoutBox>();
  const walk = (n: CompoundNode): void => {
    if (n.box) {
      out.set(n.key, n.box);
    }
    for (const c of n.children) {
      walk(c);
    }
  };
  walk(tree);
  return out;
}

/** True iff `inner` is fully inside `outer` (allowing equality). */
function contains(
  outer: TerraformDependencyLayoutBox,
  inner: TerraformDependencyLayoutBox,
): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Strict 2D-rectangle overlap of two boxes (X AND Y intervals both overlap). */
function boxesOverlap2D(
  a: TerraformDependencyLayoutBox,
  b: TerraformDependencyLayoutBox,
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/**
 * Scalar acceptance metrics for the placed tree (§13 gates, model-level — the
 * final-scene collision gate runs separately in the builder on the elements, with
 * the typed region/subnet/frame-title breakdown).
 * - `containmentViolations`: a child box not inside its parent box (CON-3); 0.
 * - `siblingOverlapViolations`: a pair of a container's children that **2D-overlap**
 *   (X AND Y). Policy-agnostic — covers forced bands, packed columns, swimlane
 *   lanes, AND risen SCC groups uniformly. The DEC-1 Y-rise is legal precisely
 *   because risen groups stay X-disjoint, so it does NOT count here (the old
 *   forced-only Y-overlap check wrongly flagged it). Must be 0 (CON-4/CON-5).
 */
export function placementMeta(
  tree: CompoundNode,
  lattice: Lattice,
): Record<string, number> {
  const cyclic = lattice.cyclicContainers ?? new Set<string>();
  let containmentViolations = 0;
  let siblingOverlapViolations = 0;
  let placedLeafCount = 0;
  let maxWidthPx = 0;
  let maxDepthPx = 0;
  // M5: leaf cluster id → placed box centre-Y, for the model-level centering gate
  // (deterministic + mode-independent, unlike the rendered frame-address gate).
  const centerYById = new Map<string, number>();

  const walk = (node: CompoundNode): void => {
    if (node.box) {
      maxWidthPx = Math.max(maxWidthPx, node.box.x + node.box.width);
      maxDepthPx = Math.max(maxDepthPx, node.box.y + node.box.height);
    }
    if (node.children.length === 0) {
      placedLeafCount += 1;
      if (node.cluster && node.box) {
        centerYById.set(node.cluster.id, node.box.y + node.box.height / 2);
      }
      return;
    }
    for (const child of node.children) {
      if (node.box && child.box && !contains(node.box, child.box)) {
        containmentViolations += 1;
      }
    }
    for (let i = 0; i < node.children.length; i++) {
      for (let j = i + 1; j < node.children.length; j++) {
        const a = node.children[i]!.box;
        const b = node.children[j]!.box;
        if (a && b && boxesOverlap2D(a, b)) {
          siblingOverlapViolations += 1;
        }
      }
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(tree);

  // M5 acceptance gate: hub-centering rate over the placed leaf boxes. Uses the
  // lattice fan-out/fan-in adjacency + the shared median/epsilon, so it agrees
  // with the rendered diagnostic on even fan-out but never goes blind (it reads
  // boxes, not frame customData). epsilon = PIPELINE_CLUSTER_GAP_Y (== rendered).
  const centering = hubCenteringOverBoxes(
    centerYById,
    lattice.fanout ?? new Map(),
    lattice.fanin ?? new Map(),
    PIPELINE_CLUSTER_GAP_Y,
  );

  return {
    containmentViolations,
    siblingOverlapViolations,
    placedLeafCount,
    maxWidthPx: Math.round(maxWidthPx),
    maxDepthPx: Math.round(maxDepthPx),
    cyclicContainerCount: cyclic.size,
    hubCount: centering.hubCount,
    hubCenteringRate: centering.rate,
  };
}

/**
 * The **iron rule** (CON-12), measured on the placed boxes — works in BOTH Compact
 * and Full (boxes exist regardless of frame tagging, unlike the rendered
 * `semanticEdgeViolations`, which goes blind in Full when primary-cluster frames
 * carry no `terraformPrimaryAddress`).
 *
 * The rule has **two** halves, both keyed off the **left edge** of each box (the
 * column indicator — `centerX` is ambiguous because cards in one column have
 * different widths). For every collapsed TFD edge `u→v`, with `dx = x(v) − x(u)`:
 * - `dx ≥ +EPS` → **forward** (a real column step right) — fine.
 * - `dx ≤ −EPS` → **backward** — `v` reads left of `u`.
 * - `|dx| < EPS` → **same column** — `u` and `v` occupy the same column.
 *
 * Both backward and same-column violate the iron rule and are classified by whether
 * the edge belongs to a **genuine cluster-graph `D` cycle** — i.e. its two clusters
 * share a strongly-connected component of `D` (the real resource cycle, CON-2). This
 * is RE-BASED off the cluster graph, NOT off "the LCA container is cyclic": after the
 * M3b hull-aware redesign most resource edges have a cyclic *container* as their LCA
 * (the whole provider is one cyclic container on v2), so an LCA-keyed excusal would
 * silently excuse every cross-group edge and the gate would go blind. `D` is acyclic
 * on v2 ⇒ **zero** excused ⇒ the hard gate covers every edge.
 * - `acyclic*` — MUST be **0** (the hard gate). The width-aware SCC-group staircase
 *   (cross-group) + the shared swimlane axis (within a group) guarantee forwardness.
 * - `cyclic*` — excused + counted (a true `D` cycle has no fully-forward drawing),
 *   drawn as explicit back-edges (EXT-12).
 */
export function backwardEdgeGate(
  boxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
  collapsedEdges: readonly CollapsedPipelineEdge[],
  clusters: readonly PipelineCluster[],
): {
  acyclicBackwardEdges: number;
  cyclicBackwardEdges: number;
  acyclicSameColumnEdges: number;
  cyclicSameColumnEdges: number;
} {
  // Genuine cluster-level cycles: an edge is excused iff its endpoints share a
  // strongly-connected component of the CLUSTER graph `D` (CON-2) — not because
  // their LCA topology container is cyclic (a spurious hull cycle, dissolved by the
  // SCC-aware placement). On v2 `D` is acyclic ⇒ every cluster is its own singleton
  // SCC ⇒ nothing is excused.
  const repD = stronglyConnectedComponents(
    clusters.map((c) => c.id),
    collapsedEdges.map((e) => ({ from: e.source, to: e.target })),
  );
  // Half a column gap separates "same column" from a real forward/backward step:
  // adjacent columns' left edges differ by ≥ `colWidth + PIPELINE_COLUMN_GAP`, while
  // same-column clusters differ only by accumulated nesting pad (a few
  // `PIPELINE_FRAME_PAD`). Read inside the function — a module-top-level const would
  // bind `PIPELINE_COLUMN_GAP` during a circular-import dead zone (→ NaN threshold).
  const sameColumnEps = PIPELINE_COLUMN_GAP / 2;
  let acyclicBackward = 0;
  let cyclicBackward = 0;
  let acyclicSameCol = 0;
  let cyclicSameCol = 0;
  for (const e of collapsedEdges) {
    const bs = boxes.get(e.source);
    const bt = boxes.get(e.target);
    if (!bs || !bt) {
      continue;
    }
    const dx = bt.x - bs.x;
    if (dx >= sameColumnEps) {
      continue; // forward — fine
    }
    const isCyclic =
      repD.get(e.source) !== undefined &&
      repD.get(e.source) === repD.get(e.target);
    if (dx <= -sameColumnEps) {
      isCyclic ? (cyclicBackward += 1) : (acyclicBackward += 1);
    } else {
      isCyclic ? (cyclicSameCol += 1) : (acyclicSameCol += 1);
    }
  }
  return {
    acyclicBackwardEdges: acyclicBackward,
    cyclicBackwardEdges: cyclicBackward,
    acyclicSameColumnEdges: acyclicSameCol,
    cyclicSameColumnEdges: cyclicSameCol,
  };
}

/** Re-export for tests. */
export { boxByKey };

/**
 * Stage 1d/2 (§22): place the tree (first geometry) and report model gate metrics.
 * Pure transform — returns a new tree, never mutates the input.
 */
export function placementStage(
  tree: CompoundNode,
  lattice: Lattice,
  opts: RcllOptions,
): StageResult {
  // `rankSeparate` (RFC §9.6 / DEC-13): whole-model-global Sander layering. Compute the
  // separated floor ONCE over ALL leaves + ALL leaf edges (Codex: lane-local is not
  // truly global), then place with that floor in place of the base `floor`. Observable
  // fallback: `pairCount===0` / `augmented-cycle` keep the base floor (OFF byte-identical).
  let effLattice = lattice;
  let rankSeparate: RankSeparateMeta | undefined;
  if (opts?.rankSeparate === true) {
    rankSeparate = computeGlobalSeparatedFloor(
      tree,
      lattice.floor ?? new Map<string, number>(),
      lattice.fanout ?? new Map<string, readonly string[]>(),
      lattice.hullEdges ?? new Map<string, readonly HullEdge[]>(),
    );
    effLattice = { ...lattice, floor: rankSeparate.floor };
  }
  // M5c column compaction: accumulate stats across all swimlane groups, surface as
  // `rcllStageMeta.placement.columnCompact*` (same convention as `rankSeparate*`).
  const columnCompactStats: ColumnCompactStats | undefined =
    opts?.columnCompact === true
      ? { moved: 0, reclaimedCols: 0, evalCapReached: false }
      : undefined;

  // M6c container-aware crossing minimization (RFC §7.2c / §9.5). Measure-driven: the
  // search re-places clones for candidate sibling orders and accepts on the RENDERED
  // crossing count (`countPlacedCrossings`, the box-coordinate analogue of
  // `diagnosePipelineScene`). X is order-independent, so only Y moves (CON-12 untouched).
  // OFF (or no improvement) ⇒ the empty override ⇒ byte-identical to today's placement.
  let placed: CompoundNode;
  let crossingMin: CrossingMinResult | undefined;
  const placeWith = (
    override: ReadonlyMap<string, number>,
    stats?: ColumnCompactStats,
  ): CompoundNode => layoutPlacement(tree, effLattice, opts, stats, override);

  if (opts?.crossingMin === true) {
    const edges = collapsedEdgesFromFanout(
      effLattice.fanout ?? new Map<string, readonly string[]>(),
    );
    const search = minimizeCrossings(
      edges,
      (override) => placeWith(override),
      (t) => {
        const m = placementMeta(t, effLattice);
        return {
          containment: m.containmentViolations,
          overlap: m.siblingOverlapViolations,
          width: m.maxWidthPx,
          height: m.maxDepthPx,
        };
      },
    );
    crossingMin = search.result;
    // Re-place the accepted order WITH the real columnCompact accumulator so its stats
    // reflect the chosen geometry (the search trials run without accumulating). The
    // override is deterministic ⇒ identical geometry to `search.tree`.
    placed = placeWith(search.override, columnCompactStats);
  } else {
    placed = placeWith(new Map<string, number>(), columnCompactStats);
  }

  const meta: Record<string, number> = placementMeta(placed, effLattice);
  if (crossingMin) {
    meta.crossingMinApplied = crossingMin.applied ? 1 : 0;
    meta.crossingMinBefore = crossingMin.before;
    meta.crossingMinAfter = crossingMin.after;
    meta.crossingMinMoves = crossingMin.moves;
    meta.crossingMinHeightDeltaPx = crossingMin.heightDeltaPx;
    meta.crossingMinWidthDeltaPx = crossingMin.widthDeltaPx;
    meta.crossingMinEvalCapReached = crossingMin.evalCapReached ? 1 : 0;
  }
  if (columnCompactStats) {
    meta.columnCompactApplied = columnCompactStats.moved > 0 ? 1 : 0;
    meta.columnCompactMovedCount = columnCompactStats.moved;
    meta.columnCompactReclaimedCols = columnCompactStats.reclaimedCols;
    meta.columnCompactEvalCapReached = columnCompactStats.evalCapReached ? 1 : 0;
  }
  if (rankSeparate) {
    // Surface the observability meta for the probe/gate (read as
    // `rcllStageMeta.placement.rankSeparate*`). Scalars only (CON-8 determinism).
    meta.rankSeparateApplied = rankSeparate.applied ? 1 : 0;
    meta.rankSeparatePairCount = rankSeparate.pairCount;
    meta.rankSeparateChangedRankCount = rankSeparate.changedRankCount;
    meta.rankSeparateFallback =
      rankSeparate.fallbackReason === "none"
        ? 0
        : rankSeparate.fallbackReason === "no-pairs"
          ? 1
          : 2; // augmented-cycle
  }
  return { tree: placed, meta };
}
