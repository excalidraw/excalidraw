import { describe, expect, it } from "vitest";

import {
  barycenterReorder,
  countContainerCrossings,
  type OrderableLeaf,
} from "./terraformPipelineOrdering";

/** Build a posByCluster from {clusterId: [col, rank]} for crossing-count tests. */
const pos = (m: Record<string, [number, number]>) =>
  new Map(
    Object.entries(m).map(([id, [col, rank]]) => [id, { col, rank }]),
  );

describe("countContainerCrossings", () => {
  it("counts a single crossing between two 2-column edges", () => {
    // a@(0,0)→d@(1,1) and b@(0,1)→c@(1,0): the chords cross.
    const p = pos({ a: [0, 0], b: [0, 1], c: [1, 0], d: [1, 1] });
    expect(countContainerCrossings(p, [["a", "d"], ["b", "c"]])).toBe(1);
  });

  it("counts zero when the same edges are uncrossed", () => {
    // a@(0,0)→c@(1,0) and b@(0,1)→d@(1,1): parallel, no crossing.
    const p = pos({ a: [0, 0], b: [0, 1], c: [1, 0], d: [1, 1] });
    expect(countContainerCrossings(p, [["a", "c"], ["b", "d"]])).toBe(0);
  });

  it("ignores same-column edges (CON-12 forbids them; no L→R span)", () => {
    const p = pos({ a: [0, 0], b: [0, 1] });
    expect(countContainerCrossings(p, [["a", "b"]])).toBe(0);
  });

  it("counts a crossing across a column-spanning (long) edge", () => {
    // long edge a@(0,0)→e@(2,1) vs short b@(1,2)→... actually: a@(0,0)→e@(2,0)
    // straddles col 1; c@(1,-1)... use a clear case:
    // a@(0,1)→e@(2,1) (flat across cols 0..2) and c@(1,0)→d@(1,2) won't span.
    // Simpler: a@(0,0)→e@(2,2) and b@(1,2)→f@(1,0) — different columns.
    const p = pos({ a: [0, 0], e: [2, 2], b: [1, 2], f: [3, 0] });
    // a→e spans 0..2, b→f spans 1..3; they overlap in [1,2] and invert in Y.
    expect(countContainerCrossings(p, [["a", "e"], ["b", "f"]])).toBe(1);
  });
});

describe("barycenterReorder", () => {
  const model = (order: string[]) => {
    const r = new Map(order.map((k, i) => [k, i]));
    return (k: string) => r.get(k) ?? 0;
  };

  it("reorders to remove a crossing the model order created", () => {
    // Model order puts a above b in col 0 and c above d in col 1, with edges
    // a→d, b→c → a crossing. Barycenter should swap a column to fix it.
    const leaves: OrderableLeaf[] = [
      { key: "a", clusterId: "a", col: 0 },
      { key: "b", clusterId: "b", col: 0 },
      { key: "c", clusterId: "c", col: 1 },
      { key: "d", clusterId: "d", col: 1 },
    ];
    const edges: [string, string][] = [
      ["a", "d"],
      ["b", "c"],
    ];
    const rank = barycenterReorder(leaves, model(["a", "b", "c", "d"]), edges);
    // After reorder, the crossing is gone.
    const p = new Map(
      leaves.map((l) => [l.clusterId, { col: l.col, rank: rank.get(l.key)! }]),
    );
    expect(countContainerCrossings(p, edges)).toBe(0);
  });

  it("keeps model order when it is already crossing-free", () => {
    const leaves: OrderableLeaf[] = [
      { key: "a", clusterId: "a", col: 0 },
      { key: "b", clusterId: "b", col: 0 },
      { key: "c", clusterId: "c", col: 1 },
      { key: "d", clusterId: "d", col: 1 },
    ];
    const edges: [string, string][] = [
      ["a", "c"],
      ["b", "d"],
    ];
    const rank = barycenterReorder(leaves, model(["a", "b", "c", "d"]), edges);
    expect(rank.get("a")).toBe(0);
    expect(rank.get("b")).toBe(1);
    expect(rank.get("c")).toBe(0);
    expect(rank.get("d")).toBe(1);
  });

  it("returns model order on empty edges / single column", () => {
    const leaves: OrderableLeaf[] = [
      { key: "a", clusterId: "a", col: 0 },
      { key: "b", clusterId: "b", col: 0 },
    ];
    const rank = barycenterReorder(leaves, model(["a", "b"]), []);
    expect(rank.get("a")).toBe(0);
    expect(rank.get("b")).toBe(1);
  });

  it("is deterministic (identical input → identical output)", () => {
    const leaves: OrderableLeaf[] = [
      { key: "a", clusterId: "a", col: 0 },
      { key: "b", clusterId: "b", col: 0 },
      { key: "x", clusterId: "x", col: 1 },
      { key: "y", clusterId: "y", col: 1 },
      { key: "z", clusterId: "z", col: 1 },
    ];
    const edges: [string, string][] = [
      ["a", "z"],
      ["b", "x"],
      ["a", "y"],
    ];
    const m = model(["a", "b", "x", "y", "z"]);
    const r1 = barycenterReorder(leaves, m, edges);
    const r2 = barycenterReorder(leaves, m, edges);
    expect([...r1.entries()].sort()).toEqual([...r2.entries()].sort());
  });

  it("never increases crossings vs the model order (strict-improve gate)", () => {
    const leaves: OrderableLeaf[] = [
      { key: "a", clusterId: "a", col: 0 },
      { key: "b", clusterId: "b", col: 0 },
      { key: "c", clusterId: "c", col: 0 },
      { key: "d", clusterId: "d", col: 1 },
      { key: "e", clusterId: "e", col: 1 },
      { key: "f", clusterId: "f", col: 1 },
    ];
    const edges: [string, string][] = [
      ["a", "f"],
      ["b", "e"],
      ["c", "d"],
    ];
    const m = model(["a", "b", "c", "d", "e", "f"]);
    const before = countContainerCrossings(
      new Map(leaves.map((l) => [l.clusterId, { col: l.col, rank: m(l.key) % 3 }])),
      edges,
    );
    const rank = barycenterReorder(leaves, m, edges);
    const after = countContainerCrossings(
      new Map(
        leaves.map((l) => [l.clusterId, { col: l.col, rank: rank.get(l.key)! }]),
      ),
      edges,
    );
    expect(after).toBeLessThanOrEqual(before);
  });
});
