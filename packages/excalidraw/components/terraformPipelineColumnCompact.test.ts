/**
 * Pure-pass unit tests for `compactColumns` (M5c column compaction / pull-left).
 * The geometry oracle is stubbed so these isolate the STRUCTURAL contract: lower-bound
 * math, multi-step leftward landing, empty-column re-dense-rank, cross-axis + fan-group
 * refusal, the no-source→col-0 rule, the measure veto + safe fallback, the eval cap, and
 * determinism. The real measured behaviour is covered end-to-end through
 * `layoutTerraformFromSources` in `terraformLayoutCoreRcllThreading.test.ts`.
 */
import { describe, expect, it } from "vitest";

import {
  compactColumns,
  type ColumnCompactLeaf,
  type ColumnCompactMeasure,
} from "./terraformPipelineColumnCompact";

type Adjacency = ReadonlyMap<string, readonly string[]>;

const leaves = (...ids: string[]): ColumnCompactLeaf[] =>
  ids.map((clusterId, i) => ({ clusterId, firstSequence: i }));

/** Build fanout + fanin adjacency from a list of directed edges `[from, to]`. */
const edges = (
  list: [string, string][],
): { fanout: Adjacency; fanin: Adjacency } => {
  const fanout = new Map<string, string[]>();
  const fanin = new Map<string, string[]>();
  for (const [from, to] of list) {
    (fanout.get(from) ?? fanout.set(from, []).get(from)!).push(to);
    (fanin.get(to) ?? fanin.set(to, []).get(to)!).push(from);
  }
  return { fanout, fanin };
};

/** Width = (max column index) + 1; no frame heights ⇒ the height check is vacuous, so
 * any structurally-legal left move is accepted (width never grows on a left move). */
const freeMeasure = (trial: ReadonlyMap<string, number>): ColumnCompactMeasure => {
  let maxCol = 0;
  for (const v of trial.values()) {
    maxCol = Math.max(maxCol, v);
  }
  return { width: maxCol + 1, nodeHeights: new Map() };
};

