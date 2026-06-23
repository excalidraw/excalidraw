/**
 * RCLL (Recursive Compound Layered Layout) — Coordinate assignment / straightening
 * (Stage 1d, RFC §9). Milestone M5, Axis-1 straightener **A1 · Brandes–Köpf**.
 *
 * Assigns each leaf cluster a Y (the cross-axis; columns are the layers, drawn
 * left→right — the transpose of the cited papers' horizontal coordinate) so that
 * dataflow-connected leaves in adjacent columns land at the **same Y** and their
 * edge reads flat. This replaces the dumb `colCursor` stack (`y += height + gap`)
 * that ignores edges entirely.
 *
 * Algorithm — Brandes–Köpf "Fast and Simple Horizontal Coordinate Assignment"
 * ([R10]), size-aware ([R12]), in a **reduced two-sided, no-dummy** form:
 *   1. vertical alignment → blocks (chains of nodes that should share a Y), with the
 *      median rule + a crossing guard, run BOTH directions (align-to-left-neighbours
 *      and align-to-right-neighbours);
 *   2. size-aware compaction places each block respecting within-column order +
 *      `height + gap` separation (the standard `place_block` / class-graph routine);
 *   3. **average** the two directional assignments (two-sided centering), then a
 *      final per-column ordered down-separation guarantees no overlap.
 *
 * **No dummy nodes (DEC-5 deferred):** alignment only considers neighbours one column
 * away. An edge spanning many columns has no node to chain through, so it stays
 * un-aligned (the long-edge "spine tail"). That residual IS the measured ceiling of
 * A1 — it motivates DEC-5 dummies / [R11] flow (A2) only if A1 leaves it on the table.
 *
 * Pure + deterministic (CON-8): fixed iteration orders, stable median tiebreak, no
 * RNG. Single pass, no force loop (CON-9). **Y-only** — never touches column (X) or
 * within-column order (M6), so the iron rule (CON-12) holds by construction.
 */

/** One leaf to straighten. `order` = its within-column sequence index (M6-settled). */
export type StraightenLeaf = {
  key: string;
  clusterId: string;
  col: number;
  /** placed box height (size-aware separation). */
  height: number;
  /** within-column order index (lower = higher on screen). */
  order: number;
};

/** Median indices of a sorted list (1 for odd, the 2 central for even) — the BK rule. */
function medianIndices(n: number): number[] {
  if (n === 0) {
    return [];
  }
  const lo = Math.floor((n - 1) / 2);
  const hi = Math.ceil((n - 1) / 2);
  return lo === hi ? [lo] : [lo, hi];
}

type Adjacency = ReadonlyMap<string, readonly string[]>;

/**
 * One BK directional alignment + compaction. `toLeft = true` aligns each node to the
 * median of its neighbours in the **previous** column (col−1), traversing columns
 * ascending; `false` aligns to col+1 neighbours, traversing descending. Returns the
 * assigned top-Y per leaf key (un-normalized; caller offsets to `segmentTop`).
 */
function alignAndCompact(
  leaves: readonly StraightenLeaf[],
  byCol: ReadonlyMap<number, StraightenLeaf[]>,
  neighborsInPrevCol: ReadonlyMap<string, StraightenLeaf[]>,
  cols: readonly number[],
  gap: number,
  toLeft: boolean,
): Map<string, number> {
  const byKey = new Map(leaves.map((l) => [l.key, l]));
  // root/align form the blocks: align is a circular linked list per block; root is
  // the block's representative (its topmost-in-traversal member).
  const root = new Map<string, string>(leaves.map((l) => [l.key, l.key]));
  const align = new Map<string, string>(leaves.map((l) => [l.key, l.key]));

  const colOrder = toLeft ? cols : [...cols].reverse();
  for (const c of colOrder) {
    const layer = byCol.get(c) ?? [];
    // crossing guard: the order index of the last neighbour we aligned to.
    let r = toLeft ? -Infinity : Infinity;
    // traverse the layer in within-column order (ascending for both — the guard
    // direction differs, not the layer scan).
    for (const v of layer) {
      const ns = neighborsInPrevCol.get(v.key) ?? [];
      if (ns.length === 0) {
        continue;
      }
      // neighbours sorted by their within-column order (stable).
      const sorted = [...ns].sort(
        (a, b) => a.order - b.order || (a.key < b.key ? -1 : 1),
      );
      for (const m of medianIndices(sorted.length)) {
        if (align.get(v.key) !== v.key) {
          break; // v already aligned this pass
        }
        const u = sorted[m]!;
        const noCross = toLeft ? u.order > r : u.order < r;
        if (noCross) {
          align.set(u.key, v.key);
          root.set(v.key, root.get(u.key)!);
          align.set(v.key, root.get(v.key)!);
          r = u.order;
        }
      }
    }
  }

  // within-column predecessor (the node immediately above in order) per leaf.
  const predInCol = new Map<string, StraightenLeaf | null>();
  for (const layer of byCol.values()) {
    for (let i = 0; i < layer.length; i++) {
      predInCol.set(layer[i]!.key, i > 0 ? layer[i - 1]! : null);
    }
  }

  // BK compaction (place_block), transposed to Y, size-aware separation.
  const y = new Map<string, number>();
  const sink = new Map<string, string>(leaves.map((l) => [l.key, l.key]));
  const shift = new Map<string, number>(leaves.map((l) => [l.key, Infinity]));

  const placeBlock = (vKey: string): void => {
    if (y.has(vKey)) {
      return;
    }
    y.set(vKey, 0);
    let w = vKey;
    do {
      const pred = predInCol.get(w) ?? null;
      if (pred) {
        const uRoot = root.get(pred.key)!;
        placeBlock(uRoot);
        if (sink.get(vKey) === vKey) {
          sink.set(vKey, sink.get(uRoot)!);
        }
        const sep = pred.height + gap; // pred is above w
        if (sink.get(vKey) !== sink.get(uRoot)) {
          const s = shift.get(sink.get(uRoot)!)!;
          shift.set(
            sink.get(uRoot)!,
            Math.min(s, y.get(vKey)! - y.get(uRoot)! - sep),
          );
        } else {
          y.set(vKey, Math.max(y.get(vKey)!, y.get(uRoot)! + sep));
        }
      }
      w = align.get(w)!;
    } while (w !== vKey);
  };

  // place blocks in a deterministic order (input leaf order; roots only).
  for (const l of leaves) {
    if (root.get(l.key) === l.key) {
      placeBlock(l.key);
    }
  }

  // absolute Y: each node takes its root's Y plus the class shift.
  const out = new Map<string, number>();
  for (const l of leaves) {
    const rk = root.get(l.key)!;
    let yy = y.get(rk)!;
    const sh = shift.get(sink.get(rk)!)!;
    if (Number.isFinite(sh)) {
      yy += sh;
    }
    out.set(l.key, yy);
  }
  void byKey;
  return out;
}

