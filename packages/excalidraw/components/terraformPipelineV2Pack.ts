/**
 * Pipeline view v2 — strict column-aware skyline packer (deterministic).
 *
 * Guarantees the TFD left-to-right constraint *by construction* while keeping the
 * nested hulls overlap-free and the drawing as square as the ordering allows:
 *
 * - **X is pinned to the global TFD depth column.** Every cluster's X is
 *   `columnX[depth]` (the same monotonic global grid v1 classic uses). Since the
 *   collapsed TFD graph is a DAG, `depth(src) < depth(tgt)` for every edge, so
 *   `columnX[depth(src)] < columnX[depth(tgt)]` — strictly ordered, **zero
 *   backward edges**, no per-layout verification needed.
 * - **Column-pinned units skyline-pack in 2-D.** Each hull lays out as a rigid
 *   block spanning the depth-columns its clusters occupy. Sibling units are
 *   geometrically skyline-packed in Y ({@link dropY}): two units share a Y row
 *   when their x-extents are disjoint (side-by-side / square), otherwise they
 *   stack — overlap-free by construction.
 * - **Pure-sink fan-out bundles spill *beside* their source (elastic depth).**
 *   A set of sibling units that share a predecessor, have no edges among
 *   themselves, and emit no edge outside their own subtree is a fan-out of pure
 *   sinks (e.g. `us-east-1` → `us-west-1/2`, `us-east-2`; or DB-subnet
 *   terminals). Instead of stacking them under the tall source — which leaves
 *   the space to its right empty and makes the drawing tall — they are packed
 *   into a compact column block placed just past the source's right edge,
 *   top-aligned to fill its vertical span. Pushing a pure sink rightward is
 *   order-safe (no successor can end up to its left), so this keeps **zero
 *   backward edges** while turning tall fan-out columns into square blocks.
 *
 * The result feeds the same v1 frame/edge finishers (`emitTopologyContextFrames`,
 * `appendPipelineEdgeSkeletons`) — each hull's clusters form a contiguous,
 * rigidly-translated block, so the derived nested frames are clean and disjoint.
 *
 * Deterministic: model order (`firstSequence`) breaks every tie; no ELK, no
 * async, no randomness.
 */

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  computeGlobalColumnX,
  PIPELINE_CLUSTER_GAP_Y,
  PIPELINE_FRAME_PAD,
  PIPELINE_LANE_GAP_Y,
  PIPELINE_MARGIN,
  translateSkeleton,
} from "./terraformPipelineLayoutShared";
import {
  buildHullTree,
  classifyHullLayout,
  hullChildUnits,
  liftEdges,
  subtreeClusterIds,
} from "./terraformPipelineV2Structure";

import type {
  CollapsedPipelineEdge,
  PipelineCluster,
  PipelineLayoutPrep,
} from "./terraformPipelineLayoutShared";
import type { V2Hull, V2Unit } from "./terraformPipelineV2Structure";
import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";

export type PipelineV2PackResult = {
  skeleton: ExcalidrawElementSkeleton[];
  layoutBoxes: Map<string, TerraformDependencyLayoutBox>;
  /** Hull blocks that ended up sharing a Y row with a sibling (squareness signal). */
  sideBySideRows: number;
};

/** Gap between two stacked frame-bearing hull blocks (clears border + title). */
const HULL_GAP_Y = PIPELINE_LANE_GAP_Y;
/** Gap between two stacked leaf cluster cards inside the same hull. */
const LEAF_GAP_Y = PIPELINE_CLUSTER_GAP_Y;
/** Title band reserved at the top of each hull so its frame title clears its
 * first child (emit renders the title inside the top border). */
const HULL_TITLE_BAND = PIPELINE_FRAME_PAD * 2;
/** Wider inter-column gap (matches v1 packed's PACKED_COLUMN_GAP) so two
 * column-disjoint hulls sharing a Y row clear each other's nested frame padding
 * (region▸vpc▸subnet ≈ 3×pad per side) even when their columns are adjacent. */
const V2_COLUMN_GAP = PIPELINE_FRAME_PAD * 7;

/** A laid-out, rigid block: cluster placements relative to the block's top-left. */
type Block = {
  /** x is the absolute global column X; y is relative to this block's top (0). */
  placed: Array<{ cluster: PipelineCluster; x: number; y: number }>;
  colMin: number;
  colMax: number;
  height: number;
  minFirstSequence: number;
  /** A nested hull (frame-bearing) vs a single leaf cluster card. */
  isHull: boolean;
};

