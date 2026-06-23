/**
 * RCLL (Recursive Compound Layered Layout) — Column compaction (Axis-2 A, RFC §9.4).
 * Milestone M5c. The **mirror** of M5b de-density (`terraformPipelineDeDensify.ts`):
 * where de-density spreads a crowded column one step RIGHT to make Y-room, this pass
 * pulls SAFE independent leaves LEFT into an earlier column's vertical whitespace,
 * shrinking the swimlane group's WIDTH by spending HEIGHT the parent already reserves.
 * Gated behind the `Compact` arm of the `Column packing` tri-state, default OFF.
 *
 * **Measure-driven, not gate-driven.** De-density can prove its single `+1` move safe
 * by local column-graph rules alone (no geometry). Pull-left cannot: "this move is free
 * because the parent has vertical slack" is a *pixel* fact unknowable from the column map
 * (columns precede frames / lane-rise / parent bbox). So the caller supplies a `measure`
 * closure that re-runs the real swimlane placement on a CLONE for a candidate column map
 * and returns the resulting pixel hull. A move is accepted only if the re-measured hull
 * does NOT grow in width AND no member/inner frame grows in height (the hierarchical
 * `fitsWithinBaseline` rule from the packed pull-left). This makes "spend free height,
 * shrink width" an OBSERVED fact per trial, never an analytic guess.
 *
 * **CON-12-safe by construction + re-verified.** A leaf at column `c` may only move to a
 * column in `[max(in-hull source col)+1 .. min(in-hull target col, c))`, read from the
 * MUTABLE current column map at the moment the leaf is considered. So it never lands on
 * or left of a predecessor's column and never reaches a successor's column — no backward,
 * no same-column edge. Cross-hull neighbours are refused (their absolute X is unknown
 * here, exactly as de-density rule 1). After all moves, emptied columns are removed and
 * the survivors re-dense-ranked 0..K — an order-preserving (monotone) remap, so the
 * inequality `col(u) < col(v)` for every direct edge survives, and removing an empty
 * column strictly drops its width + gap (width is non-increasing). A final pass asserts
 * `col(u) < col(v)` for every direct in-hull edge; any violation (or a re-measured
 * regression) returns the base map untouched (`movedCount = 0`) — observable safe
 * fallback. Pure + deterministic (CON-8): fixed iteration order (`firstSequence`, then
 * `clusterId`), no RNG, bounded sweeps + eval budget.
 *
 * Literature: Rüegg et al. 2016 "Using One-Dimensional Compaction for Smaller Graph
 * Drawings" (bidirectional 1D compaction post-process); Liao–Wong 1983 (constraint-graph
 * longest-path lower bound); "Sugiyama Layouts for Prescribed Drawing Areas" (area budget).
 */

import { sharesFanWithColumnMate } from "./terraformPipelineDeDensify";

/** Adjacency: cluster id → neighbour cluster ids (same shape as fanout/fanin). */
type Adjacency = ReadonlyMap<string, readonly string[]>;

/** One leaf considered for compaction. `firstSequence` drives the stable order. */
export type ColumnCompactLeaf = {
  clusterId: string;
  firstSequence: number;
};

/** Provisional pixel measure of the swimlane group for a candidate column map. */
export type ColumnCompactMeasure = {
  /** Group hull width (right edge) — must not grow. */
  width: number;
  /** Per member/inner-frame height (key → px) — none may grow (hierarchical check). */
  nodeHeights: ReadonlyMap<string, number>;
};

export type ColumnCompactOptions = {
  /** Max greedy sweeps over the leaves (default 4; mirrors the packed pull-left). */
  sweeps?: number;
  /** Floor on the per-call trial-measure budget (default 256). */
  minEvalBudget?: number;
};

export type ColumnCompactResult = {
  /** New column map; equals the input map when nothing moved (OFF byte-identical). */
  colByCluster: Map<string, number>;
  /** Number of leaves pulled left. */
  movedCount: number;
  /** Columns reclaimed (emptied + dropped) by the re-dense-rank. */
  reclaimedCols: number;
  /** True iff the trial-measure budget was hit (some candidates left unexplored). */
  evalCapReached: boolean;
};

const DEFAULT_SWEEPS = 4;
const DEFAULT_MIN_EVAL_BUDGET = 256;

/** Whether `measured` never regresses `baseline` (width + every frame height). */
const fitsWithinBaseline = (
  measured: ColumnCompactMeasure,
  baseline: ColumnCompactMeasure,
): boolean => {
  if (measured.width > baseline.width) {
    return false;
  }
  for (const [key, height] of measured.nodeHeights) {
    const baselineHeight = baseline.nodeHeights.get(key);
    if (baselineHeight == null || height > baselineHeight) {
      return false;
    }
  }
  return true;
};

/**
 * Compute a left-compacted column assignment from a dense-rank `baseColByCluster`.
 * Returns a NEW map over the same cluster ids; only safely-pullable leaves move (one or
 * more columns left), and emptied columns are removed via a re-dense-rank. The caller
 * rebuilds `columnX` from the result, so downstream placement consumes it unchanged.
 */