/**
 * Straighten one container's leaves in Y (RFC §9, A1 Brandes–Köpf). Returns a
 * `key → top-Y` map; X and within-column order are untouched. `segmentTop` is the
 * minimum Y (the placement segment's top); the result is offset so the highest leaf
 * sits at `segmentTop`, and a final per-column down-separation guarantees no overlap.
 */
export function straightenColumns(
  leaves: readonly StraightenLeaf[],
  fanout: Adjacency,
  fanin: Adjacency,
  segmentTop: number,
  gap: number,
): Map<string, number> {
  if (leaves.length === 0) {
    return new Map();
  }
  const byId = new Map(leaves.map((l) => [l.clusterId, l]));
  const cols = [...new Set(leaves.map((l) => l.col))].sort((a, b) => a - b);
  const byCol = new Map<number, StraightenLeaf[]>();
  for (const c of cols) {
    byCol.set(
      c,
      leaves
        .filter((l) => l.col === c)
        .sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : 1)),
    );
  }

  // adjacency restricted to present leaves, split by adjacent column (|Δcol| == 1).
  // A leaf's left-neighbours are its fan-in sources one column back; right-neighbours
  // its fan-out targets one column forward. (Straightness is direction-agnostic; the
  // iron rule guarantees sources sit left, targets right, so this partitions cleanly.)
  const leftOf = new Map<string, StraightenLeaf[]>();
  const rightOf = new Map<string, StraightenLeaf[]>();
  const addAdj = (
    fromKey: string,
    fromCol: number,
    neighborId: string,
    bucket: Map<string, StraightenLeaf[]>,
    wantCol: number,
  ) => {
    const n = byId.get(neighborId);
    if (n && n.col === wantCol) {
      let arr = bucket.get(fromKey);
      if (!arr) {
        arr = [];
        bucket.set(fromKey, arr);
      }
      arr.push(n);
    }
    void fromCol;
  };
  for (const l of leaves) {
    for (const t of fanout.get(l.clusterId) ?? []) {
      if (t !== l.clusterId) {
        addAdj(l.key, l.col, t, rightOf, l.col + 1);
      }
    }
    for (const s of fanin.get(l.clusterId) ?? []) {
      if (s !== l.clusterId) {
        addAdj(l.key, l.col, s, leftOf, l.col - 1);
      }
    }
  }

  const down = alignAndCompact(leaves, byCol, leftOf, cols, gap, true);
  const up = alignAndCompact(leaves, byCol, rightOf, cols, gap, false);

  // two-sided average.
  const avg = new Map<string, number>();
  for (const l of leaves) {
    avg.set(l.key, ((down.get(l.key) ?? 0) + (up.get(l.key) ?? 0)) / 2);
  }

  // final per-column ordered down-separation from segmentTop: keep each column's
  // order, pull toward the averaged Y, push down only to satisfy height+gap. This
  // removes any residual overlap the averaging introduced and clamps to the segment.
  const out = new Map<string, number>();
  for (const c of cols) {
    const layer = byCol.get(c)!;
    let cursor = segmentTop;
    for (const leaf of layer) {
      const top = Math.max(avg.get(leaf.key) ?? segmentTop, cursor);
      out.set(leaf.key, top);
      cursor = top + leaf.height + gap;
    }
  }
  // normalize so the topmost leaf sits exactly at segmentTop (BK coords are relative).
  let minY = Infinity;
  for (const v of out.values()) {
    minY = Math.min(minY, v);
  }
  if (Number.isFinite(minY) && minY !== segmentTop) {
    const d = segmentTop - minY;
    for (const [k, v] of out) {
      out.set(k, v + d);
    }
  }
  return out;
}