/** Stacked-gap between two adjacent blocks: wide if either is a framed hull. */
function gapBetween(aIsHull: boolean, bIsHull: boolean): number {
  return aIsHull || bIsHull ? HULL_GAP_Y : LEAF_GAP_Y;
}

/** A single leaf cluster as a trivial one-column block. */
function leafBlock(
  cluster: PipelineCluster,
  columnX: readonly number[],
): Block {
  const x = columnX[cluster.depth] ?? PIPELINE_MARGIN;
  return {
    placed: [{ cluster, x, y: 0 }],
    colMin: cluster.depth,
    colMax: cluster.depth,
    height: cluster.build.height,
    minFirstSequence: cluster.firstSequence,
    isHull: false,
  };
}

/** Absolute x-extent of a block (clusters carry absolute x; width from card). */
function blockXExtent(block: Block): { x0: number; x1: number } {
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  for (const item of block.placed) {
    x0 = Math.min(x0, item.x);
    x1 = Math.max(x1, item.x + item.cluster.build.width);
  }
  return {
    x0: Number.isFinite(x0) ? x0 : PIPELINE_MARGIN,
    x1: Number.isFinite(x1) ? x1 : PIPELINE_MARGIN,
  };
}

/** A rectangle already occupied in a hull's local frame (for geometric drop). */
type SkylineRect = { x0: number; x1: number; y1: number; isHull: boolean };

/**
 * Lowest y ≥ startY where [x0,x1) × [y, y+h) clears every placed rect (with the
 * hull/leaf stacked gap). Geometric replacement for the old column-range test —
 * it stays correct once fan-out bundles are spilled to *elastic* x positions
 * that no longer line up with the global depth columns.
 */
function dropY(
  rects: readonly SkylineRect[],
  x0: number,
  x1: number,
  h: number,
  startY: number,
  isHull: boolean,
): number {
  let y = startY;
  let moved = true;
  while (moved) {
    moved = false;
    for (const rect of rects) {
      if (x0 < rect.x1 && rect.x0 < x1 && y < rect.y1) {
        const floor = rect.y1 + gapBetween(rect.isHull, isHull);
        if (floor > y) {
          y = floor;
          moved = true;
        }
      }
    }
  }
  return y;
}

/** Translate a block's clusters by (dx, dy) — used to spill an elastic bundle. */
function shiftPlaced(block: Block, dx: number, dy: number): Block["placed"] {
  return block.placed.map((item) => ({
    cluster: item.cluster,
    x: item.x + dx,
    y: item.y + dy,
  }));
}

type HullLayoutCtx = {
  collapsedEdges: readonly CollapsedPipelineEdge[];
};

/** Cluster ids contained in a unit's subtree (the whole hull or one cluster). */
function unitClusterIds(unit: V2Unit): Set<string> {
  return unit.kind === "hull"
    ? subtreeClusterIds(unit.hull)
    : new Set([unit.cluster.id]);
}

/**
 * True when no TFD edge leaves the unit's subtree — i.e. it is an *external*
 * sink at this hull level (internal dataflow is fine). This is the order-safe
 * spill condition: a unit with no successor outside itself can be pushed right
 * without ever ending up left of something it feeds.
 */
function unitIsExternalSink(unit: V2Unit, ctx: HullLayoutCtx): boolean {
  const ids = unitClusterIds(unit);
  for (const edge of ctx.collapsedEdges) {
    if (ids.has(edge.source) && !ids.has(edge.target)) {
      return false;
    }
  }
  return true;
}

/**
 * A pure-sink fan-out bundle resolved against the laid-out child blocks: the
 * shared-predecessor source unit plus its sink target members. Spilled as a
 * compact column block to the *right* of the source, top-aligned, filling the
 * source's vertical span instead of stacking below it (the "square" the user
 * wants — DB-subnet / region fan-outs go beside their feeder, not under it).
 */
type SinkBundle = { anchorId: string; memberIds: string[] };

/** Resolve classifier bundles to pure-sink bundles with a single anchor unit. */
function resolveSinkBundles(
  units: readonly V2Unit[],
  lifted: readonly { from: string; to: string }[],
  ctx: HullLayoutCtx,
): SinkBundle[] {
  const layout = classifyHullLayout(units, lifted);
  if (layout.kind !== "flow" || layout.bundles.length === 0) {
    return [];
  }
  const unitById = new Map(units.map((u) => [u.id, u]));
  const predsByUnit = new Map<string, Set<string>>();
  for (const unit of units) {
    predsByUnit.set(unit.id, new Set());
  }
  for (const edge of lifted) {
    predsByUnit.get(edge.to)?.add(edge.from);
  }
  const out: SinkBundle[] = [];
  for (const group of layout.bundles) {
    // Only spill when every member is a pure sink — moving a member rightward is
    // order-safe exactly when it has no successor that could end up left of it.
    if (!group.every((id) => unitIsExternalSink(unitById.get(id)!, ctx))) {
      continue;
    }
    const shared = predsByUnit.get(group[0]!);
    if (!shared || shared.size === 0) {
      continue;
    }
    // Anchor = the shared predecessor present as a sibling unit (rightmost wins
    // for ties — keeps the bundle just past the feeder it flows from).
    const anchorId = [...shared]
      .filter((id) => unitById.has(id))
      .sort()
      .at(-1);
    if (anchorId == null || group.includes(anchorId)) {
      continue;
    }
    out.push({ anchorId, memberIds: [...group].sort() });
  }
  return out;
}

