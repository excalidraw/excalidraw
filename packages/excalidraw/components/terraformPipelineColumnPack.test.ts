import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import { loadStagingMultiStatePlanDotBundlesFromDb, readStagingMultiStatePipelineTfdFromDb } from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import {
  assignPipelineColumnPackedY,
  buildColumnPackInputs,
  derivePipelineTrackId,
  maxForwardAdjacentColumnDeltaY,
  trackSortIndex,
} from "./terraformPipelineColumnPack";
import { buildPipelineLayoutPlan } from "./terraformPipelineContainers";
import { buildPipelineAtomGeoMap } from "./terraformPipelineGeo";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";

import type {
  PipelineAtomPlacement,
  PipelineColumn,
} from "./terraformPipelineContainers";
import type { PipelineGeoPath } from "./terraformPipelineGeo";

const NOMINAL_SLOT = 96;

const REGIONAL_GEO: PipelineGeoPath = {
  accountId: "1",
  region: "us-east-1",
  vpcId: null,
  tier: "regional",
  subnetSignature: "",
};
const PACK_GAP = 24;
/** Matches pipeline declared-edge horizontal attachment tolerance. */
const Y_ALIGN_EPS = 2;
const CHAIN_ALIGN_EPS = 4;
function boundsOverlap(
  a: { top: number; bottom: number },
  b: { top: number; bottom: number },
): boolean {
  return a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

function packPlacements(
  layoutPlan: {
    placements: PipelineAtomPlacement[];
    columns: PipelineColumn[];
  },
  edges: Parameters<typeof assignPipelineColumnPackedY>[2],
  slotHeight?: ReadonlyMap<string, number>,
): void {
  const heights =
    slotHeight ??
    new Map(
      layoutPlan.placements.map((p) => [p.primaryAddress, NOMINAL_SLOT]),
    );
  const { colByAtom } = buildColumnPackInputs(layoutPlan, heights);
  assignPipelineColumnPackedY(
    layoutPlan.placements,
    layoutPlan.columns,
    edges,
    heights,
    colByAtom,
  );
}

function adjacentColumnEdgeDeltaY(
  placements: readonly PipelineAtomPlacement[],
  edges: Array<{ source: string; target: string }>,
): number {
  const colByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.columnIndex]),
  );
  const yByAtom = new Map(
    placements.map((p) => [p.primaryAddress, p.packedOffsetY ?? 0]),
  );
  let sum = 0;
  for (const e of edges) {
    const sc = colByAtom.get(e.source);
    const tc = colByAtom.get(e.target);
    if (sc == null || tc == null || Math.abs(sc - tc) !== 1) {
      continue;
    }
    const sy = yByAtom.get(e.source);
    const ty = yByAtom.get(e.target);
    if (sy == null || ty == null) {
      continue;
    }
    sum += Math.abs(sy - ty);
  }
  return sum;
}

describe("derivePipelineTrackId", () => {
  it("maps gateway stack addresses to apiN tracks", () => {
    const parent = new Map<string, string>();
    expect(
      derivePipelineTrackId(
        "module.x.aws_api_gateway_rest_api.api6_gateway",
        parent,
      ),
    ).toBe("api6");
    expect(
      derivePipelineTrackId(
        "111::45-east-api-6::aws_lambda_function.compute",
        parent,
      ),
    ).toBe("api6");
  });

  it("walks primary-parent chain to gateway track", () => {
    const parent = new Map([
      [
        "module.x.aws_ssm_parameter.api6_ssm",
        "111::45-east-api-6::aws_lambda_function.compute",
      ],
    ]);
    expect(
      derivePipelineTrackId("module.x.aws_ssm_parameter.api6_ssm", parent),
    ).toBe("api6");
  });
});

