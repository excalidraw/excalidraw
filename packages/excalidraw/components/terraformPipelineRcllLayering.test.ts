/**
 * Unit tests for RCLL M2 layering (Stage 1a, docs/pipeline-rcll-layout-design.md
 * §7.2a). Pure-data tests over synthetic compound-tree + hull-edge fixtures:
 *
 *   - columnsForContainer: chain, diamond fan-out (T4 co-column), fan-out lifted
 *     to max LB, T1 > T4 (internal precedence wins), hull staircase (CON-6),
 *     cyclic container → sequential columns
 *   - layerTree: every node gets a localColumn; cyclic container stacked; pure
 *     (input tree never mutated); deterministic over two runs
 *   - layeringMeta: aligned fan-out → rate 1.0; un-aligned (T1>T4) → counted as
 *     un-aligned (rate < 1, never vacuous); CON-1/CON-6 violations = 0; cyclic
 *     containers excused
 *
 * Run: yarn vitest run packages/excalidraw/components/terraformPipelineRcllLayering.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  columnsForContainer,
  layerTree,
  layeringMeta,
  layeringStage,
} from "./terraformPipelineRcllLayering";

import type {
  CompoundNode,
  HullEdge,
  Lattice,
} from "./terraformPipelineRcllTypes";

// ── fixtures ──────────────────────────────────────────────────────────────

const he = (from: string, to: string): HullEdge => ({
  from,
  to,
  weight: 1,
  declared: false,
});

const leaf = (key: string, mds: number): CompoundNode => ({
  key,
  role: "primaryCluster",
  level: 2,
  minDescendantSequence: mds,
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
  minDescendantSequence: Math.min(...children.map((c) => c.minDescendantSequence)),
  children,
});

const lattice = (
  hullEdges: Array<[string, HullEdge[]]>,
  cyclic: string[] = [],
): Lattice => ({
  hullEdges: new Map(hullEdges),
  cyclicContainers: new Set(cyclic),
});

const rank0 = (_: string): number => 0;

// ── columnsForContainer ───────────────────────────────────────────────────

describe("columnsForContainer", () => {
  it("chains A→B→C to columns 0,1,2", () => {
    const col = columnsForContainer(
      ["A", "B", "C"],
      [he("A", "B"), he("B", "C")],
      false,
      rank0,
    );
    expect(col.get("A")).toBe(0);
    expect(col.get("B")).toBe(1);
    expect(col.get("C")).toBe(2);
  });

  it("co-columns a fan-out set (diamond): B,C share a column, D strictly right", () => {
    const col = columnsForContainer(
      ["A", "B", "C", "D"],
      [he("A", "B"), he("A", "C"), he("B", "D"), he("C", "D")],
      false,
      rank0,
    );
    expect(col.get("A")).toBe(0);
    expect(col.get("B")).toBe(col.get("C")); // T4
    expect(col.get("B")).toBe(1);
    expect(col.get("D")).toBe(2); // CON-1 after pinning
  });

  it("lifts a fan-out target to the set's max column (max LB)", () => {
    // A→B, A→C, plus P→Q→C so C's base column (2) exceeds B's (1).
    const col = columnsForContainer(
      ["A", "B", "C", "P", "Q"],
      [he("A", "B"), he("A", "C"), he("P", "Q"), he("Q", "C")],
      false,
      rank0,
    );
    expect(col.get("C")).toBe(2);
    expect(col.get("B")).toBe(2); // lifted 1→2 to share C's column
    expect(col.get("B")).toBe(col.get("C"));
  });

  it("T1 > T4: a target internally preceded by another is NOT co-columned", () => {
    // out(A) = {B,C} but B→C, so C must stay right of B (precedence wins).
    const col = columnsForContainer(
      ["A", "B", "C"],
      [he("A", "B"), he("A", "C"), he("B", "C")],
      false,
      rank0,
    );
    expect(col.get("A")).toBe(0);
    expect(col.get("B")).toBe(1);
    expect(col.get("C")).toBe(2);
    expect(col.get("B")).not.toBe(col.get("C"));
  });

  it("CON-6 hull staircase: H1→H2 ⇒ col(H1) < col(H2)", () => {
    const col = columnsForContainer(["H1", "H2"], [he("H1", "H2")], false, rank0);
    expect(col.get("H1")!).toBeLessThan(col.get("H2")!);
  });

  it("cyclic container → sequential columns 0,1,2 in model order (no longest-path)", () => {
    const col = columnsForContainer(
      ["a", "b", "c"],
      [he("a", "b"), he("b", "a")], // a cycle — ignored
      true,
      rank0,
    );
    expect(col.get("a")).toBe(0);
    expect(col.get("b")).toBe(1);
    expect(col.get("c")).toBe(2);
  });
});

// ── layerTree ─────────────────────────────────────────────────────────────

describe("layerTree", () => {
  const diamondTree = (): CompoundNode =>
    container("r", [leaf("A", 0), leaf("B", 1), leaf("C", 2), leaf("D", 3)]);
  const diamondLattice = (): Lattice =>
    lattice([["r", [he("A", "B"), he("A", "C"), he("B", "D"), he("C", "D")]]]);

  it("assigns localColumn to every node (root = 0)", () => {
    const laid = layerTree(diamondTree(), diamondLattice());
    expect(laid.localColumn).toBe(0);
    const byKey = new Map(laid.children.map((c) => [c.key, c.localColumn]));
    expect(byKey.get("A")).toBe(0);
    expect(byKey.get("B")).toBe(1);
    expect(byKey.get("C")).toBe(1);
    expect(byKey.get("D")).toBe(2);
  });

  it("stacks a cyclic container's children sequentially", () => {
    const tree = container("r", [leaf("a", 0), leaf("b", 1)]);
    const laid = layerTree(tree, lattice([["r", [he("a", "b"), he("b", "a")]]], ["r"]));
    const byKey = new Map(laid.children.map((c) => [c.key, c.localColumn]));
    expect(byKey.get("a")).toBe(0);
    expect(byKey.get("b")).toBe(1);
  });

  it("is pure — does not mutate the input tree", () => {
    const tree = diamondTree();
    expect(tree.children[1].localColumn).toBeUndefined();
    layerTree(tree, diamondLattice());
    expect(tree.children[1].localColumn).toBeUndefined();
    expect(tree.localColumn).toBeUndefined();
  });

  it("is deterministic over two runs", () => {
    const flat = (n: CompoundNode): Array<[string, number]> => {
      const out: Array<[string, number]> = [[n.key, n.localColumn ?? -1]];
      for (const c of n.children) {
        out.push(...flat(c));
      }
      return out.sort((a, b) => a[0].localeCompare(b[0]));
    };
    const a = flat(layerTree(diamondTree(), diamondLattice()));
    const b = flat(layerTree(diamondTree(), diamondLattice()));
    expect(a).toEqual(b);
  });
});

// ── layeringMeta ──────────────────────────────────────────────────────────

describe("layeringMeta", () => {
  it("aligned fan-out → rate 1.0, zero violations", () => {
    const tree = container("r", [leaf("A", 0), leaf("B", 1), leaf("C", 2), leaf("D", 3)]);
    const lat = lattice([["r", [he("A", "B"), he("A", "C"), he("B", "D"), he("C", "D")]]]);
    const meta = layeringMeta(layerTree(tree, lat), lat);
    expect(meta.fanoutSetCount).toBe(1);
    expect(meta.fanoutColumnRate).toBe(1);
    expect(meta.con1Violations).toBe(0);
    expect(meta.con6Violations).toBe(0);
  });

  it("T1>T4 un-aligned fan-out is counted as un-aligned (rate < 1, never vacuous)", () => {
    const tree = container("r", [leaf("A", 0), leaf("B", 1), leaf("C", 2)]);
    const lat = lattice([["r", [he("A", "B"), he("A", "C"), he("B", "C")]]]);
    const meta = layeringMeta(layerTree(tree, lat), lat);
    expect(meta.fanoutSetCount).toBe(1);
    expect(meta.fanoutColumnRate).toBe(0);
    expect(meta.con1Violations).toBe(0); // precedence still satisfied
  });

  it("rate is 0 (not 1) on an empty fan-out denominator", () => {
    const tree = container("r", [leaf("A", 0), leaf("B", 1)]);
    const lat = lattice([["r", [he("A", "B")]]]);
    const meta = layeringMeta(layerTree(tree, lat), lat);
    expect(meta.fanoutSetCount).toBe(0);
    expect(meta.fanoutColumnRate).toBe(0);
  });

  it("excuses cyclic containers from violation + fan-out counts", () => {
    const tree = container("r", [leaf("a", 0), leaf("b", 1)]);
    const lat = lattice([["r", [he("a", "b"), he("b", "a")]]], ["r"]);
    const meta = layeringMeta(layerTree(tree, lat), lat);
    expect(meta.con1Violations).toBe(0);
    expect(meta.fanoutSetCount).toBe(0);
    expect(meta.cyclicContainerCount).toBe(1);
  });

  it("counts CON-6 staircase violations on container→container edges (none expected)", () => {
    // r contains two sub-containers H1,H2 with H1→H2.
    const h1 = container("H1", [leaf("x", 0)], "vpc");
    const h2 = container("H2", [leaf("y", 1)], "vpc");
    const tree = container("r", [h1, h2], "region");
    const lat = lattice([["r", [he("H1", "H2")]]]);
    const meta = layeringMeta(layerTree(tree, lat), lat);
    expect(meta.con1Violations).toBe(0);
    expect(meta.con6Violations).toBe(0);
  });
});

// ── layeringStage ─────────────────────────────────────────────────────────

describe("layeringStage", () => {
  it("returns a new (cloned) tree plus scalar meta", () => {
    const tree = container("r", [leaf("A", 0), leaf("B", 1)]);
    const lat = lattice([["r", [he("A", "B")]]]);
    const result = layeringStage(tree, lat, { compact: true });
    expect(result.tree).not.toBe(tree);
    expect(result.tree.localColumn).toBe(0);
    expect(typeof result.meta!.fanoutColumnRate).toBe("number");
    expect(typeof result.meta!.con1Violations).toBe("number");
  });
});
