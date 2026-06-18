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
 * stacking (eng-review A3). A **cyclic** container is treated as `packed`: M2 now
 * condenses its SCCs (DEC-8(B), §26) so a cycle's members share one `localColumn`;
 * packed placement stacks same-column members in Y at one X, so no intra-cycle edge
 * renders backward (the genuine cycle wrap-edge becomes vertical). The container's
 * *acyclic* members keep distinct forward columns.
 */
export function policyForContainer(
  role: RcllTopologyRole,
  cyclic: boolean,
): Policy {
  if (cyclic) {
    return "packed";
  }
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

/**
 * Size + locally arrange one node (post-order). Sets `node.box` with **local**
 * x/y (relative to the node's own footprint top-left; the parent assigns the real
 * x/y) and the footprint width/height. Leaves take their card size.
 */
function sizeAndArrange(node: CompoundNode, cyclic: ReadonlySet<string>): void {
  if (node.children.length === 0) {
    const w = node.cluster?.build.width ?? 0;
    const h = node.cluster?.build.height ?? 0;
    node.box = { x: 0, y: 0, width: w, height: h };
    return;
  }

  for (const child of node.children) {
    sizeAndArrange(child, cyclic);
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

  const policy = policyForContainer(node.role, cyclic.has(node.key));
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
  const root = cloneNode(tree);
  sizeAndArrange(root, cyclic);
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
    if (policyForContainer(node.role, cyclic.has(node.key)) === "forced") {
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
 * The iron rule (CON-12), measured on the placed boxes — works in BOTH Compact and
 * Full (boxes exist regardless of frame tagging, unlike the rendered
 * `semanticEdgeViolations`, which goes blind in Full when primary-cluster frames
 * carry no `terraformPrimaryAddress`).
 *
 * For every collapsed TFD edge `u→v`, the edge reads **backward** when the center-X
 * of `v`'s box is left of `u`'s. A backward edge is classified by whether its **LCA
 * container is cyclic**:
 * - `acyclicBackwardEdges` — backward with an acyclic LCA. The width-aware staircase
 *   guarantees these never happen; this MUST be **0** (the hard gate). A non-zero
 *   value is a real layout bug.
 * - `cyclicBackwardEdges` — backward with a cyclic LCA. These are the irreducible
 *   cycle wrap-edges (a cycle cannot read fully left→right); **excused** + counted,
 *   to be drawn as explicit back-edges (EXT-12, deferred).
 */
export function backwardEdgeGate(
  boxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
  collapsedEdges: readonly CollapsedPipelineEdge[],
  clusters: readonly PipelineCluster[],
  cyclicContainers: ReadonlySet<string>,
): { acyclicBackwardEdges: number; cyclicBackwardEdges: number } {
  const pathById = new Map<string, readonly string[]>(
    clusters.map((c) => [c.id, topologyPathForCluster(c)]),
  );
  const centerX = (b: TerraformDependencyLayoutBox): number => b.x + b.width / 2;
  let acyclic = 0;
  let cyclic = 0;
  for (const e of collapsedEdges) {
    const bs = boxes.get(e.source);
    const bt = boxes.get(e.target);
    if (!bs || !bt) {
      continue;
    }
    if (centerX(bt) >= centerX(bs) - 1) {
      continue; // forward (or vertical) — fine
    }
    const ps = pathById.get(e.source);
    const pt = pathById.get(e.target);
    const lca = ps && pt ? lcaTopologyPath(ps, pt) : [];
    const containerKey =
      lca.length === 0
        ? RCLL_ROOT_KEY
        : topologyRoleAndKeyFromPath(lca)?.key ?? RCLL_ROOT_KEY;
    if (cyclicContainers.has(containerKey)) {
      cyclic += 1;
    } else {
      acyclic += 1;
    }
  }
  return { acyclicBackwardEdges: acyclic, cyclicBackwardEdges: cyclic };
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
