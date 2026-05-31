import { describe, expect, it } from "vitest";

import { buildTfdPrimaryParentMap } from "./terraformPipelineTfd";
import {
  applyPipelineVerticalSolver,
  pipelineTrackTargetYByTrackForTest,
} from "./terraformPipelineVerticalSolver";
import { DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE } from "./terraformPipelineLayoutMode";

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

async function solve(
  mode: TerraformPipelineVerticalSolverMode,
  g = graph(),
) {
  const before = edgeLengthSquared(g.placements, g.edges);
  const result = await applyPipelineVerticalSolver(
    g.placements,
    g.columns,
    g.edges,
    g.slotHeight,
    g.colByAtom,
    {
      mode,
      primaryParent: buildTfdPrimaryParentMap(g.edges),
    },
  );
  return {
    ...g,
    result,
    before,
    after: edgeLengthSquared(g.placements, g.edges),
  };
}

/**
 * Simulates a fragmented global-relayer layout where each API's gateway and
 * compute are in their own single-atom sub-columns (initial Y = 48 from
 * packing), while the shared datastore column contains one store per API at
 * track-band-spaced Y positions (api1_store=48, api2_store=200, api3_store=352).
 *
 * The solver must use the datastore's authoritative Y (200 for api2) rather
 * than the median of all api2 atoms (which is 48, dominated by the two
 * uninitialized single-atom columns) so that api2_compute aligns with
 * api2_store.
 */
function fragmentedChainGraph() {
  const trackGapSpacing = HEIGHT + GAP + 32; // 152
  const placements = [
    // api1 chain: all single-atom cols, api1_store in shared datastore col
    { ...placement("api1_gateway", 0, 0, 48), trackId: "api1" },
    { ...placement("api1_compute", 1, 0, 48), trackId: "api1" },
    { ...placement("api1_store", 3, 0, 48), trackId: "api1" },
    // api2 chain: single-atom cols, api2_store in shared datastore col at 200
    { ...placement("api2_gateway", 0, 1, 48), trackId: "api2" },  // note: same col 0 to keep it simple
    { ...placement("api2_compute", 2, 0, 48), trackId: "api2" },
    { ...placement("api2_store", 3, 1, 48 + trackGapSpacing), trackId: "api2" },
    // api3 chain: similarly
    { ...placement("api3_gateway", 0, 2, 48), trackId: "api3" },
    { ...placement("api3_compute", 4, 0, 48), trackId: "api3" },
    { ...placement("api3_store", 3, 2, 48 + trackGapSpacing * 2), trackId: "api3" },
  ];

  // api2_compute (col 2) and api2_store (col 3) are NOT adjacent in the col 2→3 packing sense
  // because api2_compute is a single-atom sub-column that ended up far from the datastore.
  // The shared datastore column (col 3) has api1_store, api2_store, api3_store.
  const columns: PipelineColumn[] = [
    { columnIndex: 0, atoms: ["api1_gateway", "api2_gateway", "api3_gateway"], laneCount: 3 },
    { columnIndex: 1, atoms: ["api1_compute"], laneCount: 1 },
    { columnIndex: 2, atoms: ["api2_compute"], laneCount: 1 },
    { columnIndex: 3, atoms: ["api1_store", "api2_store", "api3_store"], laneCount: 3 },
    { columnIndex: 4, atoms: ["api3_compute"], laneCount: 1 },
  ];

  const edges: PipelineAtomEdge[] = [
    { source: "api1_gateway", target: "api1_compute", sequence: 0 },
    { source: "api2_gateway", target: "api2_compute", sequence: 1 },
    { source: "api3_gateway", target: "api3_compute", sequence: 2 },
    { source: "api1_compute", target: "api1_store", sequence: 3 },
    { source: "api2_compute", target: "api2_store", sequence: 4 },
    { source: "api3_compute", target: "api3_store", sequence: 5 },
  ];

  const slotHeight = new Map(placements.map((p) => [p.primaryAddress, HEIGHT]));
  const colByAtom = new Map(placements.map((p) => [p.primaryAddress, p.columnIndex]));
  return { placements, columns, edges, slotHeight, colByAtom };
}

