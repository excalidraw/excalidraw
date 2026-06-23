import { describe, expect, it } from "vitest";

import {
  straightenColumns,
  type StraightenLeaf,
} from "./terraformPipelineStraighten";

const GAP = 36;
const H = 100;

const leaf = (
  key: string,
  col: number,
  order: number,
  height = H,
): StraightenLeaf => ({ key, clusterId: key, col, height, order });

/** Build fanout/fanin maps from directed edges [source, target] (source col < target col). */
const edges = (es: [string, string][]) => {
  const fanout = new Map<string, string[]>();
  const fanin = new Map<string, string[]>();
  for (const [s, t] of es) {
    (fanout.get(s) ?? fanout.set(s, []).get(s)!).push(t);
    (fanin.get(t) ?? fanin.set(t, []).get(t)!).push(s);
  }
  return { fanout, fanin };
};

describe("terraformPipelineStraighten", () => {
  it("empty input → empty map", () => {
    expect(straightenColumns([], new Map(), new Map(), 0, GAP).size).toBe(0);
  });

  it("straightens a single chain across columns to one Y", () => {
    // A(col0) → B(col1) → C(col2), one per column.
    const leaves = [leaf("A", 0, 0), leaf("B", 1, 0), leaf("C", 2, 0)];
    const { fanout, fanin } = edges([
      ["A", "B"],
      ["B", "C"],
    ]);
    const y = straightenColumns(leaves, fanout, fanin, 0, GAP);
    expect(y.get("A")).toBe(0);
    expect(y.get("B")).toBe(0);
    expect(y.get("C")).toBe(0);
  });

  it("never overlaps within a column and preserves order", () => {
    // S(col0) fans out to A,B,C (col1, order 0/1/2).
    const leaves = [
      leaf("S", 0, 0),
      leaf("A", 1, 0),
      leaf("B", 1, 1),
      leaf("C", 1, 2),
    ];
    const { fanout, fanin } = edges([
      ["S", "A"],
      ["S", "B"],
      ["S", "C"],
    ]);
    const y = straightenColumns(leaves, fanout, fanin, 0, GAP);
    // order preserved: A above B above C.
    expect(y.get("A")! + H + GAP).toBeLessThanOrEqual(y.get("B")!);
    expect(y.get("B")! + H + GAP).toBeLessThanOrEqual(y.get("C")!);
    // top clamped to segmentTop.
    expect(Math.min(...y.values())).toBe(0);
  });

  it("centers a fan-out hub between its targets (not pinned to the first)", () => {
    const leaves = [
      leaf("S", 0, 0),
      leaf("A", 1, 0),
      leaf("B", 1, 1),
      leaf("C", 1, 2),
    ];
    const { fanout, fanin } = edges([
      ["S", "A"],
      ["S", "B"],
      ["S", "C"],
    ]);
    const y = straightenColumns(leaves, fanout, fanin, 0, GAP);
    const sCenter = y.get("S")! + H / 2;
    const aCenter = y.get("A")! + H / 2;
    const cCenter = y.get("C")! + H / 2;
    // hub sits strictly inside the target span — not stacked at the top.
    expect(sCenter).toBeGreaterThan(aCenter);
    expect(sCenter).toBeLessThan(cCenter);
  });

  it("is deterministic across runs", () => {
    const leaves = [
      leaf("S", 0, 0),
      leaf("A", 1, 0),
      leaf("B", 1, 1),
      leaf("T", 2, 0),
    ];
    const { fanout, fanin } = edges([
      ["S", "A"],
      ["S", "B"],
      ["A", "T"],
      ["B", "T"],
    ]);
    const a = straightenColumns(leaves, fanout, fanin, 0, GAP);
    const b = straightenColumns(leaves, fanout, fanin, 0, GAP);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("respects a non-zero segmentTop (no leaf above it)", () => {
    const leaves = [leaf("A", 0, 0), leaf("B", 1, 0)];
    const { fanout, fanin } = edges([["A", "B"]]);
    const y = straightenColumns(leaves, fanout, fanin, 500, GAP);
    expect(Math.min(...y.values())).toBeGreaterThanOrEqual(500);
  });

  it("ignores cross-column (non-adjacent) edges for alignment but never crashes", () => {
    // A(col0) → C(col2): a long edge with no node in col1 to chain through.
    const leaves = [leaf("A", 0, 0), leaf("B", 1, 0), leaf("C", 2, 0)];
    const { fanout, fanin } = edges([["A", "C"]]);
    const y = straightenColumns(leaves, fanout, fanin, 0, GAP);
    expect(y.size).toBe(3);
    // all singletons in their column, clamped to top.
    expect(Math.min(...y.values())).toBe(0);
  });
});
