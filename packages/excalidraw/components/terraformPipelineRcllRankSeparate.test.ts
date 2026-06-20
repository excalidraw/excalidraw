/**
 * RCLL — sibling-separation ranking (`rankSeparate`) unit tests (T1 + global ranker).
 *
 * Covers the constraint-graph builder (SCC quotient + separation-only edges +
 * infeasibility detector) and the whole-model-global Sander layering
 * (`computeGlobalSeparatedFloor`): chain / diamond / independent / 2-way co-axial /
 * nested, the multi-container CROSS-account case (the round-3 NO-GO), and the
 * augmented-cycle observable fallback — asserted against hand-computed oracle ranks.
 * See terraformPipelineRcllRankSeparate.ts and docs/pipeline-rcll-layout-design.md §9.6.
 */
import { describe, expect, it } from "vitest";

import {
  buildSeparationConstraintGraph,
  computeGlobalSeparatedFloor,
  constraintGraphHasCycle,
} from "./terraformPipelineRcllRankSeparate";

import type { PipelineCluster } from "./terraformPipelineLayoutShared";
import type { CompoundNode, HullEdge } from "./terraformPipelineRcllTypes";

// ── fixtures ──────────────────────────────────────────────────────────────────

let seq = 0;
const leaf = (key: string): CompoundNode => ({
  key,
  role: "primaryCluster",
  level: 2,
  minDescendantSequence: seq++,
  cluster: {
    id: key,
    primaryAddress: key,
    firstSequence: seq,
    depth: 0,
    placement: {} as PipelineCluster["placement"],
    build: { skeleton: [], width: 200, height: 96, clusterFrameId: `${key}:f` },
  },
  children: [],
});

const container = (
  key: string,
  children: CompoundNode[],
  role: CompoundNode["role"] = "region",
): CompoundNode => ({
  key,
  role,
  level: 1,
  minDescendantSequence: Math.min(
    ...children.map((c) => c.minDescendantSequence),
  ),
  children,
});

const edge = (from: string, to: string): HullEdge => ({
  from,
  to,
  weight: 1,
  declared: false,
});

const hulls = (
  rec: Record<string, [string, string][]>,
): Map<string, readonly HullEdge[]> =>
  new Map(
    Object.entries(rec).map(([k, es]) => [k, es.map(([f, t]) => edge(f, t))]),
  );

const floors = (rec: Record<string, number>): Map<string, number> =>
  new Map(Object.entries(rec));

/** whole-model leaf→leaf adjacency (the DAG that produced the base floor). */
const fan = (rec: Record<string, string[]>): Map<string, readonly string[]> =>
  new Map(Object.entries(rec));

/** Wrap members under a synthetic provider root (the whole-model tree). */
const root = (members: CompoundNode[]): CompoundNode =>
  container("provider", members, "provider" as CompoundNode["role"]);

// ── T1: buildSeparationConstraintGraph ──────────────────────────────────────────

describe("buildSeparationConstraintGraph", () => {
  it("adds a separation edge iff one-way AND across distinct quotient nodes", () => {
    const g = buildSeparationConstraintGraph(
      ["A", "B", "C"],
      [edge("A", "B")],
    );
    expect(g.infeasible).toBe(false);
    expect(g.condEdges).toEqual([{ from: "A", to: "B" }]);
    // C is independent → its own singleton quotient, no edges.
    expect(g.quotientOf.get("C")).toBe("C");
    expect([...g.membersByQuotient.keys()].sort()).toEqual(["A", "B", "C"]);
  });

  it("collapses a 2-way cycle to ONE quotient node with no separation edge", () => {
    const g = buildSeparationConstraintGraph(
      ["A", "B"],
      [edge("A", "B"), edge("B", "A")],
    );
    expect(g.infeasible).toBe(false);
    // A,B share one rep (lexicographically smallest = "A") → co-axial.
    expect(g.quotientOf.get("A")).toBe(g.quotientOf.get("B"));
    expect(g.quotientOf.get("A")).toBe("A");
    expect(g.condEdges).toEqual([]); // intra-quotient edge is not a separation
    expect([...g.membersByQuotient.get("A")!].sort()).toEqual(["A", "B"]);
  });

  it("collapses a 3-cycle and dedupes parallel separation edges", () => {
    // A↔B mutual, both point to C (two raw edges A→C, B→C → one quotient edge).
    const g = buildSeparationConstraintGraph(
      ["A", "B", "C"],
      [edge("A", "B"), edge("B", "A"), edge("A", "C"), edge("B", "C")],
    );
    expect(g.quotientOf.get("A")).toBe(g.quotientOf.get("B"));
    expect(g.condEdges).toEqual([{ from: "A", to: "C" }]);
  });

  it("ignores edges whose endpoints are not both children of this container", () => {
    const g = buildSeparationConstraintGraph(
      ["A", "B"],
      [edge("A", "B"), edge("A", "OUTSIDE"), edge("X", "B")],
    );
    expect(g.condEdges).toEqual([{ from: "A", to: "B" }]);
  });
});