function fanoutGraph() {
  // relay(col0) -> api1..api5(col1, spaced with track gaps)
  // api1..api5 have the track-gap-separated initial Y values that
  // assignPipelineColumnPackedY produces for 5 distinct API tracks.
  const trackGapSpacing = HEIGHT + GAP + 32; // 152 — matches TRACK_GAP=32
  const placements = [
    { ...placement("relay", 0, 0, 48), trackId: "trunk" },
    { ...placement("api1", 1, 0, 48), trackId: "api1" },
    { ...placement("api2", 1, 1, 48 + trackGapSpacing), trackId: "api2" },
    { ...placement("api3", 1, 2, 48 + trackGapSpacing * 2), trackId: "api3" },
    { ...placement("api4", 1, 3, 48 + trackGapSpacing * 3), trackId: "api4" },
    { ...placement("api5", 1, 4, 48 + trackGapSpacing * 4), trackId: "api5" },
  ];
  const columns: PipelineColumn[] = [
    { columnIndex: 0, atoms: ["relay"], laneCount: 1 },
    { columnIndex: 1, atoms: ["api1", "api2", "api3", "api4", "api5"], laneCount: 5 },
  ];
  const edges: PipelineAtomEdge[] = [
    { source: "relay", target: "api1", sequence: 0 },
    { source: "relay", target: "api2", sequence: 1 },
    { source: "relay", target: "api3", sequence: 2 },
    { source: "relay", target: "api4", sequence: 3 },
    { source: "relay", target: "api5", sequence: 4 },
  ];
  const slotHeight = new Map(placements.map((p) => [p.primaryAddress, HEIGHT]));
  const colByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.columnIndex]),
  );
  return { placements, columns, edges, slotHeight, colByAtom };
}

function computeSsmStoreFanoutGraph() {
  const trackGapSpacing = HEIGHT + GAP + 32;
  const placements = [
    { ...placement("compute", 1, 0, 48), trackId: "api2" },
    { ...placement("ssm", 2, 0, 48), trackId: "api2" },
    {
      ...placement("store", 4, 0, 48 + trackGapSpacing),
      trackId: "api2",
    },
  ];
  const columns: PipelineColumn[] = [
    { columnIndex: 1, atoms: ["compute"], laneCount: 1 },
    { columnIndex: 2, atoms: ["ssm"], laneCount: 1 },
    { columnIndex: 4, atoms: ["store"], laneCount: 1 },
  ];
  const edges: PipelineAtomEdge[] = [
    { source: "compute", target: "ssm", sequence: 0 },
    { source: "compute", target: "store", sequence: 1 },
  ];
  const slotHeight = new Map(placements.map((p) => [p.primaryAddress, HEIGHT]));
  const colByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.columnIndex]),
  );
  return { placements, columns, edges, slotHeight, colByAtom };
}

function cascadeHandoffGraph() {
  const trackGapSpacing = HEIGHT + GAP + 32;
  const placements = [
    { ...placement("api4_compute", 3, 0, 48 + trackGapSpacing * 3), trackId: "api4" },
    { ...placement("api6_gateway", 5, 0, 48 + trackGapSpacing * 5), trackId: "api6" },
  ];
  const columns: PipelineColumn[] = [
    { columnIndex: 3, atoms: ["api4_compute"], laneCount: 1 },
    { columnIndex: 5, atoms: ["api6_gateway"], laneCount: 1 },
  ];
  const edges: PipelineAtomEdge[] = [
    { source: "api4_compute", target: "api6_gateway", sequence: 0 },
  ];
  const slotHeight = new Map(placements.map((p) => [p.primaryAddress, HEIGHT]));
  const colByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.columnIndex]),
  );
  return { placements, columns, edges, slotHeight, colByAtom };
}

