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
 * - **Hulls pack in 2-D by column range.** Each hull is laid out as a rigid block
 *   spanning the depth-columns its clusters occupy. Sibling units (child-hull
 *   blocks + leaf clusters) are skyline-packed in Y: two units may share a Y row
 *   **iff their column ranges are disjoint** (so they can never collide in a
 *   shared column), otherwise they stack. Column-disjoint hulls therefore sit
 *   side-by-side (square); column-overlapping hulls stack (taller, but the only
 *   overlap-free option). This is the order-safe analogue of v1's packed skyline.
 *
 * The result feeds the same v1 frame/edge finishers (`emitTopologyContextFrames`,
 * `appendPipelineEdgeSkeletons`) — each hull's clusters form a contiguous,
 * rigidly-translated block, so the derived nested frames are clean and disjoint.
 *
 * Deterministic: model order (`firstSequence`) breaks every tie; no ELK, no async,
 * no randomness. Crossing-reduced unit ordering is a planned refinement on top of
 * this safe baseline (see plan), as is fan-out / pure-sink bundle re-packing,
 * which spreads same-column sink fan-outs across columns to form square blocks.
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
import { buildHullTree } from "./terraformPipelineV2Structure";

import type {
  PipelineCluster,
  PipelineLayoutPrep,
} from "./terraformPipelineLayoutShared";
import type { V2Hull } from "./terraformPipelineV2Structure";
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

/** Stacked-gap between two adjacent units: wide if either is a framed hull. */
function gapBetween(a: Block, b: Block): number {
  return a.isHull || b.isHull ? HULL_GAP_Y : LEAF_GAP_Y;
}

/** True when two inclusive column ranges overlap (⇒ may collide in a column). */
function columnsOverlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): boolean {
  return !(aMax < bMin || bMax < aMin);
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

/** Recursively lay out a hull as a rigid block (child hulls first). */
function layoutHullBlock(
  hull: V2Hull,
  columnX: readonly number[],
  counter: { sideBySideRows: number },
): Block {
  const units: Block[] = [
    ...hull.childHulls.map((child) => layoutHullBlock(child, columnX, counter)),
    ...hull.leafClusters.map((cluster) => leafBlock(cluster, columnX)),
  ];
  // Reading order: leftmost column first, then model order, then stable.
  units.sort(
    (a, b) =>
      a.colMin - b.colMin ||
      a.minFirstSequence - b.minFirstSequence ||
      a.placed[0]!.cluster.id.localeCompare(b.placed[0]!.cluster.id),
  );

  // Skyline pack in Y: a unit drops to the lowest row clear of every already
  // placed unit whose column range overlaps it. Column-disjoint units share a
  // row (→ side-by-side / square); column-overlapping units stack. The frame
  // borders + titles emit adds later are absorbed by the per-pair stacked gap,
  // so no extra in-block top/bottom padding is needed here.
  // Root has no frame of its own; every other hull reserves a title band so its
  // own frame title (rendered by emit inside the top border) clears its children.
  const topBand = hull.role === "root" ? 0 : HULL_TITLE_BAND;

  const placedUnits: Array<{ block: Block; y: number }> = [];
  for (const unit of units) {
    let y = topBand;
    let stackedOnSomething = false;
    for (const placed of placedUnits) {
      if (
        columnsOverlap(
          unit.colMin,
          unit.colMax,
          placed.block.colMin,
          placed.block.colMax,
        )
      ) {
        const floor =
          placed.y + placed.block.height + gapBetween(placed.block, unit);
        if (floor > y) {
          y = floor;
        }
        stackedOnSomething = true;
      }
    }
    if (placedUnits.length > 0 && !stackedOnSomething) {
      counter.sideBySideRows += 1;
    }
    placedUnits.push({ block: unit, y });
  }

  // Materialize: translate each unit's clusters down by its row offset.
  const placed: Block["placed"] = [];
  let colMin = Number.POSITIVE_INFINITY;
  let colMax = Number.NEGATIVE_INFINITY;
  let bottom = 0;
  for (const { block, y } of placedUnits) {
    for (const item of block.placed) {
      placed.push({ cluster: item.cluster, x: item.x, y: item.y + y });
    }
    colMin = Math.min(colMin, block.colMin);
    colMax = Math.max(colMax, block.colMax);
    bottom = Math.max(bottom, y + block.height);
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
): PipelineV2PackResult {
  // Global, monotonic column grid by depth — the order guarantee. The wider gap
  // lets column-disjoint hulls sit side-by-side without their nested frames
  // overlapping.
  const columnX = computeGlobalColumnX(
    prep.clusters,
    prep.maxDepth,
    V2_COLUMN_GAP,
  );

  const counter = { sideBySideRows: 0 };
  const root = buildHullTree(prep.clusters);
  const rootBlock = layoutHullBlock(root, columnX, counter);

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
