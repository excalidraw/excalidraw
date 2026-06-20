/**
 * RCLL (Recursive Compound Layered Layout) — De-density (Axis-2 B, RFC §9.3).
 * Milestone M5b. **Internal / measurement-only** (no UI wiring) — gated behind the
 * `deDensify` option, default OFF.
 *
 * Problem: on the swimlane (cyclic) path a column = the dense rank of a cluster's
 * longest-path floor (`denseClusterColumns`). Independent clusters that happen to
 * share a floor pile into ONE column (v2: up to ~11 cards), leaving no Y-room, so
 * the A1 Brandes–Köpf straightener (`terraformPipelineStraighten.ts`) is a measured
 * no-op. De-density thins a crowded column by promoting a SAFE subset of its leaves
 * one column to the right, creating Y-room.
 *
 * **Safe-spread rule (the whole correctness story — column-preserving, single-column,
 * forward-neighbourhood).** A leaf `l` at column `c` may move to `c+1` only if EVERY
 * one of these holds (else it stays put):
 *   1. all of `l`'s fan-in sources and fan-out targets are IN this axis (no
 *      cross-container neighbour — their absolute X is origin-dependent and not known
 *      here, so we never reason about geometry we don't control);
 *   2. `l`'s neighbourhood is purely FORWARD (every in-axis source col `< c`, every
 *      in-axis target col `> c`) — no cycle, no same-column edge to begin with;
 *   3. no in-axis source sits at `c-1` (moving would turn a straightenable adjacent
 *      edge into a span-2 long edge the straightener ignores — the M5 `col±1`
 *      constraint, `terraformPipelineStraighten.ts:196`);
 *   4. no in-axis target sits at `c+1` (moving would make that edge same-column —
 *      forbidden by CON-12);
 *   5. `l` shares no fan-in source and no fan-out target with any column-mate at `c`
 *      (don't split a fan group — preserve the fan-out gestalt, the literature's
 *      clarity device: Column-Based Graph Layouts, Confluent Layered Drawings);
 *   6. `c+1` is strictly less occupied than `c` (move toward the sparser side — a real
 *      de-densify, not a shuffle), and creating a brand-new rightmost column is capped
 *      at `maxExtraCols` (the width dial; a HARD pre-move bound, never a post-relax
 *      clamp).
 *
 * Rules 2-4 make the move CON-12-safe **by construction**: it never creates a backward
 * or same-column edge, so there is NO forward-relax pass and thus no cap-vs-CON-12
 * conflict and no cycle cascade. Rules 3-4 keep every moved card's edges within
 * `col±1`, so the straightener can still see them (and a `c→c+2` edge becomes adjacent
 * = an M5 GAIN). Pure + deterministic (CON-8): fixed iteration order
 * (`firstSequence`, then `clusterId`), no RNG, single pass.
 */

/** Adjacency: cluster id → neighbour cluster ids (same shape as fanout/fanin). */
type Adjacency = ReadonlyMap<string, readonly string[]>;

/** One leaf considered for de-density. `firstSequence` drives the stable order. */
export type DeDensityLeaf = {
  clusterId: string;
  firstSequence: number;
};

export type DeDensityOptions = {
  /** width dial: max number of brand-new rightmost columns this pass may create. */
  maxExtraCols: number;
  /** only thin columns with at least this many leaves (default 2). */
  occupancyThreshold?: number;
};

/**
 * Compute a de-densified column assignment from the dense-rank `colByCluster`.
 * Returns a NEW map over the same cluster ids; only the safely-promotable leaves move
 * (+1 column). The caller rebuilds `columnX` from the result (per-column max width),
 * so downstream placement / straightening consume it unchanged.
 */