describe("applyPipelineVerticalSolver", () => {
  it("defaults pipeline vertical positioning to track rows", () => {
    expect(DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE).toBe("track-rows");
  });

  it.each([
    "none",
    "track-rows",
    "track-rows-cascade",
    "track-rows-reorder",
    "straight-y",
    "straight-reorder",
    "straight-relay",
    "constrained-ls",
    "elk",
    "exact-qp",
  ] as const)(
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

  it("keeps straight reorder no worse than straight Y for horizontal edge count", async () => {
    const straightY = await solve("straight-y");
    const reordered = await solve("straight-reorder");
    const horizontalCount = (placements: readonly PipelineAtomPlacement[]) => {
      const y = new Map(
        placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
      );
      return straightY.edges.filter(
        (edge) =>
          Math.abs((y.get(edge.source) ?? 0) - (y.get(edge.target) ?? 0)) < 2,
      ).length;
    };
    expect(horizontalCount(reordered.placements)).toBeGreaterThanOrEqual(
      horizontalCount(straightY.placements),
    );
  });

  it("track-rows centers relay on fan-out targets without compressing their spacing", async () => {
    const g = fanoutGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const expectedCenter = 48 + trackGapSpacing * 2;

    await applyPipelineVerticalSolver(
      g.placements,
      g.columns,
      g.edges,
      g.slotHeight,
      g.colByAtom,
      {
        mode: "track-rows",
        primaryParent: buildTfdPrimaryParentMap(g.edges),
      },
    );

    const y = new Map(g.placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]));

    expect(Math.abs((y.get("api1") ?? 0) - 48)).toBeLessThan(2);
    expect(Math.abs((y.get("api2") ?? 0) - (48 + trackGapSpacing))).toBeLessThan(2);
    expect(Math.abs((y.get("api3") ?? 0) - (48 + trackGapSpacing * 2))).toBeLessThan(2);
    expect(Math.abs((y.get("api4") ?? 0) - (48 + trackGapSpacing * 3))).toBeLessThan(2);
    expect(Math.abs((y.get("api5") ?? 0) - (48 + trackGapSpacing * 4))).toBeLessThan(2);
    expect(Math.abs((y.get("relay") ?? 0) - expectedCenter)).toBeLessThan(4);
  });

  it("straight-y centers relay on fan-out targets without compressing their spacing", async () => {
    const g = fanoutGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const expectedCenter = 48 + trackGapSpacing * 2; // median of 5 targets = api3

    await applyPipelineVerticalSolver(
      g.placements,
      g.columns,
      g.edges,
      g.slotHeight,
      g.colByAtom,
      {
        mode: "straight-y",
        primaryParent: buildTfdPrimaryParentMap(g.edges),
      },
    );

    const y = new Map(g.placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]));

    // Fan-out targets must preserve their original track-gap spacing.
    expect(Math.abs((y.get("api1") ?? 0) - 48)).toBeLessThan(2);
    expect(Math.abs((y.get("api2") ?? 0) - (48 + trackGapSpacing))).toBeLessThan(2);
    expect(Math.abs((y.get("api3") ?? 0) - (48 + trackGapSpacing * 2))).toBeLessThan(2);
    expect(Math.abs((y.get("api4") ?? 0) - (48 + trackGapSpacing * 3))).toBeLessThan(2);
    expect(Math.abs((y.get("api5") ?? 0) - (48 + trackGapSpacing * 4))).toBeLessThan(2);

    // Relay must converge to the median target Y (api3).
    expect(Math.abs((y.get("relay") ?? 0) - expectedCenter)).toBeLessThan(4);
  });

  it("straight-reorder preserves column non-overlap and valid positions after reorder", async () => {
    const g = fanoutGraph();
    await applyPipelineVerticalSolver(
      g.placements,
      g.columns,
      g.edges,
      g.slotHeight,
      g.colByAtom,
      {
        mode: "straight-reorder",
        primaryParent: buildTfdPrimaryParentMap(g.edges),
      },
    );
    assertNoColumnOverlap(g.placements, g.columns);
    for (const p of g.placements) {
      expect(p.packedOffsetY).toBeDefined();
      expect(Number.isFinite(p.packedOffsetY)).toBe(true);
    }
  });

  it("track-rows aligns compute with store on fragmented global-relayer chain", async () => {
    const trackGapSpacing = HEIGHT + GAP + 32; // 152
    const g = fragmentedChainGraph();
    const primaryParent = buildTfdPrimaryParentMap(g.edges);
    const placements = g.placements.map((p) => ({ ...p }));
    const columns = g.columns.map((c) => ({
      ...c,
      atoms: [...c.atoms],
    }));
    await applyPipelineVerticalSolver(
      placements,
      columns,
      g.edges,
      g.slotHeight,
      g.colByAtom,
      { mode: "track-rows", primaryParent },
    );
    const y = new Map(
      placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
    );
    expect(Math.abs((y.get("api1_compute") ?? 0) - (y.get("api1_store") ?? 0))).toBeLessThan(2);
    expect(Math.abs((y.get("api2_compute") ?? 0) - (y.get("api2_store") ?? 0))).toBeLessThan(2);
    expect(Math.abs((y.get("api3_compute") ?? 0) - (y.get("api3_store") ?? 0))).toBeLessThan(2);
    expect(Math.abs((y.get("api2_compute") ?? 0) - (48 + trackGapSpacing))).toBeLessThan(2);
    assertNoColumnOverlap(placements, columns);
  });

  it("straight-y aligns single-atom compute with its shared-column store using authoritative track Y", async () => {
    const trackGapSpacing = HEIGHT + GAP + 32; // 152
    const g = fragmentedChainGraph();

    const primaryParent = buildTfdPrimaryParentMap(g.edges);

    for (const mode of ["straight-y", "straight-reorder"] as const) {
      const placements = g.placements.map((p) => ({ ...p }));
      const columns = g.columns.map((c) => ({
        ...c,
        atoms: [...c.atoms],
      }));
      await applyPipelineVerticalSolver(
        placements,
        columns,
        g.edges,
        g.slotHeight,
        g.colByAtom,
        { mode, primaryParent },
      );
      const y = new Map(
        placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
      );

      // The shared datastore column is authoritative: api1_store=48, api2_store=200,
      // api3_store=352. Each compute must converge close to its store's Y.
      expect(Math.abs((y.get("api1_compute") ?? 0) - 48)).toBeLessThan(16);
      expect(Math.abs((y.get("api2_compute") ?? 0) - (48 + trackGapSpacing))).toBeLessThanOrEqual(16);
      expect(Math.abs((y.get("api3_compute") ?? 0) - (48 + trackGapSpacing * 2))).toBeLessThan(16);
      assertNoColumnOverlap(placements, columns);
    }
  });

  it("resolves api2 row Y from datastore for fan-out graph", () => {
    const g = computeSsmStoreFanoutGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const atoms = g.placements.map((p) => ({
      atom: p.primaryAddress,
      columnIndex: p.columnIndex,
      initialY: p.packedOffsetY ?? 0,
      halfHeight: HEIGHT / 2,
    }));
    const placementByAtom = new Map(
      g.placements.map((p) => [p.primaryAddress, p]),
    );
    const yByAtom = new Map(
      g.placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
    );
    const targets = pipelineTrackTargetYByTrackForTest(
      atoms,
      g.placements,
      g.columns,
      g.edges,
      yByAtom,
      placementByAtom,
      buildTfdPrimaryParentMap(g.edges),
    );
    expect(targets.get("api2")).toBe(48 + trackGapSpacing);
  });

  it("track-rows aligns compute with store on compute→ssm→store fan-out", async () => {
    const g = computeSsmStoreFanoutGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const primaryParent = buildTfdPrimaryParentMap(g.edges);
    const placements = g.placements.map((p) => ({ ...p }));
    const columns = g.columns.map((c) => ({
      ...c,
      atoms: [...c.atoms],
    }));
    await applyPipelineVerticalSolver(
      placements,
      columns,
      g.edges,
      g.slotHeight,
      g.colByAtom,
      { mode: "track-rows", primaryParent },
    );
    const y = new Map(
      placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
    );
    const rowY = 48 + trackGapSpacing;
    expect(Math.abs((y.get("compute") ?? 0) - rowY)).toBeLessThan(2);
    expect(Math.abs((y.get("store") ?? 0) - rowY)).toBeLessThan(2);
    expect(Math.abs((y.get("ssm") ?? 0) - rowY)).toBeLessThan(2);
  });

  it("straight modes align compute with store not ssm on independent fan-out paths", async () => {
    const g = computeSsmStoreFanoutGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const primaryParent = buildTfdPrimaryParentMap(g.edges);

    for (const mode of ["straight-y", "straight-reorder"] as const) {
      const placements = g.placements.map((p) => ({ ...p }));
      const columns = g.columns.map((c) => ({
        ...c,
        atoms: [...c.atoms],
      }));
      await applyPipelineVerticalSolver(
        placements,
        columns,
        g.edges,
        g.slotHeight,
        g.colByAtom,
        { mode, primaryParent },
      );
      const y = new Map(
        placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
      );
      expect(Math.abs((y.get("compute") ?? 0) - (48 + trackGapSpacing))).toBeLessThanOrEqual(16);
      expect(Math.abs((y.get("store") ?? 0) - (48 + trackGapSpacing))).toBeLessThan(2);
    }
  });

  it("track-rows-cascade aligns cascade compute to downstream gateway", async () => {
    const g = cascadeHandoffGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const primaryParent = buildTfdPrimaryParentMap(g.edges);
    const expectedApi4Y = 48 + trackGapSpacing * 3;
    const placements = g.placements.map((p) => ({ ...p }));
    const columns = g.columns.map((c) => ({
      ...c,
      atoms: [...c.atoms],
    }));
    await applyPipelineVerticalSolver(
      placements,
      columns,
      g.edges,
      g.slotHeight,
      g.colByAtom,
      { mode: "track-rows-cascade", primaryParent },
    );
    const y = new Map(
      placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
    );
    expect(Math.abs((y.get("api4_compute") ?? 0) - expectedApi4Y)).toBeLessThan(2);
    expect(Math.abs((y.get("api6_gateway") ?? 0) - expectedApi4Y)).toBeLessThan(2);
  });

  it("track-rows keeps cascade handoffs on separate API rows (per-api)", async () => {
    const g = cascadeHandoffGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const primaryParent = buildTfdPrimaryParentMap(g.edges);
    const placements = g.placements.map((p) => ({ ...p }));
    const columns = g.columns.map((c) => ({
      ...c,
      atoms: [...c.atoms],
    }));
    await applyPipelineVerticalSolver(
      placements,
      columns,
      g.edges,
      g.slotHeight,
      g.colByAtom,
      { mode: "track-rows", primaryParent },
    );
    const y = new Map(
      placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
    );
    expect(Math.abs((y.get("api4_compute") ?? 0) - (48 + trackGapSpacing * 3))).toBeLessThan(2);
    expect(Math.abs((y.get("api6_gateway") ?? 0) - (48 + trackGapSpacing * 5))).toBeLessThan(2);
  });

  it("straight modes align cascade compute to downstream gateway", async () => {
    const g = cascadeHandoffGraph();
    const trackGapSpacing = HEIGHT + GAP + 32;
    const primaryParent = buildTfdPrimaryParentMap(g.edges);
    const expectedApi4Y = 48 + trackGapSpacing * 3;

    for (const mode of ["straight-y", "straight-reorder"] as const) {
      const placements = g.placements.map((p) => ({ ...p }));
      const columns = g.columns.map((c) => ({
        ...c,
        atoms: [...c.atoms],
      }));
      await applyPipelineVerticalSolver(
        placements,
        columns,
        g.edges,
        g.slotHeight,
        g.colByAtom,
        { mode, primaryParent },
      );
      const y = new Map(
        placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
      );
      expect(Math.abs((y.get("api4_compute") ?? 0) - expectedApi4Y)).toBeLessThan(16);
      expect(Math.abs((y.get("api6_gateway") ?? 0) - expectedApi4Y)).toBeLessThan(16);
    }
  });
});