export function compactColumns(
  leaves: readonly ColumnCompactLeaf[],
  baseColByCluster: ReadonlyMap<string, number>,
  fanout: Adjacency,
  fanin: Adjacency,
  measure: (trial: ReadonlyMap<string, number>) => ColumnCompactMeasure,
  opts: ColumnCompactOptions = {},
): ColumnCompactResult {
  const base = new Map<string, number>(baseColByCluster);
  if (leaves.length === 0) {
    return {
      colByCluster: base,
      movedCount: 0,
      reclaimedCols: 0,
      evalCapReached: false,
    };
  }

  const out = new Map<string, number>(base);
  const axisIds = new Set(leaves.map((l) => l.clusterId));
  let maxColBefore = 0;
  for (const id of axisIds) {
    maxColBefore = Math.max(maxColBefore, out.get(id) ?? 0);
  }

  // In-axis neighbour columns for a leaf (sources from fanin, targets from fanout),
  // read from the MUTABLE `out` (cascade-safe). Cross-axis neighbours flagged.
  const inAxisCols = (
    id: string,
    adj: Adjacency,
  ): { cols: number[]; hasCrossAxis: boolean; ids: string[] } => {
    const cols: number[] = [];
    const ids: string[] = [];
    let hasCrossAxis = false;
    for (const n of adj.get(id) ?? []) {
      if (n === id) {
        continue;
      }
      if (!axisIds.has(n)) {
        hasCrossAxis = true;
        continue;
      }
      cols.push(out.get(n) ?? 0);
      ids.push(n);
    }
    return { cols, hasCrossAxis, ids };
  };

  const ordered = [...leaves].sort(
    (a, b) =>
      a.firstSequence - b.firstSequence ||
      (a.clusterId < b.clusterId ? -1 : a.clusterId > b.clusterId ? 1 : 0),
  );

  const sweeps = Math.max(1, Math.floor(opts.sweeps ?? DEFAULT_SWEEPS));
  const evalBudget = Math.max(
    opts.minEvalBudget ?? DEFAULT_MIN_EVAL_BUDGET,
    axisIds.size * (maxColBefore + 1) * 2,
  );
  let evals = 0;
  let evalCapReached = false;
  let baseline = measure(out);
  let movedCount = 0;

  for (let sweep = 0; sweep < sweeps; sweep++) {
    let accepted = false;
    for (const leaf of ordered) {
      const id = leaf.clusterId;
      const c = out.get(id) ?? 0;
      if (c <= 0) {
        continue; // already leftmost-possible
      }
      const src = inAxisCols(id, fanin);
      const tgt = inAxisCols(id, fanout);
      // (1) refuse cross-axis/cross-hull neighbours — absolute X unknown at this seam.
      if (src.hasCrossAxis || tgt.hasCrossAxis) {
        continue;
      }
      // (2) purely forward neighbourhood (no cycle / no same-column edge to begin with).
      if (src.cols.some((sc) => sc >= c) || tgt.cols.some((tc) => tc <= c)) {
        continue;
      }
      // (3) don't split a fan group: no shared source / target with a column-mate at c.
      if (
        sharesFanWithColumnMate(
          id,
          c,
          src.ids,
          tgt.ids,
          out,
          fanin,
          fanout,
          axisIds,
        )
      ) {
        continue;
      }
      // Lower bound = just right of the deepest in-hull predecessor (CON-12); no source
      // ⇒ col 0. Upper exclusive = just left of the nearest in-hull successor (and < c).
      const lowerBound = src.cols.length === 0 ? 0 : Math.max(...src.cols) + 1;
      const upperExclusive =
        tgt.cols.length === 0 ? c : Math.min(c, Math.min(...tgt.cols));
      if (lowerBound >= upperExclusive) {
        continue;
      }
      // Leftmost-first: land as far left as the measure oracle allows (multi-step).
      for (
        let candidate = lowerBound;
        candidate < upperExclusive;
        candidate++
      ) {
        if (evals >= evalBudget) {
          evalCapReached = true;
          break;
        }
        const trial = new Map(out);
        trial.set(id, candidate);
        evals += 1;
        const measured = measure(trial);
        if (fitsWithinBaseline(measured, baseline)) {
          out.set(id, candidate);
          baseline = measured;
          movedCount += 1;
          accepted = true;
          break;
        }
      }
      if (evalCapReached) {
        break;
      }
    }
    if (!accepted || evalCapReached) {
      break;
    }
  }

  if (movedCount === 0) {
    return {
      colByCluster: base,
      movedCount: 0,
      reclaimedCols: 0,
      evalCapReached,
    };
  }

  // Empty-column removal + re-dense-rank (the width-monotonicity engine). Order-
  // preserving ⇒ CON-12 inequalities survive; dropped columns shed width + gap.
  const usedCols = [...new Set([...out.values()])].sort((a, b) => a - b);
  const remap = new Map<number, number>(usedCols.map((col, i) => [col, i]));
  const reclaimedCols = maxColBefore + 1 - usedCols.length;
  for (const [id, col] of out) {
    out.set(id, remap.get(col) ?? col);
  }

  // CON-12 final re-verify on the remapped map: every direct in-hull edge u→v forward.
  for (const id of axisIds) {
    const su = out.get(id) ?? 0;
    for (const t of fanout.get(id) ?? []) {
      if (axisIds.has(t) && su >= (out.get(t) ?? 0)) {
        // A violation should be impossible by construction; fall back observably.
        return {
          colByCluster: base,
          movedCount: 0,
          reclaimedCols: 0,
          evalCapReached,
        };
      }
    }
  }

  return { colByCluster: out, movedCount, reclaimedCols, evalCapReached };
}
