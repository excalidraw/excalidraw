/**
 * RCLL (Recursive Compound Layered Layout) — Milestone M3a: Placement
 * (Stage 1d-forced / 2-frames, first geometry).
 *
 * Source of truth: docs/pipeline-rcll-layout-design.md §7.2 (recursive container
 * layout), §8 (per-level forced/packed policy), §11 (local columns), §13 (CON-3/4/5
 * gates), §22 (stage contract). M3a decisions: see RFC §34.1 DI-M3a-*.
 *
 * This is the FIRST stage that produces geometry. M2 wrote `localColumn` on every
 * node; M3a turns those columns into a global `box` per node, from which the export
 * step derives hull frames (`emitTopologyContextFrames` = `boundsOf(childBoxes)+pad`)
 * and routes arrows. No centering (M5), no row-sharing (M7), no staircase Y-overlap
 * (M3b) — this is the honest, un-compacted Sugiyama coordinate.
 *
 *   localColumn (M2) ──► columnX (per container)  ──┐
 *   tree + roles    ──► policy (forced/packed/…)  ──┼─► node.box (local) ─► globalize ─► node.box (global px)
 *   cyclicContainers ──► packed via M2's seq cols ──┘
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
  PIPELINE_CLUSTER_GAP_Y,
  PIPELINE_COLUMN_GAP,
  PIPELINE_FRAME_PAD,
} from "./terraformPipelineLayoutShared";
import {
  lcaTopologyPath,
  topologyPathForCluster,
  topologyRoleAndKeyFromPath,
} from "./terraformPipelineTopologyFrames";
import { PIPELINE_FRAME_TITLE_HEIGHT } from "./terraformPipelineTopologyGeometry";

import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";
import type {
  CollapsedPipelineEdge,
  PipelineCluster,
} from "./terraformPipelineLayoutShared";
import type {
  CompoundNode,
  Lattice,
  RcllOptions,
  RcllTopologyRole,
  StageResult,
} from "./terraformPipelineRcllTypes";

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
 * `D_H` is cyclic is handled by the **swimlane** dispatch in `sizeAndArrange`
 * (`arrangeLaneSubtree`) BEFORE policy is consulted — the spurious hull cycle
 * (up-projection of an acyclic `D` is not a DAG, §26) is dissolved onto a shared
 * cluster column axis so its interior containers become Y-lanes. This supersedes
 * the earlier "cyclic ⇒ packed + DEC-8(B) SCC shared column" (DI-M3a-12), which
 * cured backward edges by making sibling hulls SHARE a column — violating the
 * extended iron rule (no TFD edge shares a column, [CON-12]). See §26 / DEC-8(C).
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
): number {
  const ordered = [...children].sort(
    (a, b) =>
      (a.localColumn ?? 0) - (b.localColumn ?? 0) ||
      a.minDescendantSequence - b.minDescendantSequence ||
      a.key.localeCompare(b.key),
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
 * independent (X separates them). Order within a column: `(mds, key)`. */