describe("assignPipelineColumnPackedY", () => {
  it("packs atoms in the same column without vertical overlap", () => {
    const placements: PipelineAtomPlacement[] = [
      {
        primaryAddress: "a",
        columnIndex: 1,
        laneIndex: 0,
        trackId: "api1",
        geo: REGIONAL_GEO,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
      {
        primaryAddress: "b",
        columnIndex: 1,
        laneIndex: 1,
        trackId: "api2",
        geo: REGIONAL_GEO,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
      {
        primaryAddress: "c",
        columnIndex: 1,
        laneIndex: 2,
        trackId: "api3",
        geo: REGIONAL_GEO,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
    ];
    const columns = [{ columnIndex: 1, atoms: ["a", "b", "c"], laneCount: 3 }];
    const slotHeight = new Map([
      ["a", 80],
      ["b", 80],
      ["c", 80],
    ]);
    packPlacements({ placements, columns }, [], slotHeight);

    const boxes = placements.map((p) => {
      const h = slotHeight.get(p.primaryAddress)!;
      const cy = p.packedOffsetY!;
      return { top: cy - h / 2, bottom: cy + h / 2 };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boundsOverlap(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
    expect(placements.every((p) => p.packedOffsetY != null)).toBe(true);
  });

  it("pins gateway → compute → ssm on forward edges within one chain", () => {
    const geo = REGIONAL_GEO;
    const placements: PipelineAtomPlacement[] = [
      {
        primaryAddress: "gw",
        columnIndex: 0,
        laneIndex: 0,
        trackId: "api1",
        geo,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
      {
        primaryAddress: "cmp",
        columnIndex: 1,
        laneIndex: 0,
        trackId: "api1",
        geo,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
      {
        primaryAddress: "ssm",
        columnIndex: 2,
        laneIndex: 0,
        trackId: "api1",
        geo,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
    ];
    const columns = [
      { columnIndex: 0, atoms: ["gw"], laneCount: 1 },
      { columnIndex: 1, atoms: ["cmp"], laneCount: 1 },
      { columnIndex: 2, atoms: ["ssm"], laneCount: 1 },
    ];
    const edges = [
      { source: "gw", target: "cmp", sequence: 0 },
      { source: "cmp", target: "ssm", sequence: 1 },
    ];
    const slotHeight = new Map([
      ["gw", 60],
      ["cmp", 60],
      ["ssm", 60],
    ]);
    packPlacements({ placements, columns }, edges, slotHeight);
    const gwY = placements.find((p) => p.primaryAddress === "gw")!.packedOffsetY!;
    const cmpY = placements.find((p) => p.primaryAddress === "cmp")!.packedOffsetY!;
    const ssmY = placements.find((p) => p.primaryAddress === "ssm")!.packedOffsetY!;
    expect(Math.abs(gwY - cmpY)).toBeLessThan(CHAIN_ALIGN_EPS);
    expect(Math.abs(cmpY - ssmY)).toBeLessThan(CHAIN_ALIGN_EPS);
  });

  it("aligns a forward fanout child to parent Y when alone in its column", () => {
    const placements: PipelineAtomPlacement[] = [
      {
        primaryAddress: "root",
        columnIndex: 0,
        laneIndex: 0,
        trackId: "trunk",
        geo: REGIONAL_GEO,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
      {
        primaryAddress: "a",
        columnIndex: 1,
        laneIndex: 0,
        trackId: "api1",
        geo: REGIONAL_GEO,
        geoInstanceId: 0,
        geoInstanceKey: "k0",
      },
    ];
    const columns = [
      { columnIndex: 0, atoms: ["root"], laneCount: 1 },
      { columnIndex: 1, atoms: ["a"], laneCount: 1 },
    ];
    const edges = [{ source: "root", target: "a", sequence: 0 }];
    const slotHeight = new Map([
      ["root", 60],
      ["a", 60],
    ]);
    packPlacements({ placements, columns }, edges, slotHeight);
    const rootY = placements.find((p) => p.primaryAddress === "root")!.packedOffsetY!;
    const aY = placements.find((p) => p.primaryAddress === "a")!.packedOffsetY!;
    expect(Math.abs(rootY - aY)).toBeLessThan(CHAIN_ALIGN_EPS);
  });

  it("preserves columnIndex on staging", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced, stackIds } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const graph = graphlibDot.read("digraph G {}\n");
    const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
      adjacency: {},
      priorStatePlans: merged.sourcePlans,
      stackIds,
    });
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    applyDeclaredDataFlowFromMany(nodes, [tfd]);

    const atomGraph = buildPipelineAtomGraph(nodes, merged.plan, [tfd])!;
    const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, merged.plan);
    const layoutPlan = buildPipelineLayoutPlan(atomGraph, geoMap);

    const columnIndexBefore = new Map(
      layoutPlan.placements.map((p) => [p.primaryAddress, p.columnIndex]),
    );

    const packed = layoutPlan.placements.map((p) => ({ ...p }));

    packPlacements(
      { placements: packed, columns: layoutPlan.columns },
      atomGraph.edges,
    );

    for (const p of packed) {
      expect(p.columnIndex).toBe(columnIndexBefore.get(p.primaryAddress));
      expect(p.packedOffsetY).not.toBeUndefined();
    }
  }, 120_000);

  it("aligns west api10/api11 gateway → compute within Y_ALIGN_EPS on staging", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced, stackIds } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const graph = graphlibDot.read("digraph G {}\n");
    const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
      adjacency: {},
      priorStatePlans: merged.sourcePlans,
      stackIds,
    });
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    applyDeclaredDataFlowFromMany(nodes, [tfd]);

    const atomGraph = buildPipelineAtomGraph(nodes, merged.plan, [tfd])!;
    const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, merged.plan);
    const layoutPlan = buildPipelineLayoutPlan(atomGraph, geoMap);

    const slotHeight = new Map(
      layoutPlan.placements.map((p) => [p.primaryAddress, NOMINAL_SLOT]),
    );
    const { colByAtom } = buildColumnPackInputs(layoutPlan, slotHeight);
    assignPipelineColumnPackedY(
      layoutPlan.placements,
      layoutPlan.columns,
      atomGraph.edges,
      slotHeight,
      colByAtom,
    );

    const api10Gw = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("52-west-api-10") &&
        a.includes("aws_api_gateway_rest_api"),
    )!;
    const api10Cmp = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("52-west-api-10") &&
        a.includes("aws_lambda_function"),
    )!;
    const api11Gw = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("53-west-api-11") &&
        a.includes("aws_api_gateway_rest_api"),
    )!;
    const api11Cmp = [...atomGraph.atoms.keys()].find(
      (a) => a.includes("53-west-api-11") && a.includes("aws_ecs_service"),
    )!;

    const y = (addr: string) =>
      layoutPlan.placements.find((p) => p.primaryAddress === addr)!
        .packedOffsetY!;

    expect(Math.abs(y(api10Gw) - y(api10Cmp))).toBeLessThan(Y_ALIGN_EPS);
    expect(Math.abs(y(api11Gw) - y(api11Cmp))).toBeLessThan(Y_ALIGN_EPS);

    const gwCmpDelta = Math.max(
      Math.abs(y(api10Gw) - y(api10Cmp)),
      Math.abs(y(api11Gw) - y(api11Cmp)),
    );
    expect(
      maxForwardAdjacentColumnDeltaY(
        layoutPlan.placements,
        atomGraph.edges,
        colByAtom,
      ),
    ).toBeGreaterThanOrEqual(gwCmpDelta);
  }, 120_000);
});

describe("trackSortIndex", () => {
  it("orders trunk before api lanes", () => {
    expect(trackSortIndex("trunk")).toBeLessThan(trackSortIndex("api1"));
    expect(trackSortIndex("api2")).toBeLessThan(trackSortIndex("other"));
  });
});
