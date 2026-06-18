/**
 * RCLL (Recursive Compound Layered Layout) — Milestone M6: crossing minimization
 * (Stage 1c / RFC §7.2c, §11.2, REQ-5, DEC-6).
 *
 * The within-column Y-order of a container's leaf clusters is, through M5/M4,
 * fixed at the model order `(minDescendantSequence, key)`. That order is an
 * accident of declaration sequence, not a crossing-minimizing one. This module
 * runs the classic Sugiyama ordering phase **per container**: a bounded
 * barycenter sweep that permutes leaves within their column, accepted **only when
 * it strictly reduces** a model-level crossing count (so it can never regress a
 * container) — else the model order stands.
 *
 * Pure + deterministic (CON-8/CON-9): bounded sweeps, no RNG, stable tiebreak on
 * the model rank. Coordinates remain M5's job — this module only decides ORDER
 * (the within-column rank); the caller still assigns Y by stacking in that order.
 *
 * Why a geometric crossing count (not pure rank-inversion): RCLL draws long edges
 * directly (no dummy-node chains — DEC-5 is off in v1), so an edge can span
 * non-adjacent columns. Counting segment intersections on provisional positions
 * (X = column, Y = within-column rank) is faithful to such edges and matches what
 * the rendered polyline counter ultimately measures, where rank-inversion over
 * adjacent layers alone would miss column-spanning crossings.
 */

/** A leaf cluster eligible for reordering within its container. */
export type OrderableLeaf = {
  /** unique node key (the reorder result is keyed by this). */
  key: string;
  /** cluster id — the adjacency/`neighbors` key (collapsed-edge endpoints). */
  clusterId: string;
  /** column index within the container (localColumn / shared denseRank axis). */
  col: number;
};

/** Provisional position of a leaf: column on X, within-column rank on Y. */
type Pos = { col: number; rank: number };

/** Do segments p1→p2 and p3→p4 properly cross? Endpoint-sharing ⇒ not a crossing
 * (two edges from the same node never "cross" in the layered sense). */
function segmentsCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  // strictly opposite sides on both segments ⇒ proper crossing.
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Count crossings among a container's in-container edges, given each leaf's
 * column and within-column rank. An edge is a `(clusterId → clusterId)` pair both
 * of whose endpoints are leaves in this container. Two edges that share an
 * endpoint never count. O(E²) over in-container edges — tiny per container.
 */
export function countContainerCrossings(
  posByCluster: ReadonlyMap<string, Pos>,
  edges: readonly (readonly [string, string])[],
): number {
  const segs: { ax: number; ay: number; bx: number; by: number }[] = [];
  for (const [u, v] of edges) {
    const pu = posByCluster.get(u);
    const pv = posByCluster.get(v);
    if (!pu || !pv || pu.col === pv.col) {
      // same-column edges have no L→R span here (CON-12 forbids them anyway);
      // skip — they contribute no layered crossing under this projection.
      continue;
    }
    segs.push({ ax: pu.col, ay: pu.rank, bx: pv.col, by: pv.rank });
  }
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i]!;
      const b = segs[j]!;
      if (
        segmentsCross(a.ax, a.ay, a.bx, a.by, b.ax, b.ay, b.bx, b.by)
      ) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

/** Build per-cluster provisional positions from a within-column rank map. */
function positions(
  leaves: readonly OrderableLeaf[],
  rankByKey: ReadonlyMap<string, number>,
): Map<string, Pos> {
  const out = new Map<string, Pos>();
  for (const l of leaves) {
    out.set(l.clusterId, { col: l.col, rank: rankByKey.get(l.key) ?? 0 });
  }
  return out;
}

/** Assign dense within-column ranks from an explicit ordering of each column. */
function ranksFromColumnOrders(
  columnOrders: ReadonlyMap<number, readonly OrderableLeaf[]>,
): Map<string, number> {
  const rank = new Map<string, number>();
  for (const order of columnOrders.values()) {
    order.forEach((l, i) => rank.set(l.key, i));
  }
  return rank;
}

const MAX_SWEEPS = 4;

