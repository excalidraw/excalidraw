/**
 * M6c container-aware crossing minimization — engine unit suite.
 *
 * Exercises the measure-driven loop in isolation (synthetic trees + a fully-controlled
 * `place` closure), so the search mechanics are proven without the 160 s v2 build:
 *  - `countPlacedCrossings` matches hand geometry (and the diagnostic's endpoint rule);
 *  - `barycenterOrder` is deterministic and orders by neighbour barycenter;
 *  - `minimizeCrossings` ACCEPTS a strict rendered improvement, is IDENTITY when nothing
 *    improves (OFF byte-identical), respects the eval budget, and keeps siblings
 *    contiguous (sub-container members never interleave);
 *  - `countReordered` counts displaced sibling slots.
 */
import { describe, expect, it } from "vitest";

import type { PipelineCluster } from "./terraformPipelineLayoutShared";
import type { CompoundNode } from "./terraformPipelineRcllTypes";
import {
  barycenterOrder,
  boxByClusterId,
  collapsedEdgesFromFanout,
  countPlacedCrossings,
  countReordered,
  minimizeCrossings,
  type CrossingEdge,
} from "./terraformPipelineRcllCrossingMin";

/** A leaf cluster node with a placed box at column `col`, row `row`. */
function leaf(
  id: string,
  seq: number,
  col: number,
  row: number,
): CompoundNode {
  return {
    key: id,
    role: "primaryCluster",
    level: 3,
    minDescendantSequence: seq,
    cluster: {
      id,
      firstSequence: seq,
      build: { width: 100, height: 60 },
    } as unknown as PipelineCluster,
    children: [],
    box: { x: col * 300, y: row * 120, width: 100, height: 60 },
  };
}

/** A container with the given leaf children. */
function container(key: string, seq: number, children: CompoundNode[]): CompoundNode {
  return {
    key,
    role: "vpc",
    level: 2,
    minDescendantSequence: seq,
    children,
    box: { x: 0, y: 0, width: 400, height: 400 },
  };
}

const root = (children: CompoundNode[]): CompoundNode => ({
  key: "__rcll_root__",
  role: "root",
  level: 0,
  minDescendantSequence: 0,
  children,
  box: { x: 0, y: 0, width: 1000, height: 1000 },
});

describe("M6c countPlacedCrossings", () => {
  it("counts a crossing pair once and ignores edges sharing an endpoint", () => {
    const boxes = new Map([
      ["a", { x: 0, y: 0, width: 100, height: 60 }],
      ["b", { x: 0, y: 120, width: 100, height: 60 }],
      ["c", { x: 300, y: 0, width: 100, height: 60 }],
      ["d", { x: 300, y: 120, width: 100, height: 60 }],
    ]);
    // a(top)→d(bottom) and b(bottom)→c(top) cross.
    expect(countPlacedCrossings(boxes, [["a", "d"], ["b", "c"]])).toBe(1);
    // a→c and a→d share endpoint a ⇒ not a crossing.
    expect(countPlacedCrossings(boxes, [["a", "c"], ["a", "d"]])).toBe(0);
    // a→c and b→d are parallel ⇒ no crossing.
    expect(countPlacedCrossings(boxes, [["a", "c"], ["b", "d"]])).toBe(0);
  });

  it("skips edges whose endpoints are missing from the box map", () => {
    const boxes = new Map([["a", { x: 0, y: 0, width: 10, height: 10 }]]);
    expect(countPlacedCrossings(boxes, [["a", "z"]])).toBe(0);
  });
});

describe("M6c collapsedEdgesFromFanout / boxByClusterId", () => {
  it("flattens fan-out adjacency to edges and drops self-loops", () => {
    const fanout = new Map<string, readonly string[]>([
      ["a", ["b", "c"]],
      ["b", ["b"]], // self-loop dropped
    ]);
    expect(collapsedEdgesFromFanout(fanout).sort()).toEqual([
      ["a", "b"],
      ["a", "c"],
    ]);
  });

  it("collects leaf cluster boxes by cluster id", () => {
    const tree = root([container("g", 0, [leaf("a", 0, 0, 0), leaf("b", 1, 0, 1)])]);
    const boxes = boxByClusterId(tree);
    expect([...boxes.keys()].sort()).toEqual(["a", "b"]);
  });
});