function placePackedColumns(
  children: readonly CompoundNode[],
  columnX: readonly number[],
  areaX: number,
  startY: number,
): void {
  const ordered = [...children].sort(
    (a, b) =>
      a.minDescendantSequence - b.minDescendantSequence ||
      a.key.localeCompare(b.key),
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
}

/** A shared cluster column axis for a swimlane (cyclic) subtree. */
type LaneContext = {
  /** left-edge X per shared column (column = dense rank of cluster floor). */
  columnX: readonly number[];
  /** cluster id → shared column index (every descendant leaf of the cyclic root). */
  colByCluster: ReadonlyMap<string, number>;
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

/** Build the shared column axis for a cyclic subtree (column X from per-column
 * max cluster width over ALL of the subtree's leaves). */
function buildLaneContext(
  node: CompoundNode,
  floor: ReadonlyMap<string, number>,
): LaneContext {
  const leaves: CompoundNode[] = [];
  collectClusterLeaves(node, leaves);
  const colByCluster = denseClusterColumns(leaves, floor);
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
  return { columnX, colByCluster };
}

/**
 * **Swimlane placement** for a cyclic container subtree (DEC-8(C), §26) — the
 * resolution for a *spurious* hull cycle (the cluster graph `D` is acyclic; the
 * cycle exists only in the up-projected hull graph `D_H`, e.g. `public⇄private`
 * from a NAT edge + a reverse SG reference).
 *
 * Instead of collapsing the sibling hulls into one column (the superseded
 * DEC-8(B), which made them read same-column), the subtree's interior is
 * **dissolved onto one shared cluster column axis** (`ctx`): every descendant leaf
 * sits at its shared-column X, and each intermediate container (subnet zone / VPC)
 * becomes a **Y-lane** that spans whatever column range its own clusters occupy.
 * A subnet is therefore "one contiguous frame over multiple columns", and dataflow
 * `A→B→A` reads as forward column steps across vertically-separated lanes — no edge
 * reads backward, no edge shares a column.
 *
 * Coordinates are parent-relative (like `sizeAndArrange`), so `globalize` composes
 * them. Container children are left-aligned at `areaX` (their interior clusters
 * carry the shared column offset, so siblings align in X); leaf children are placed
 * directly at the shared column X, packed in Y per column.
 */
function arrangeLaneSubtree(node: CompoundNode, ctx: LaneContext): void {
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
    arrangeLaneSubtree(child, ctx);
  }

  const titleReserve = rendersTitledFrame(node.role)
    ? PIPELINE_FRAME_TITLE_HEIGHT
    : 0;
  const areaX = PIPELINE_FRAME_PAD; // a cyclic subtree never contains the root
  const areaY = titleReserve + PIPELINE_FRAME_PAD;

  const byModelOrder = (a: CompoundNode, b: CompoundNode): number =>
    a.minDescendantSequence - b.minDescendantSequence ||
    a.key.localeCompare(b.key);

  // Container children → disjoint Y-lanes (each spans its own column range),
  // left-aligned in X (interior clusters carry the shared columns).
  const lanes = node.children
    .filter((c) => c.children.length > 0)
    .sort(byModelOrder);
  let cursorY = areaY;
  for (const lane of lanes) {
    lane.box = {
      x: areaX,
      y: cursorY,
      width: lane.box?.width ?? 0,
      height: lane.box?.height ?? 0,
    };
    cursorY += (lane.box.height ?? 0) + PIPELINE_CLUSTER_GAP_Y;
  }

  // Leaf clusters → placed at their shared column X, packed in Y per column,
  // below the lanes (matches the §8 "mixed" reading: sub-hulls then direct leaves).
  const leaves = node.children
    .filter((c) => c.children.length === 0)
    .sort(byModelOrder);
  const colCursor = new Map<number, number>();
  for (const leaf of leaves) {
    const col = ctx.colByCluster.get(leaf.cluster!.id) ?? 0;
    const x = areaX + (ctx.columnX[col] ?? 0);
    const y = colCursor.get(col) ?? cursorY;
    leaf.box = {
      x,
      y,
      width: leaf.box?.width ?? 0,
      height: leaf.box?.height ?? 0,
    };
    colCursor.set(col, y + (leaf.box.height ?? 0) + PIPELINE_CLUSTER_GAP_Y);
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
 * A non-root container whose `D_H` is **cyclic** is dissolved onto a shared cluster
 * column axis (`arrangeLaneSubtree`, DEC-8(C)) — the outermost cyclic ancestor owns
 * the axis; nested cyclic containers inherit it (they are never reached here once
 * their ancestor took the lane branch).
 */
function sizeAndArrange(
  node: CompoundNode,
  cyclic: ReadonlySet<string>,
  floor: ReadonlyMap<string, number>,
): void {
  if (node.children.length === 0) {
    const w = node.cluster?.build.width ?? 0;
    const h = node.cluster?.build.height ?? 0;
    node.box = { x: 0, y: 0, width: w, height: h };
    return;
  }

  if (cyclic.has(node.key) && node.key !== RCLL_ROOT_KEY) {
    arrangeLaneSubtree(node, buildLaneContext(node, floor));
    return;
  }

  for (const child of node.children) {
    sizeAndArrange(child, cyclic, floor);
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
    placeForcedBands(node.children, columnX, areaX, areaY);
  } else if (policy === "mixed") {
    // vpc: subnet-zone sub-hulls forced into bands, then vpc-direct leaves packed
    // in a block below — disjoint Y regions so the two groups never overlap.
    // Classify by ROLE, not child count: an *empty* subnet-zone (a sub-hull with
    // no children) must still be banded, not packed among the vpc-direct leaves.
    const containerKids = node.children.filter(
      (c) => c.role !== "primaryCluster",
    );
    const leafKids = node.children.filter((c) => c.role === "primaryCluster");
    const afterBands = placeForcedBands(containerKids, columnX, areaX, areaY);
    placePackedColumns(leafKids, columnX, areaX, afterBands);
  } else {
    placePackedColumns(node.children, columnX, areaX, areaY);
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
): CompoundNode {
  const cyclic = lattice.cyclicContainers ?? new Set<string>();
  const floor = lattice.floor ?? new Map<string, number>();
  const root = cloneNode(tree);
  sizeAndArrange(root, cyclic, floor);
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

/** Strict Y-interval overlap of two boxes. */
function yOverlap(
  a: TerraformDependencyLayoutBox,
  b: TerraformDependencyLayoutBox,
): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Scalar acceptance metrics for the placed tree (§13 gates, model-level — the
 * final-scene collision gate runs separately in the builder on the elements).
 * - `containmentViolations`: a child box not inside its parent box (CON-3); 0.
 * - `forcedBandViolations`: a pair of sibling bands at a FORCED container that
 *   overlap in Y (CON-5, DEC-1 off ⇒ strictly disjoint); 0.
 */
export function placementMeta(
  tree: CompoundNode,
  lattice: Lattice,
): Record<string, number> {
  const cyclic = lattice.cyclicContainers ?? new Set<string>();
  let containmentViolations = 0;
  let forcedBandViolations = 0;
  let placedLeafCount = 0;
  let maxWidthPx = 0;
  let maxDepthPx = 0;

  const walk = (node: CompoundNode): void => {
    if (node.box) {
      maxWidthPx = Math.max(maxWidthPx, node.box.x + node.box.width);
      maxDepthPx = Math.max(maxDepthPx, node.box.y + node.box.height);
    }
    if (node.children.length === 0) {
      placedLeafCount += 1;
      return;
    }
    for (const child of node.children) {
      if (node.box && child.box && !contains(node.box, child.box)) {
        containmentViolations += 1;
      }
    }
    if (policyForContainer(node.role) === "forced") {
      for (let i = 0; i < node.children.length; i++) {
        for (let j = i + 1; j < node.children.length; j++) {
          const a = node.children[i]!.box;
          const b = node.children[j]!.box;
          if (a && b && yOverlap(a, b)) {
            forcedBandViolations += 1;
          }
        }
      }
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(tree);

  return {
    containmentViolations,
    forcedBandViolations,
    placedLeafCount,
    maxWidthPx: Math.round(maxWidthPx),
    maxDepthPx: Math.round(maxDepthPx),
    cyclicContainerCount: cyclic.size,
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
 * the edge's **LCA container is cyclic** (a *genuine* `D` cycle, CON-2 — spurious
 * hull cycles are dissolved into lanes, DEC-8(C), so they no longer appear here):
 * - `acyclic*` — MUST be **0** (the hard gate). The width-aware staircase + the
 *   shared lane axis guarantee every acyclic edge reads strictly forward.
 * - `cyclic*` — excused + counted (a true cycle has no fully-forward drawing),
 *   drawn as explicit back-edges (EXT-12).
 */
export function backwardEdgeGate(
  boxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
  collapsedEdges: readonly CollapsedPipelineEdge[],
  clusters: readonly PipelineCluster[],
  cyclicContainers: ReadonlySet<string>,
): {
  acyclicBackwardEdges: number;
  cyclicBackwardEdges: number;
  acyclicSameColumnEdges: number;
  cyclicSameColumnEdges: number;
} {
  const pathById = new Map<string, readonly string[]>(
    clusters.map((c) => [c.id, topologyPathForCluster(c)]),
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
    const ps = pathById.get(e.source);
    const pt = pathById.get(e.target);
    const lca = ps && pt ? lcaTopologyPath(ps, pt) : [];
    const containerKey =
      lca.length === 0
        ? RCLL_ROOT_KEY
        : topologyRoleAndKeyFromPath(lca)?.key ?? RCLL_ROOT_KEY;
    const isCyclic = cyclicContainers.has(containerKey);
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
  _opts: RcllOptions,
): StageResult {
  const placed = layoutPlacement(tree, lattice);
  return { tree: placed, meta: placementMeta(placed, lattice) };
}