describe("compactColumns — structural contract", () => {
  it("pulls an independent leaf left into whitespace and reclaims a column; chain stays put", () => {
    // a(0)→b(1)→c(2) is already minimal (each pinned by its predecessor); d(3) is free.
    const cols = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);
    const { fanout, fanin } = edges([
      ["a", "b"],
      ["b", "c"],
    ]);
    const out = compactColumns(
      leaves("a", "b", "c", "d"),
      cols,
      fanout,
      fanin,
      freeMeasure,
    );
    expect(out.movedCount).toBe(1);
    expect(out.colByCluster.get("d")).toBe(0);
    expect(out.colByCluster.get("b")).toBe(1); // chain untouched
    expect(out.colByCluster.get("c")).toBe(2);
    // cols used after the move: {0,1,2} ⇒ one rightmost column reclaimed.
    expect(out.reclaimedCols).toBe(1);
  });

  it("respects the predecessor lower bound: a leaf lands just right of its deepest source", () => {
    // a(0) → b(2); b otherwise free ⇒ leftmost legal column is max(col(a))+1 = 1.
    const cols = new Map([
      ["a", 0],
      ["b", 2],
    ]);
    const { fanout, fanin } = edges([["a", "b"]]);
    const out = compactColumns(
      leaves("a", "b"),
      cols,
      fanout,
      fanin,
      freeMeasure,
    );
    expect(out.colByCluster.get("b")).toBe(1);
    expect(out.colByCluster.get("a")!).toBeLessThan(out.colByCluster.get("b")!);
  });

  it("a no-source leaf may reach column 0 while staying left of its target", () => {
    // x(2) → t(3); x has no source ⇒ lowerBound 0, target t stays at 3.
    const cols = new Map([
      ["x", 2],
      ["t", 3],
    ]);
    const { fanout, fanin } = edges([["x", "t"]]);
    const out = compactColumns(
      leaves("x", "t"),
      cols,
      fanout,
      fanin,
      freeMeasure,
    );
    expect(out.colByCluster.get("x")).toBe(0);
    expect(out.colByCluster.get("x")!).toBeLessThan(out.colByCluster.get("t")!);
  });

  it("refuses a leaf with a cross-axis (out-of-hull) neighbour", () => {
    const cols = new Map([
      ["a", 0],
      ["b", 2],
    ]);
    // b's source `external` is NOT in the leaf set ⇒ cross-axis ⇒ refuse.
    const { fanout, fanin } = edges([["external", "b"]]);
    const out = compactColumns(
      leaves("a", "b"),
      cols,
      fanout,
      fanin,
      freeMeasure,
    );
    expect(out.movedCount).toBe(0);
    expect(out.colByCluster.get("b")).toBe(2);
  });

  it("refuses to split a fan group (shared source with a column-mate)", () => {
    // s(0) → b(2) and s(0) → c(2): b and c are column-mates at col 2 sharing source s.
    // Moving either would split the fan group ⇒ refused.
    const cols = new Map([
      ["s", 0],
      ["b", 2],
      ["c", 2],
    ]);
    const { fanout, fanin } = edges([
      ["s", "b"],
      ["s", "c"],
    ]);
    const out = compactColumns(
      leaves("s", "b", "c"),
      cols,
      fanout,
      fanin,
      freeMeasure,
    );
    expect(out.movedCount).toBe(0);
  });

  it("vetoes a move when the measure reports width growth (safe fallback to base)", () => {
    const cols = new Map([
      ["a", 0],
      ["d", 3],
    ]);
    // Any trial that moves d reports a wider hull ⇒ rejected ⇒ base map untouched.
    const vetoMeasure = (
      trial: ReadonlyMap<string, number>,
    ): ColumnCompactMeasure => ({
      width: (trial.get("d") ?? 3) < 3 ? 999 : 1,
      nodeHeights: new Map(),
    });
    const out = compactColumns(
      leaves("a", "d"),
      cols,
      new Map(),
      new Map(),
      vetoMeasure,
    );
    expect(out.movedCount).toBe(0);
    expect(out.reclaimedCols).toBe(0);
    expect(out.colByCluster.get("d")).toBe(3);
  });

  it("vetoes a move when the measure reports a frame growing taller", () => {
    const cols = new Map([
      ["a", 0],
      ["d", 3],
    ]);
    const baselineHeights = new Map([["frame", 100]]);
    const heightVeto = (
      trial: ReadonlyMap<string, number>,
    ): ColumnCompactMeasure => ({
      width: 4,
      nodeHeights:
        (trial.get("d") ?? 3) < 3
          ? new Map([["frame", 200]])
          : baselineHeights,
    });
    const out = compactColumns(
      leaves("a", "d"),
      cols,
      new Map(),
      new Map(),
      heightVeto,
    );
    expect(out.movedCount).toBe(0);
  });

  it("is deterministic (same input ⇒ byte-identical column map)", () => {
    const cols = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 3],
      ["d", 4],
    ]);
    const { fanout, fanin } = edges([
      ["a", "c"],
      ["b", "d"],
    ]);
    const run = () =>
      compactColumns(
        leaves("a", "b", "c", "d"),
        new Map(cols),
        fanout,
        fanin,
        freeMeasure,
      ).colByCluster;
    expect([...run().entries()]).toEqual([...run().entries()]);
  });

  it("returns the base map unchanged when nothing can move (OFF byte-identical)", () => {
    const out = compactColumns(
      leaves("a"),
      new Map([["a", 0]]),
      new Map(),
      new Map(),
      freeMeasure,
    );
    expect(out.movedCount).toBe(0);
    expect(out.reclaimedCols).toBe(0);
    expect(out.colByCluster.get("a")).toBe(0);
  });
});