/** Pack member blocks into columns that fill `targetHeight`, in model order. */
function packBundleColumns(
  members: readonly Block[],
  targetHeight: number,
): {
  offsets: Array<{ dx: number; dy: number }>;
  width: number;
  height: number;
} {
  const ordered = members
    .map((block, index) => ({ block, index }))
    .sort(
      (a, b) =>
        a.block.minFirstSequence - b.block.minFirstSequence ||
        a.index - b.index,
    );
  // Members are same-role siblings; framed hulls need title clearance between
  // stacked members, plain cluster cards only need the leaf gap.
  const stackGap = members.some((m) => m.isHull) ? HULL_GAP_Y : LEAF_GAP_Y;
  const offsets = new Array<{ dx: number; dy: number }>(members.length);
  let colX = 0;
  let colY = 0;
  let colW = 0;
  let totalW = 0;
  let totalH = 0;
  for (const { block, index } of ordered) {
    const ext = blockXExtent(block);
    const w = ext.x1 - ext.x0;
    if (colY > 0 && colY + block.height > targetHeight) {
      colX += colW + HULL_GAP_Y;
      colY = 0;
      colW = 0;
    }
    // dx maps the block's own left to the column's left; dy is the in-column top.
    offsets[index] = { dx: colX - ext.x0, dy: colY };
    colY += block.height + stackGap;
    colW = Math.max(colW, w);
    totalW = Math.max(totalW, colX + colW);
    totalH = Math.max(totalH, colY - stackGap);
  }
  return { offsets, width: totalW, height: totalH };
}

/** Recursively lay out a hull as a rigid block (child hulls first). */
function layoutHullBlock(
  hull: V2Hull,
  columnX: readonly number[],
  ctx: HullLayoutCtx,
  counter: { sideBySideRows: number },
): Block {
  const blockById = new Map<string, Block>();
  for (const child of hull.childHulls) {
    blockById.set(
      `hull:${child.key}`,
      layoutHullBlock(child, columnX, ctx, counter),
    );
  }
  for (const cluster of hull.leafClusters) {
    blockById.set(`cluster:${cluster.id}`, leafBlock(cluster, columnX));
  }

  const units = hullChildUnits(hull);
  const lifted = liftEdges(hull, units, ctx.collapsedEdges);
  const sinkBundles = resolveSinkBundles(units, lifted, ctx);
  const memberOf = new Map<string, SinkBundle>();
  for (const bundle of sinkBundles) {
    for (const id of bundle.memberIds) {
      memberOf.set(id, bundle);
    }
  }

  // Root has no frame; every other hull reserves a title band so its own frame
  // title (rendered by emit inside the top border) clears its first child.
  const topBand = hull.role === "root" ? 0 : HULL_TITLE_BAND;

  const rects: SkylineRect[] = [];
  const placed: Block["placed"] = [];
  const placedExtent = new Map<string, { x0: number; x1: number; y: number }>();
  let bottom = topBand;

  const commit = (id: string, block: Block, dx: number, dy: number) => {
    placed.push(...shiftPlaced(block, dx, dy));
    const ext = blockXExtent(block);
    const x0 = ext.x0 + dx;
    const x1 = ext.x1 + dx;
    rects.push({ x0, x1, y1: dy + block.height, isHull: block.isHull });
    placedExtent.set(id, { x0, x1, y: dy });
    bottom = Math.max(bottom, dy + block.height);
  };

  // Phase 1: place the column-pinned units (everything except spilled sink
  // members) by geometric skyline, left column first then model order. Their x
  // stays on the global depth grid → strict TFD order is preserved.
  const pinned = units
    .filter((u) => !memberOf.has(u.id))
    .map((u) => ({
      unit: u,
      block: blockById.get(u.id)!,
      ext: blockXExtent(blockById.get(u.id)!),
    }))
    .sort(
      (a, b) =>
        a.ext.x0 - b.ext.x0 ||
        a.unit.minFirstSequence - b.unit.minFirstSequence ||
        a.unit.id.localeCompare(b.unit.id),
    );
  let pinnedCount = 0;
  for (const { unit, block, ext } of pinned) {
    const y = dropY(rects, ext.x0, ext.x1, block.height, topBand, block.isHull);
    if (pinnedCount > 0 && y === topBand) {
      counter.sideBySideRows += 1;
    }
    pinnedCount += 1;
    commit(unit.id, block, 0, y);
  }

  // Phase 2: spill each pure-sink fan-out bundle into a compact column block to
  // the right of its anchor, top-aligned to fill the anchor's vertical span.
  for (const bundle of sinkBundles) {
    const anchorExt = placedExtent.get(bundle.anchorId);
    if (!anchorExt) {
      continue; // anchor itself was spilled (nested bundle) — skip defensively
    }
    const anchorBlock = blockById.get(bundle.anchorId)!;
    const members = bundle.memberIds.map((id) => blockById.get(id)!);
    const targetHeight = Math.max(
      anchorBlock.height,
      ...members.map((m) => m.height),
    );
    const pack = packBundleColumns(members, targetHeight);
    const originX = anchorExt.x1 + V2_COLUMN_GAP;
    const originY = dropY(
      rects,
      originX,
      originX + pack.width,
      pack.height,
      anchorExt.y,
      true,
    );
    bundle.memberIds.forEach((id, i) => {
      const block = blockById.get(id)!;
      const off = pack.offsets[i]!;
      commit(id, block, originX + off.dx, originY + off.dy);
    });
    counter.sideBySideRows += members.length;
  }

  let colMin = Number.POSITIVE_INFINITY;
  let colMax = Number.NEGATIVE_INFINITY;
  for (const item of placed) {
    colMin = Math.min(colMin, item.cluster.depth);
    colMax = Math.max(colMax, item.cluster.depth);
  }

  return {
    placed,
    colMin: Number.isFinite(colMin) ? colMin : 0,
    colMax: Number.isFinite(colMax) ? colMax : 0,
    height: bottom,
    minFirstSequence: hull.minFirstSequence,
    isHull: hull.role !== "root",
  };
}