describe("constraintGraphHasCycle (infeasibility detector)", () => {
  it("rejects a constructed cyclic precedence graph", () => {
    expect(
      constraintGraphHasCycle(
        ["A", "B", "C"],
        [
          { from: "A", to: "B" },
          { from: "B", to: "C" },
          { from: "C", to: "A" },
        ],
      ),
    ).toBe(true);
  });

  it("accepts an acyclic precedence graph", () => {
    expect(
      constraintGraphHasCycle(
        ["A", "B", "C"],
        [
          { from: "A", to: "B" },
          { from: "B", to: "C" },
        ],
      ),
    ).toBe(false);
  });
});

// ── global ranker: computeGlobalSeparatedFloor ───────────────────────────────────

describe("computeGlobalSeparatedFloor", () => {
  it("no one-way pairs ⇒ OFF byte-identical (returns base floor verbatim)", () => {
    const tree = root([
      container("A", [leaf("a0"), leaf("a1")]),
      container("B", [leaf("b0"), leaf("b1")]),
    ]);
    const base = floors({ a0: 0, a1: 1, b0: 0, b1: 1 });
    const r = computeGlobalSeparatedFloor(
      tree,
      base,
      fan({ a0: ["a1"], b0: ["b1"] }),
      hulls({ provider: [] }),
    );
    expect(r.fallbackReason).toBe("no-pairs");
    expect(r.applied).toBe(false);
    expect(r.pairCount).toBe(0);
    expect(r.floor).toBe(base); // same reference ⇒ provably identical
  });

  it("one-way A→B ranks B's whole band strictly after A's (disjoint ranges)", () => {
    const tree = root([
      container("A", [leaf("a0"), leaf("a1")]),
      container("B", [leaf("b0"), leaf("b1")]),
    ]);
    const r = computeGlobalSeparatedFloor(
      tree,
      floors({ a0: 0, a1: 1, b0: 0, b1: 1 }),
      fan({ a0: ["a1"], b0: ["b1"] }),
      hulls({ provider: [["A", "B"]] }),
    );
    const m = r.floor;
    // a0→a1 (leaf) ⇒ a0=0,a1=1. All-to-all a*→b* ⇒ b0=max(2)=2, b1=3.
    expect(Object.fromEntries(m)).toEqual({ a0: 0, a1: 1, b0: 2, b1: 3 });
    expect(Math.max(m.get("a0")!, m.get("a1")!)).toBeLessThan(m.get("b0")!);
    expect(r.applied).toBe(true);
    expect(r.pairCount).toBe(1);
    expect(r.changedRankCount).toBe(2); // b0, b1 moved
    expect(r.fallbackReason).toBe("none");
  });

  it("chain A→B→C lays three disjoint bands in order", () => {
    const tree = root([
      container("A", [leaf("a0")]),
      container("B", [leaf("b0")]),
      container("C", [leaf("c0")]),
    ]);
    const m = computeGlobalSeparatedFloor(
      tree,
      floors({ a0: 0, b0: 0, c0: 0 }),
      fan({}),
      hulls({ provider: [["A", "B"], ["B", "C"]] }),
    ).floor;
    expect(m.get("a0")).toBe(0);
    expect(m.get("b0")).toBe(1);
    expect(m.get("c0")).toBe(2);
  });

  it("diamond A→B, A→C, B→D, C→D: B and C independent (share band), D after both", () => {
    const tree = root([
      container("A", [leaf("a0")]),
      container("B", [leaf("b0")]),
      container("C", [leaf("c0")]),
      container("D", [leaf("d0")]),
    ]);
    const m = computeGlobalSeparatedFloor(
      tree,
      floors({ a0: 0, b0: 0, c0: 0, d0: 0 }),
      fan({}),
      hulls({ provider: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"]] }),
    ).floor;
    expect(m.get("a0")).toBe(0);
    expect(m.get("b0")).toBe(1);
    expect(m.get("c0")).toBe(1);
    expect(m.get("d0")).toBe(2);
  });

  it("2-way SCC stays co-axial: no separation edge ⇒ base floor (no-op)", () => {
    const tree = root([
      container("A", [leaf("a0"), leaf("a1")]),
      container("B", [leaf("b0"), leaf("b1")]),
    ]);
    const base = floors({ a0: 0, a1: 1, b0: 0, b1: 1 });
    const r = computeGlobalSeparatedFloor(
      tree,
      base,
      fan({ a0: ["a1"], b0: ["b1"] }),
      hulls({ provider: [["A", "B"], ["B", "A"]] }),
    );
    // A⇄B collapses to one quotient ⇒ no one-way pair ⇒ no-op short-circuit.
    expect(r.pairCount).toBe(0);
    expect(r.floor).toBe(base);
  });

  it("CROSS-account: co-axial accounts with acyclic cross leaf edges stay forward (round-3 fix)", () => {
    // The round-3 NO-GO case. acct1⇄acct2 are a 2-way hull SCC (co-axial). The leaf
    // graph is acyclic (p0→q0 one way, q1→p1 the other) and acct1 has a one-way
    // region pair so separation fires. The single global pass MUST keep every
    // cross-account leaf edge forward (round 3's per-container shifts inverted them).
    const tree = root([
      container(
        "acct1",
        [container("R1", [leaf("p0")]), container("R2", [leaf("p1")])],
        "account",
      ),
      container(
        "acct2",
        [container("S1", [leaf("q0")]), container("S2", [leaf("q1")])],
        "account",
      ),
    ]);
    const leafAdj = fan({ p0: ["q0"], q1: ["p1"] }); // acyclic cross edges
    const r = computeGlobalSeparatedFloor(
      tree,
      floors({ p0: 0, p1: 0, q0: 0, q1: 0 }),
      leafAdj,
      hulls({
        provider: [["acct1", "acct2"], ["acct2", "acct1"]], // 2-way ⇒ co-axial
        acct1: [["R1", "R2"]], // one-way ⇒ separation fires
      }),
    );
    const m = r.floor;
    expect(r.fallbackReason).toBe("none");
    expect(r.pairCount).toBe(1);
    // Every cross-account leaf edge reads forward — the property round 3 broke.
    for (const [from, tos] of leafAdj) {
      for (const to of tos) {
        expect(m.get(from)!).toBeLessThan(m.get(to)!);
      }
    }
  });

  it("augmented cycle ⇒ observable fallback to base floor (not silent)", () => {
    // Hull says A→B (one-way) so we add sep a0→b0, but a leaf edge b0→a0 exists ⇒
    // the augmented graph has a cycle. Keep the base floor, report the reason.
    const tree = root([
      container("A", [leaf("a0")]),
      container("B", [leaf("b0")]),
    ]);
    const base = floors({ a0: 0, b0: 0 });
    const r = computeGlobalSeparatedFloor(
      tree,
      base,
      fan({ b0: ["a0"] }), // leaf edge B→A contradicts the A→B separation
      hulls({ provider: [["A", "B"]] }),
    );
    expect(r.fallbackReason).toBe("augmented-cycle");
    expect(r.applied).toBe(false);
    expect(r.pairCount).toBe(1);
    expect(r.changedRankCount).toBe(0);
    expect(r.floor).toBe(base);
  });

  // ── adversarial fixtures (T5) ──────────────────────────────────────────────────

  it("nested one-way: separation composes across levels (provider AND account)", () => {
    // provider[acct1→acct2], acct1[R1→R2], acct2[S1→S2]. Three one-way pairs at two
    // nesting levels. The single global pass must order ALL four bands: every acct1 leaf
    // before every acct2 leaf, R1 before R2, S1 before S2 ⇒ p0<p1<q0<q1.
    const tree = root([
      container(
        "acct1",
        [container("R1", [leaf("p0")]), container("R2", [leaf("p1")])],
        "account",
      ),
      container(
        "acct2",
        [container("S1", [leaf("q0")]), container("S2", [leaf("q1")])],
        "account",
      ),
    ]);
    const r = computeGlobalSeparatedFloor(
      tree,
      floors({ p0: 0, p1: 0, q0: 0, q1: 0 }),
      fan({}),
      hulls({
        provider: [["acct1", "acct2"]],
        acct1: [["R1", "R2"]],
        acct2: [["S1", "S2"]],
      }),
    );
    expect(r.fallbackReason).toBe("none");
    expect(r.pairCount).toBe(3);
    const m = r.floor;
    expect(m.get("p0")!).toBeLessThan(m.get("p1")!);
    expect(m.get("p1")!).toBeLessThan(m.get("q0")!);
    expect(m.get("q0")!).toBeLessThan(m.get("q1")!);
  });

  it("shared fan-in: independent sources share a band, the sink ranks after ALL of them", () => {
    // A,B,C independent (no edges among them) all → D. The sink D must rank strictly after
    // the MAX of its sources — the all-to-all separation guarantees it even if one source
    // is itself pushed right by another constraint.
    const tree = root([
      container("A", [leaf("a0")]),
      container("B", [leaf("b0")]),
      container("C", [leaf("c0")]),
      container("D", [leaf("d0")]),
    ]);
    const m = computeGlobalSeparatedFloor(
      tree,
      floors({ a0: 0, b0: 0, c0: 0, d0: 0 }),
      fan({}),
      hulls({ provider: [["A", "D"], ["B", "D"], ["C", "D"]] }),
    ).floor;
    expect(m.get("a0")).toBe(0);
    expect(m.get("b0")).toBe(0);
    expect(m.get("c0")).toBe(0);
    expect(m.get("d0")).toBe(1);
    expect(m.get("d0")!).toBeGreaterThan(
      Math.max(m.get("a0")!, m.get("b0")!, m.get("c0")!),
    );
  });

  it("nested augmented-cycle: a leaf edge from DEEP inside B back into A closes the cycle ⇒ fallback", () => {
    // The realistic failure mode (#6): the separation A→B is added at the provider level,
    // but a leaf edge from a grandchild of B points back into A — closing `A→…→B→…→A`
    // through a deeper container, not a flat b0→a0. Must still be CAUGHT (not silent).
    const tree = root([
      container("A", [container("AR", [leaf("a0")])]),
      container("B", [container("BR", [leaf("b0")])]),
    ]);
    const base = floors({ a0: 0, b0: 0 });
    const r = computeGlobalSeparatedFloor(
      tree,
      base,
      fan({ b0: ["a0"] }), // deep leaf edge B→A contradicts the provider A→B separation
      hulls({ provider: [["A", "B"]] }),
    );
    expect(r.fallbackReason).toBe("augmented-cycle");
    expect(r.applied).toBe(false);
    expect(r.floor).toBe(base);
  });

  it("unbounded width by design: a long one-way chain produces a linear span (NOT rejected)", () => {
    // The round-4 ranker is correctness-first: it has NO width budget. A deep one-way chain
    // A→B→C→D→E lays five disjoint bands (span 4) — width grows linearly and the ranker
    // APPLIES it. Width is observed at the gate / handled by border-nodes (deferred T6),
    // never rejected here. This documents that contract.
    const tree = root([
      container("A", [leaf("a0")]),
      container("B", [leaf("b0")]),
      container("C", [leaf("c0")]),
      container("D", [leaf("d0")]),
      container("E", [leaf("e0")]),
    ]);
    const r = computeGlobalSeparatedFloor(
      tree,
      floors({ a0: 0, b0: 0, c0: 0, d0: 0, e0: 0 }),
      fan({}),
      hulls({
        provider: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"]],
      }),
    );
    expect(r.fallbackReason).toBe("none");
    expect(r.applied).toBe(true);
    const m = r.floor;
    expect([
      m.get("a0"),
      m.get("b0"),
      m.get("c0"),
      m.get("d0"),
      m.get("e0"),
    ]).toEqual([0, 1, 2, 3, 4]);
  });

  it("is deterministic (stable across repeated runs)", () => {
    const build = () =>
      root([
        container("A", [leaf("a0"), leaf("a1")]),
        container("B", [leaf("b0")]),
        container("C", [leaf("c0")]),
      ]);
    const base = floors({ a0: 0, a1: 1, b0: 0, c0: 0 });
    const adj = fan({ a0: ["a1"] });
    const h = hulls({ provider: [["A", "B"], ["B", "C"]] });
    const r1 = computeGlobalSeparatedFloor(build(), base, adj, h);
    const r2 = computeGlobalSeparatedFloor(build(), base, adj, h);
    expect(Object.fromEntries(r1.floor)).toEqual(Object.fromEntries(r2.floor));
  });
});