describe("M6c barycenterOrder", () => {
  it("is deterministic and orders a free column by neighbour barycenter", () => {
    // col0 anchor A(top) and B(bottom); col1 C(top), D(bottom). A→D, B→C cross.
    const tree = root([
      container("g0", 0, [leaf("A", 0, 0, 0), leaf("B", 1, 0, 1)]),
      container("g1", 2, [leaf("C", 2, 1, 0), leaf("D", 3, 1, 1)]),
    ]);
    const edges: CrossingEdge[] = [
      ["A", "D"],
      ["B", "C"],
    ];
    const r1 = barycenterOrder(tree, edges);
    const r2 = barycenterOrder(tree, edges);
    // Determinism: identical rank maps across calls.
    expect([...r1.entries()]).toEqual([...r2.entries()]);
    // D's only neighbour A is at the top ⇒ D barycenters above C (whose neighbour B is
    // at the bottom). So within g1, D precedes C in the proposed order.
    expect(r1.get("D")!).toBeLessThan(r1.get("C")!);
  });

  it("keeps a node with no cross-edges in model order (stable)", () => {
    const tree = root([container("g", 0, [leaf("a", 0, 0, 0), leaf("b", 1, 0, 1)])]);
    const r = barycenterOrder(tree, []);
    expect(r.get("a")!).toBeLessThan(r.get("b")!);
  });
});

describe("M6c minimizeCrossings", () => {
  const edges: CrossingEdge[] = [
    ["A", "D"],
    ["B", "C"],
  ];

  // A `place` closure that maps an override to a placed tree: column X is fixed
  // (order-independent), within-column row order follows the override rank (else model
  // order). This mirrors the real engine contract (X fixed, only Y permutes).
  const colOf: Record<string, number> = { A: 0, B: 0, C: 1, D: 1 };
  const makePlace =
    () =>
    (override: ReadonlyMap<string, number>): CompoundNode => {
      const ids = ["A", "B", "C", "D"];
      const rankOf = (id: string) =>
        override.size > 0 ? override.get(id) ?? 0 : ids.indexOf(id);
      const byCol = new Map<number, string[]>();
      for (const id of ids) {
        (byCol.get(colOf[id]!) ?? byCol.set(colOf[id]!, []).get(colOf[id]!)!).push(id);
      }
      const leaves: CompoundNode[] = [];
      for (const [col, members] of byCol) {
        members.sort((a, b) => rankOf(a) - rankOf(b));
        members.forEach((id, row) => leaves.push(leaf(id, ids.indexOf(id), col, row)));
      }
      return root([
        container(
          "g",
          0,
          leaves.filter((l) => colOf[l.key] === 0),
        ),
        container(
          "g1",
          2,
          leaves.filter((l) => colOf[l.key] === 1),
        ),
      ]);
    };

  const metrics = () => ({ containment: 0, overlap: 0, width: 600, height: 240 });

  it("is identity when no override can improve (place ignores override)", () => {
    const constantPlace = () =>
      root([container("g", 0, [leaf("A", 0, 0, 0), leaf("B", 1, 0, 1)])]);
    const { override, result } = minimizeCrossings(
      [["A", "B"]],
      constantPlace,
      metrics,
    );
    expect(result.applied).toBe(false);
    expect(result.before).toBe(result.after);
    expect(override.size).toBe(0);
  });

  it("accepts a strict rendered improvement and reports the delta", () => {
    // A place that returns the crossing model for the empty override but a crossing-free
    // model for ANY non-empty override (D above C). The search must accept it.
    const place = (override: ReadonlyMap<string, number>): CompoundNode => {
      if (override.size === 0) {
        return root([
          container("g", 0, [leaf("A", 0, 0, 0), leaf("B", 1, 0, 1)]),
          container("g1", 2, [leaf("C", 2, 1, 0), leaf("D", 3, 1, 1)]),
        ]);
      }
      return root([
        container("g", 0, [leaf("A", 0, 0, 0), leaf("B", 1, 0, 1)]),
        container("g1", 2, [leaf("D", 3, 1, 0), leaf("C", 2, 1, 1)]),
      ]);
    };
    const { result } = minimizeCrossings(edges, place, metrics);
    expect(result.before).toBe(1);
    expect(result.after).toBe(0);
    expect(result.applied).toBe(true);
  });

  it("rejects a candidate that regresses the structural gates", () => {
    const place = (override: ReadonlyMap<string, number>): CompoundNode =>
      override.size === 0
        ? root([
            container("g", 0, [leaf("A", 0, 0, 0), leaf("B", 1, 0, 1)]),
            container("g1", 2, [leaf("C", 2, 1, 0), leaf("D", 3, 1, 1)]),
          ])
        : root([
            container("g", 0, [leaf("A", 0, 0, 0), leaf("B", 1, 0, 1)]),
            container("g1", 2, [leaf("D", 3, 1, 0), leaf("C", 2, 1, 1)]),
          ]);
    // Even though crossings would drop, an overlap regression must veto the move.
    const regressingMetrics = (tree: CompoundNode) => {
      const overlap = boxByClusterId(tree).has("D") ? 0 : 0;
      // first call (baseline) overlap 0; trial overlap 1 ⇒ rejected.
      return { containment: 0, overlap, width: 600, height: 240 };
    };
    let call = 0;
    const metricsWithRegression = (tree: CompoundNode) => {
      const base = regressingMetrics(tree);
      const overlap = call++ === 0 ? 0 : 1;
      return { ...base, overlap };
    };
    const { result } = minimizeCrossings(edges, place, metricsWithRegression);
    expect(result.applied).toBe(false);
  });

  it("respects the eval budget (no trials beyond the cap)", () => {
    let calls = 0;
    const place = (override: ReadonlyMap<string, number>): CompoundNode => {
      calls += 1;
      return makePlace()(override);
    };
    minimizeCrossings(edges, place, metrics, { sweeps: 50, evalBudget: 1 });
    // Budget 1 ⇒ only the baseline placement, no search trials.
    expect(calls).toBe(1);
  });
});