/**
 * Strict deterministic layout. Returns the positioned cluster skeleton plus the
 * `layoutBoxes` map (keyed by both cluster id and cluster frame id) consumed by
 * the v1 frame/edge emitters.
 */
export function layoutPipelineV2Strict(
  prep: PipelineLayoutPrep,
  /**
   * "Unconnected" ancillary strips, wrapped as pseudo-clusters (each carries its
   * own laid skeleton + frame in `build`, no TFD edges). They join the hull tree
   * so the recursive packer drops each strip as the bottom band of its scope, but
   * are **excluded from `computeGlobalColumnX`** — a wide strip must not balloon
   * the global depth column shared by every scope.
   */
  ancillaryClusters: readonly PipelineCluster[] = [],
): PipelineV2PackResult {
  // Global, monotonic column grid by depth — the order guarantee. The wider gap
  // lets column-disjoint hulls sit side-by-side without their nested frames
  // overlapping. Sized from the real (dataflow) clusters only.
  const columnX = computeGlobalColumnX(
    prep.clusters,
    prep.maxDepth,
    V2_COLUMN_GAP,
  );

  const counter = { sideBySideRows: 0 };
  const ctx: HullLayoutCtx = {
    collapsedEdges: prep.collapsedEdges,
  };
  const root = buildHullTree([...prep.clusters, ...ancillaryClusters]);
  const rootBlock = layoutHullBlock(root, columnX, ctx, counter);

  // X already absolute (global columns); shift Y so the top sits at the margin.
  const originY = PIPELINE_MARGIN;

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const layoutBoxes = new Map<string, TerraformDependencyLayoutBox>();

  // Deterministic emission order (model order).
  const ordered = [...rootBlock.placed].sort(
    (a, b) =>
      a.cluster.firstSequence - b.cluster.firstSequence ||
      a.cluster.id.localeCompare(b.cluster.id),
  );
  for (const { cluster, x, y } of ordered) {
    const absX = x;
    const absY = y + originY;
    skeleton.push(...translateSkeleton(cluster.build.skeleton, absX, absY));
    const box: TerraformDependencyLayoutBox = {
      x: absX,
      y: absY,
      width: cluster.build.width,
      height: cluster.build.height,
    };
    layoutBoxes.set(cluster.id, box);
    layoutBoxes.set(cluster.build.clusterFrameId, { ...box });
  }

  return { skeleton, layoutBoxes, sideBySideRows: counter.sideBySideRows };
}
