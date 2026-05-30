import { describe, expect, it } from "vitest";

import { applyPipelineVerticalSolver } from "./terraformPipelineVerticalSolver";

import type { PipelineAtomEdge } from "./terraformPipelineAtoms";
import type {
  PipelineAtomPlacement,
  PipelineColumn,
} from "./terraformPipelineContainers";
import type { TerraformPipelineVerticalSolverMode } from "./terraformPipelineLayoutMode";

const HEIGHT = 96;
const GAP = 24;

const geo = {
  accountId: "1",
  region: "us-east-1",
  vpcId: null,
  tier: "regional" as const,
  subnetSignature: "",
};

function placement(
  primaryAddress: string,
  columnIndex: number,
  laneIndex: number,
  packedOffsetY: number,
): PipelineAtomPlacement {
  return {
    primaryAddress,
    columnIndex,
    laneIndex,
    packedOffsetY,
    geo,
    geoInstanceId: 0,
    geoInstanceKey: "geo",
  };
}

function graph() {
  const placements = [
    placement("src", 0, 0, 48),
    placement("left", 1, 0, 48),
    placement("right", 1, 1, 168),
    placement("sink", 2, 0, 48),
  ];
  const columns: PipelineColumn[] = [
    { columnIndex: 0, atoms: ["src"], laneCount: 1 },
    { columnIndex: 1, atoms: ["left", "right"], laneCount: 2 },
    { columnIndex: 2, atoms: ["sink"], laneCount: 1 },
  ];
  const edges: PipelineAtomEdge[] = [
    { source: "src", target: "left", sequence: 0 },
    { source: "src", target: "right", sequence: 1 },
    { source: "left", target: "sink", sequence: 2 },
    { source: "right", target: "sink", sequence: 3 },
  ];
  const slotHeight = new Map(placements.map((p) => [p.primaryAddress, HEIGHT]));
  const colByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.columnIndex]),
  );
  return { placements, columns, edges, slotHeight, colByAtom };
}

function edgeLengthSquared(
  placements: readonly PipelineAtomPlacement[],
  edges: readonly PipelineAtomEdge[],
): number {
  const y = new Map(
    placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
  );
  return edges.reduce((sum, edge) => {
    const dy = (y.get(edge.target) ?? 0) - (y.get(edge.source) ?? 0);
    return sum + dy * dy;
  }, 0);
}

function assertNoColumnOverlap(
  placements: readonly PipelineAtomPlacement[],
  columns: readonly PipelineColumn[],
) {
  const byAtom = new Map(placements.map((p) => [p.primaryAddress, p]));
  for (const col of columns) {
    for (let i = 1; i < col.atoms.length; i++) {
      const prev = byAtom.get(col.atoms[i - 1]!)!;
      const next = byAtom.get(col.atoms[i]!)!;
      expect(
        (next.packedOffsetY ?? 0) - (prev.packedOffsetY ?? 0),
      ).toBeGreaterThanOrEqual(HEIGHT + GAP - 0.001);
    }
  }
}

async function solve(mode: TerraformPipelineVerticalSolverMode) {
  const g = graph();
  const before = edgeLengthSquared(g.placements, g.edges);
  const result = await applyPipelineVerticalSolver(
    g.placements,
    g.columns,
    g.edges,
    g.slotHeight,
    g.colByAtom,
    { mode },
  );
  return {
    ...g,
    result,
    before,
    after: edgeLengthSquared(g.placements, g.edges),
  };
}

describe("applyPipelineVerticalSolver", () => {
  it.each(["none", "constrained-ls", "elk", "exact-qp"] as const)(
    "preserves non-overlap and fixed column membership in %s mode",
    async (mode) => {
      const solved = await solve(mode);
      expect(
        solved.placements.map((p) => [p.primaryAddress, p.columnIndex]),
      ).toEqual([
        ["src", 0],
        ["left", 1],
        ["right", 1],
        ["sink", 2],
      ]);
      assertNoColumnOverlap(solved.placements, solved.columns);
    },
  );

  it("reduces global adjacent-edge vertical length for constrained and exact modes", async () => {
    const constrained = await solve("constrained-ls");
    const exact = await solve("exact-qp");
    expect(constrained.after).toBeLessThan(constrained.before);
    expect(exact.after).toBeLessThan(exact.before);
  });

  it("keeps exact QP no worse than constrained LS on the same graph", async () => {
    const constrained = await solve("constrained-ls");
    const exact = await solve("exact-qp");
    expect(exact.after).toBeLessThanOrEqual(constrained.after + 0.001);
  });

  it("uses ELK only for desired Y and keeps atom count and columns", async () => {
    const solved = await solve("elk");
    expect(solved.result.appliedMode).toBe("elk");
    expect(solved.placements).toHaveLength(4);
    expect(solved.columns.map((col) => col.atoms)).toEqual([
      ["src"],
      ["left", "right"],
      ["sink"],
    ]);
  });
});