export function deDensifyColumns(
  leaves: readonly DeDensityLeaf[],
  colByCluster: ReadonlyMap<string, number>,
  fanout: Adjacency,
  fanin: Adjacency,
  opts: DeDensityOptions,
): Map<string, number> {
  const out = new Map<string, number>(colByCluster);
  const maxExtraCols = Math.max(0, Math.floor(opts.maxExtraCols));
  const occupancyThreshold = Math.max(2, opts.occupancyThreshold ?? 2);
  if (leaves.length === 0 || maxExtraCols === 0) {
    return out;
  }

  const axisIds = new Set(leaves.map((l) => l.clusterId));

  // current occupancy per column (mutated as leaves move).
  const occupancy = new Map<number, number>();
  let originalMaxCol = 0;
  for (const id of axisIds) {
    const c = out.get(id) ?? 0;
    occupancy.set(c, (occupancy.get(c) ?? 0) + 1);
    originalMaxCol = Math.max(originalMaxCol, c);
  }
  let maxCol = originalMaxCol;
  let extraCols = 0;

  // in-axis neighbour columns for a leaf (sources from fanin, targets from fanout),
  // dropping any neighbour outside this axis (rule 1 is checked separately).
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

  for (const leaf of ordered) {
    const id = leaf.clusterId;
    const c = out.get(id) ?? 0;
    // (6a) only thin genuinely crowded columns.
    if ((occupancy.get(c) ?? 0) < occupancyThreshold) {
      continue;
    }
    const src = inAxisCols(id, fanin);
    const tgt = inAxisCols(id, fanout);
    // (1) no cross-axis neighbour.
    if (src.hasCrossAxis || tgt.hasCrossAxis) {
      continue;
    }
    // (2) purely forward neighbourhood (no cycle / no same-column edge).
    if (src.cols.some((sc) => sc >= c) || tgt.cols.some((tc) => tc <= c)) {
      continue;
    }
    // (3) no source at c-1 (would create a span-2 long edge the straightener ignores).
    if (src.cols.some((sc) => sc === c - 1)) {
      continue;
    }
    // (4) no target at c+1 (would become a same-column edge — CON-12).
    if (tgt.cols.some((tc) => tc === c + 1)) {
      continue;
    }
    // (5) don't split a fan group: no shared source / target with a column-mate at c.
    if (sharesFanWithColumnMate(id, c, src.ids, tgt.ids, out, fanin, fanout, axisIds)) {
      continue;
    }
    // (6b) move toward the sparser side; cap brand-new columns.
    const target = c + 1;
    const isNewColumn = target > maxCol;
    if (isNewColumn) {
      if (extraCols >= maxExtraCols) {
        continue;
      }
    } else if ((occupancy.get(target) ?? 0) >= (occupancy.get(c) ?? 0)) {
      continue;
    }
    // commit the move.
    out.set(id, target);
    occupancy.set(c, (occupancy.get(c) ?? 0) - 1);
    occupancy.set(target, (occupancy.get(target) ?? 0) + 1);
    if (isNewColumn) {
      extraCols += 1;
      maxCol = target;
    }
  }

  return out;
}

/**
 * Rule 5: would moving `id` split a fan group? True if `id` shares any fan-in source
 * or fan-out target with another leaf currently at column `c` (its column-mates).
 *
 * Exported so the mirror pass `terraformPipelineColumnCompact` (M5c pull-left) reuses
 * the identical fan-group test — one source of truth for "don't split a fan group".
 */
export function sharesFanWithColumnMate(
  id: string,
  c: number,
  sourceIds: readonly string[],
  targetIds: readonly string[],
  col: ReadonlyMap<string, number>,
  fanin: Adjacency,
  fanout: Adjacency,
  axisIds: ReadonlySet<string>,
): boolean {
  const sources = new Set(sourceIds);
  const targets = new Set(targetIds);
  if (sources.size === 0 && targets.size === 0) {
    return false;
  }
  for (const mate of axisIds) {
    if (mate === id || (col.get(mate) ?? 0) !== c) {
      continue;
    }
    for (const s of fanin.get(mate) ?? []) {
      if (sources.has(s)) {
        return true;
      }
    }
    for (const t of fanout.get(mate) ?? []) {
      if (targets.has(t)) {
        return true;
      }
    }
  }
  return false;
}