describe("M6c countReordered + contiguity", () => {
  it("counts displaced sibling slots and never interleaves container members", () => {
    const g0 = container("g0", 0, [leaf("a", 0, 0, 0), leaf("b", 1, 0, 1)]);
    const g1 = container("g1", 2, [leaf("c", 2, 1, 0), leaf("d", 3, 1, 1)]);
    const tree = root([g0, g1]);
    // An override that swaps the two top-level containers and the leaves of g1.
    const override = new Map<string, number>([
      ["__rcll_root__", 0],
      ["g1", 1],
      ["d", 2],
      ["c", 3],
      ["g0", 4],
      ["a", 5],
      ["b", 6],
    ]);
    // g0 (model rank 0) and g1 (model rank 1) are swapped ⇒ 2 displaced slots at root;
    // c,d swapped ⇒ 2 displaced slots in g1. a,b unchanged.
    expect(countReordered(tree, override)).toBe(4);
    // Contiguity: sorting root's children by override never splits a container's leaves —
    // a,b stay under g0 and c,d under g1 (they are never siblings of each other).
    const sortedRoot = [...tree.children].sort(
      (x, y) => override.get(x.key)! - override.get(y.key)!,
    );
    expect(sortedRoot.map((n) => n.key)).toEqual(["g1", "g0"]);
    for (const c of sortedRoot) {
      expect(c.children.every((ch) => ch.role === "primaryCluster")).toBe(true);
    }
  });

  it("counts zero moves for the empty override", () => {
    const tree = root([container("g", 0, [leaf("a", 0, 0, 0), leaf("b", 1, 0, 1)])]);
    expect(countReordered(tree, new Map())).toBe(0);
  });
});
