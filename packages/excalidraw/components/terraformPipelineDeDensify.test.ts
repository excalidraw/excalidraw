import { describe, expect, it } from "vitest";

import {
  deDensifyColumns,
  type DeDensityLeaf,
} from "./terraformPipelineDeDensify";

/**
 * Build the de-density inputs from a column map + edge list.
 * `cols`: clusterId → starting column. `edges`: [from, to] dataflow edges.
 * `firstSequence` is the insertion order of `cols` keys (deterministic).
 */
function mk(cols: Record<string, number>, edges: [string, string][] = []) {
  const ids = Object.keys(cols);
  const leaves: DeDensityLeaf[] = ids.map((clusterId, i) => ({
    clusterId,
    firstSequence: i,
  }));
  const colByCluster = new Map<string, number>(
    ids.map((id) => [id, cols[id]!]),
  );
  const fanout = new Map<string, string[]>();
  const fanin = new Map<string, string[]>();
  for (const [from, to] of edges) {
    (fanout.get(from) ?? fanout.set(from, []).get(from)!).push(to);
    (fanin.get(to) ?? fanin.set(to, []).get(to)!).push(from);
  }
  return { leaves, colByCluster, fanout, fanin };
}

/** maxCol over a column map. */
const maxCol = (m: ReadonlyMap<string, number>) =>
  Math.max(0, ...[...m.values()]);

/** occupancy histogram: column → count. */
function occupancy(m: ReadonlyMap<string, number>): Map<number, number> {
  const o = new Map<number, number>();
  for (const c of m.values()) {
    o.set(c, (o.get(c) ?? 0) + 1);
  }
  return o;
}

describe("deDensifyColumns — safe-spread rule", () => {
  it("promotes an independent crowded card one column to thin the pile", () => {
    const { leaves, colByCluster, fanout, fanin } = mk({ A: 1, B: 1 });
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 1,
    });
    // A (first in order) moves to the new sparser column; B stays (col 1 no longer dense).
    expect(out.get("A")).toBe(2);
    expect(out.get("B")).toBe(1);
    expect(Math.max(...occupancy(out).values())).toBeLessThan(
      Math.max(...occupancy(colByCluster).values()),
    );
  });

  it("never moves a card with a predecessor one column back (M5 adjacency, rule 3)", () => {
    // A→B; B and C share dense column 1. Moving B would turn A→B (span 1, straightenable)
    // into a span-2 edge the straightener ignores → B must stay.
    const { leaves, colByCluster, fanout, fanin } = mk(
      { A: 0, B: 1, C: 1 },
      [["A", "B"]],
    );
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 2,
    });
    expect(out.get("B")).toBe(1);
  });

  it("never moves a card with a successor one column forward (CON-12 same-column, rule 4)", () => {
    // B→D, D at col 2; B shares dense column 1 with X. Moving B to col 2 would make
    // B→D a same-column edge (forbidden) → B must stay.
    const { leaves, colByCluster, fanout, fanin } = mk(
      { B: 1, X: 1, D: 2 },
      [["B", "D"]],
    );
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 2,
    });
    expect(out.get("B")).toBe(1);
  });

  it("keeps a fan-out group column-aligned (gestalt preserved by rule 3)", () => {
    // H fans out to T1,T2,T3, all at column 1. Each has H at col 0 = c-1, so rule 3
    // blocks every one — the fan-out stays a single tidy column.
    const { leaves, colByCluster, fanout, fanin } = mk(
      { H: 0, T1: 1, T2: 1, T3: 1 },
      [
        ["H", "T1"],
        ["H", "T2"],
        ["H", "T3"],
      ],
    );
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 3,
    });
    expect(out.get("T1")).toBe(1);
    expect(out.get("T2")).toBe(1);
    expect(out.get("T3")).toBe(1);
  });

  it("does not split a wide fan even when the hub is two columns back (rule 5)", () => {
    // H at col 0 fans to T1,T2 at col 2 (source at c-2, so rule 3 passes). They share
    // source H → rule 5 keeps them together.
    const { leaves, colByCluster, fanout, fanin } = mk(
      { H: 0, T1: 2, T2: 2 },
      [
        ["H", "T1"],
        ["H", "T2"],
      ],
    );
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 2,
    });
    expect(out.get("T1")).toBe(2);
    expect(out.get("T2")).toBe(2);
  });

  it("never promotes a card in a cycle (forward-only neighbourhood, rule 2)", () => {
    // A↔B both at column 1 (a same-column mutual cycle). Each sees an in-axis neighbour
    // at col == c (not strictly forward) → rule 2 blocks both.
    const { leaves, colByCluster, fanout, fanin } = mk(
      { A: 1, B: 1 },
      [
        ["A", "B"],
        ["B", "A"],
      ],
    );
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 2,
    });
    expect(out.get("A")).toBe(1);
    expect(out.get("B")).toBe(1);
  });

  it("never moves a card with a cross-axis neighbour (rule 1)", () => {
    // B's only edge is from EXT, which is NOT in the axis (not in cols). We can't reason
    // about its absolute X here, so B must stay.
    const { leaves, colByCluster, fanout, fanin } = mk(
      { B: 1, C: 1 },
      [["EXT", "B"]],
    );
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 2,
    });
    expect(out.get("B")).toBe(1);
  });

  it("honours maxExtraCols as a hard width bound", () => {
    const cols: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      cols[`n${i}`] = 0; // 10 independent cards all in column 0
    }
    const { leaves, colByCluster, fanout, fanin } = mk(cols);
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 2,
    });
    // even though 10 cards could spread far, only 2 NEW columns may be created.
    expect(maxCol(out)).toBeLessThanOrEqual(2);
  });

  it("is a no-op when maxExtraCols is 0", () => {
    const { leaves, colByCluster, fanout, fanin } = mk({ A: 0, B: 0, C: 0 });
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 0,
    });
    expect([...out]).toEqual([...colByCluster]);
  });

  it("respects occupancyThreshold (leaves sparse columns untouched)", () => {
    const { leaves, colByCluster, fanout, fanin } = mk({ A: 0, B: 0 });
    const out = deDensifyColumns(leaves, colByCluster, fanout, fanin, {
      maxExtraCols: 2,
      occupancyThreshold: 3, // col 0 has only 2 → below threshold → no move
    });
    expect([...out]).toEqual([...colByCluster]);
  });

  it("handles empty and single-leaf inputs", () => {
    expect(deDensifyColumns([], new Map(), new Map(), new Map(), {
      maxExtraCols: 2,
    }).size).toBe(0);
    const single = mk({ A: 0 });
    const out = deDensifyColumns(
      single.leaves,
      single.colByCluster,
      single.fanout,
      single.fanin,
      { maxExtraCols: 2 },
    );
    expect(out.get("A")).toBe(0);
  });

  it("is deterministic (same input → identical output)", () => {
    const a = mk({ A: 1, B: 1, C: 1, D: 1 });
    const b = mk({ A: 1, B: 1, C: 1, D: 1 });
    const oa = deDensifyColumns(a.leaves, a.colByCluster, a.fanout, a.fanin, {
      maxExtraCols: 2,
    });
    const ob = deDensifyColumns(b.leaves, b.colByCluster, b.fanout, b.fanin, {
      maxExtraCols: 2,
    });
    expect([...oa].sort()).toEqual([...ob].sort());
  });
});