/**
 * Barycenter reorder of a container's leaves, gated on strict crossing reduction.
 *
 * @param leaves        the container's leaf clusters (with column).
 * @param modelRankOf   the model order rank for `key` (the deterministic baseline
 *                      + the stable tiebreak inside a column).
 * @param edges         in-container collapsed edges `(clusterId, clusterId)`.
 * @returns key → within-column rank. The barycenter order **iff** it strictly
 *          reduces `countContainerCrossings`, else the model order (identity).
 */
export function barycenterReorder(
  leaves: readonly OrderableLeaf[],
  modelRankOf: (key: string) => number,
  edges: readonly (readonly [string, string])[],
): Map<string, number> {
  // Group leaves by column; seed each column in model order.
  const columns = new Map<number, OrderableLeaf[]>();
  for (const l of leaves) {
    const list = columns.get(l.col);
    if (list) {
      list.push(l);
    } else {
      columns.set(l.col, [l]);
    }
  }
  const cols = [...columns.keys()].sort((a, b) => a - b);
  for (const c of cols) {
    columns
      .get(c)!
      .sort((a, b) => modelRankOf(a.key) - modelRankOf(b.key));
  }

  // Nothing to permute: <2 columns, or every column is a singleton.
  const reorderable = cols.some((c) => (columns.get(c)?.length ?? 0) >= 2);
  if (cols.length < 2 || !reorderable || edges.length === 0) {
    return ranksFromColumnOrders(columns);
  }

  // Cluster-id → owning leaf (for neighbour-column lookups during a sweep).
  const leafByCluster = new Map<string, OrderableLeaf>();
  for (const l of leaves) {
    leafByCluster.set(l.clusterId, l);
  }
  // Adjacency: clusterId → neighbour clusterIds (both directions, in-container).
  const adj = new Map<string, string[]>();
  for (const [u, v] of edges) {
    if (!leafByCluster.has(u) || !leafByCluster.has(v)) {
      continue;
    }
    (adj.get(u) ?? adj.set(u, []).get(u)!).push(v);
    (adj.get(v) ?? adj.set(v, []).get(v)!).push(u);
  }

  const bestOrder = new Map<number, OrderableLeaf[]>(
    cols.map((c) => [c, [...columns.get(c)!]]),
  );
  let bestCrossings = countContainerCrossings(
    positions(leaves, ranksFromColumnOrders(bestOrder)),
    edges,
  );

  // Working order starts from model order; sweep alternately down/up.
  const work = new Map<number, OrderableLeaf[]>(
    cols.map((c) => [c, [...columns.get(c)!]]),
  );

  const sweep = (forward: boolean) => {
    const rank = ranksFromColumnOrders(work);
    const seq = forward ? cols : [...cols].reverse();
    // The first column in the sweep direction is the fixed anchor.
    for (let i = 1; i < seq.length; i++) {
      const c = seq[i]!;
      const col = work.get(c)!;
      const bary = new Map<string, number>();
      for (const l of col) {
        const ns = adj.get(l.clusterId) ?? [];
        let sum = 0;
        let n = 0;
        for (const nb of ns) {
          const nl = leafByCluster.get(nb);
          // only neighbours in the already-processed adjacent direction inform
          // the barycenter (classic one-sided sweep); use any placed neighbour.
          if (nl && nl.col !== c) {
            sum += rank.get(nl.key) ?? 0;
            n += 1;
          }
        }
        // no cross-column neighbour ⇒ keep model rank (stable, deterministic).
        bary.set(l.clusterId, n > 0 ? sum / n : modelRankOf(l.key));
      }
      col.sort(
        (a, b) =>
          (bary.get(a.clusterId) ?? 0) - (bary.get(b.clusterId) ?? 0) ||
          modelRankOf(a.key) - modelRankOf(b.key),
      );
      // refresh ranks for the just-reordered column so later columns see it.
      col.forEach((l, idx) => rank.set(l.key, idx));
    }
  };

  for (let s = 0; s < MAX_SWEEPS; s++) {
    sweep(s % 2 === 0);
    const crossings = countContainerCrossings(
      positions(leaves, ranksFromColumnOrders(work)),
      edges,
    );
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      for (const c of cols) {
        bestOrder.set(c, [...work.get(c)!]);
      }
    }
  }

  return ranksFromColumnOrders(bestOrder);
}
