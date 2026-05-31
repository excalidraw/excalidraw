import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import { loadStagingMultiStatePlanDotBundlesFromDb, readStagingMultiStatePipelineTfdFromDb } from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import {
  assignPipelineColumnPackedY,
  buildColumnPackInputs,
} from "./terraformPipelineColumnPack";
import { buildPipelineLayoutPlan } from "./terraformPipelineContainers";
import { buildPipelineAtomGeoMap } from "./terraformPipelineGeo";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { buildTfdPrimaryParentMap } from "./terraformPipelineTfd";
import { applyPipelineVerticalSolver } from "./terraformPipelineVerticalSolver";
import {
  assignTrackRows,
  baseRowCenterYForTrack,
} from "./terraformPipelineTrackRows";
import { DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE } from "./terraformPipelineLayoutMode";

import type { PipelineAtomEdge } from "./terraformPipelineAtoms";
import type {
  PipelineAtomPlacement,
  PipelineColumn,
} from "./terraformPipelineContainers";

const NOMINAL_SLOT = 96;
const GAP = 24;
const TRACK_GAP = 32;
const ROW_PITCH = NOMINAL_SLOT + GAP + TRACK_GAP;
const Y_ALIGN_EPS = 2;

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
  trackId: string,
): PipelineAtomPlacement {
  return {
    primaryAddress,
    columnIndex,
    laneIndex,
    packedOffsetY,
    trackId,
    geo,
    geoInstanceId: 0,
    geoInstanceKey: "geo",
  };
}
describe("terraformPipelineTrackRows", () => {
  it("defaults vertical solver to track-rows", () => {
    expect(DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE).toBe("track-rows");
  });

  it("places api11 at api11 row index", () => {
    const y = baseRowCenterYForTrack("api11", ROW_PITCH, NOMINAL_SLOT);
    expect(y).toBe(NOMINAL_SLOT / 2 + 10 * ROW_PITCH);
  });

  it("aligns west api11 ECS with Aurora on staging global-relayer", async () => {
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
    const layoutPlan = buildPipelineLayoutPlan(
      atomGraph,
      geoMap,
      "global-relayer",
    );

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

    const pick = (parts: string[]) =>
      [...atomGraph.atoms.keys()].find((a) =>
        parts.every((p) => a.includes(p)),
      )!;

    const api11Cmp = pick(["53-west-api-11", "aws_ecs_service"]);
    const api11Gw = pick(["53-west-api-11", "aws_api_gateway"]);
    const api11Store = pick(["api11_aurora", "aws_rds_cluster"]);

    const primaryParent = buildTfdPrimaryParentMap(atomGraph.edges);
    await applyPipelineVerticalSolver(
      layoutPlan.placements,
      layoutPlan.columns,
      atomGraph.edges,
      slotHeight,
      colByAtom,
      { mode: "track-rows", primaryParent },
    );

    const y = (addr: string) =>
      layoutPlan.placements.find((p) => p.primaryAddress === addr)!
        .packedOffsetY!;

    expect(Math.abs(y(api11Cmp) - y(api11Store))).toBeLessThan(
      ROW_PITCH + Y_ALIGN_EPS,
    );
    expect(Math.abs(y(api11Gw) - y(api11Cmp))).toBeLessThan(Y_ALIGN_EPS);
  }, 120_000);

  it("aligns dual-parent api6 track to median of api4 and api5 rows", () => {
    const placements = [
      placement("api4_compute", 2, 0, baseRowCenterYForTrack("api4", ROW_PITCH, NOMINAL_SLOT), "api4"),
      placement("api5_compute", 3, 0, baseRowCenterYForTrack("api5", ROW_PITCH, NOMINAL_SLOT), "api5"),
      placement("api6_gateway", 5, 0, baseRowCenterYForTrack("api6", ROW_PITCH, NOMINAL_SLOT), "api6"),
      placement("api6_compute", 6, 0, baseRowCenterYForTrack("api6", ROW_PITCH, NOMINAL_SLOT), "api6"),
      placement("api6_store", 8, 0, baseRowCenterYForTrack("api6", ROW_PITCH, NOMINAL_SLOT), "api6"),
    ];
    const columns: PipelineColumn[] = [
      { columnIndex: 2, atoms: ["api4_compute"], laneCount: 1 },
      { columnIndex: 3, atoms: ["api5_compute"], laneCount: 1 },
      { columnIndex: 5, atoms: ["api6_gateway"], laneCount: 1 },
      { columnIndex: 6, atoms: ["api6_compute"], laneCount: 1 },
      { columnIndex: 8, atoms: ["api6_store"], laneCount: 1 },
    ];
    const edges: PipelineAtomEdge[] = [
      { source: "api4_compute", target: "api6_gateway", sequence: 0 },
      { source: "api5_compute", target: "api6_gateway", sequence: 1 },
      { source: "api6_gateway", target: "api6_compute", sequence: 2 },
      { source: "api6_compute", target: "api6_store", sequence: 3 },
    ];
    const slotHeight = new Map(placements.map((p) => [p.primaryAddress, NOMINAL_SLOT]));
    const primaryParent = buildTfdPrimaryParentMap(edges);
    assignTrackRows({
      placements,
      columns,
      edges,
      slotHeight,
      primaryParent,
    });
    const y = (addr: string) =>
      placements.find((p) => p.primaryAddress === addr)!.packedOffsetY!;
    const expected =
      (baseRowCenterYForTrack("api4", ROW_PITCH, NOMINAL_SLOT) +
        baseRowCenterYForTrack("api5", ROW_PITCH, NOMINAL_SLOT)) /
      2;
    expect(Math.abs(y("api6_gateway") - expected)).toBeLessThan(Y_ALIGN_EPS);
    expect(Math.abs(y("api6_compute") - expected)).toBeLessThan(Y_ALIGN_EPS);
    expect(Math.abs(y("api6_store") - expected)).toBeLessThan(Y_ALIGN_EPS);
    expect(y("api6_gateway")).toBeLessThan(
      baseRowCenterYForTrack("api6", ROW_PITCH, NOMINAL_SLOT) - 100,
    );
  });

  it("aligns trunk ECS/SQS/Lambda to entry API fan-out hub", () => {
    const placements = [
      placement("trunk_ecs", 0, 0, 48, "trunk"),
      placement("trunk_sqs", 1, 0, 48, "trunk"),
      placement("trunk_compute", 2, 0, 48, "trunk"),
      placement("api1_gateway", 3, 0, 48, "api1"),
      placement("api2_gateway", 3, 1, 48 + ROW_PITCH, "api2"),
      placement("api3_gateway", 3, 2, 48 + ROW_PITCH * 2, "api3"),
    ];
    const columns: PipelineColumn[] = [
      { columnIndex: 0, atoms: ["trunk_ecs"], laneCount: 1 },
      { columnIndex: 1, atoms: ["trunk_sqs"], laneCount: 1 },
      { columnIndex: 2, atoms: ["trunk_compute"], laneCount: 1 },
      { columnIndex: 3, atoms: ["api1_gateway", "api2_gateway", "api3_gateway"], laneCount: 3 },
    ];
    const edges: PipelineAtomEdge[] = [
      { source: "trunk_ecs", target: "trunk_sqs", sequence: 0 },
      { source: "trunk_sqs", target: "trunk_compute", sequence: 1 },
      { source: "trunk_compute", target: "api1_gateway", sequence: 2 },
      { source: "trunk_compute", target: "api2_gateway", sequence: 3 },
      { source: "trunk_compute", target: "api3_gateway", sequence: 4 },
    ];
    const slotHeight = new Map(placements.map((p) => [p.primaryAddress, NOMINAL_SLOT]));
    const primaryParent = buildTfdPrimaryParentMap(edges);
    assignTrackRows({
      placements,
      columns,
      edges,
      slotHeight,
      primaryParent,
    });
    const y = (addr: string) =>
      placements.find((p) => p.primaryAddress === addr)!.packedOffsetY!;
    const hub = 48 + ROW_PITCH;
    expect(Math.abs(y("trunk_ecs") - hub)).toBeLessThan(Y_ALIGN_EPS);
    expect(Math.abs(y("trunk_sqs") - hub)).toBeLessThan(Y_ALIGN_EPS);
    expect(Math.abs(y("trunk_compute") - hub)).toBeLessThan(Y_ALIGN_EPS);
    expect(Math.abs(y("api2_gateway") - hub)).toBeLessThan(Y_ALIGN_EPS);
  });

  it("aligns staging trunk and api6/api7 to parent rows on global-relayer", async () => {
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
    const layoutPlan = buildPipelineLayoutPlan(
      atomGraph,
      geoMap,
      "global-relayer",
    );

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

    const pick = (parts: string[]) =>
      [...atomGraph.atoms.keys()].find((a) =>
        parts.every((p) => a.includes(p)),
      )!;

    const primaryParent = buildTfdPrimaryParentMap(atomGraph.edges);
    await applyPipelineVerticalSolver(
      layoutPlan.placements,
      layoutPlan.columns,
      atomGraph.edges,
      slotHeight,
      colByAtom,
      { mode: "track-rows", primaryParent },
    );

    const y = (addr: string) =>
      layoutPlan.placements.find((p) => p.primaryAddress === addr)!
        .packedOffsetY!;

    const trunkAddrs = [
      pick(["10-east-ecs-edge", "aws_lb.ecs"]),
      pick(["aws_ecs_service.producer"]),
      pick(["aws_sqs_queue"]),
      pick(["consumer_lambda", "aws_lambda_function"]),
    ];
    const trunkYs = trunkAddrs.map(y);
    expect(Math.max(...trunkYs) - Math.min(...trunkYs)).toBeLessThan(4);

    const api4Cmp = pick(["43-east-api-4", "aws_lambda_function"]);
    const api5Cmp = pick(["44-east-api-5", "aws_ecs_service"]);
    const api6Gw = pick(["45-east-api-6", "aws_api_gateway"]);
    const api6Cmp = pick(["45-east-api-6", "aws_lambda_function"]);
    const api7Gw = pick(["46-east-api-7", "aws_api_gateway"]);
    const api7Cmp = pick(["46-east-api-7", "aws_ecs_service"]);

    const expectedApi6 =
      (y(api4Cmp) + y(api5Cmp)) / 2;
    expect(Math.abs(y(api6Gw) - expectedApi6)).toBeLessThan(8);
    expect(Math.abs(y(api6Cmp) - expectedApi6)).toBeLessThan(8);
    expect(Math.abs(y(api7Gw) - expectedApi6)).toBeLessThan(ROW_PITCH + 8);
    expect(Math.abs(y(api7Cmp) - expectedApi6)).toBeLessThan(ROW_PITCH + 8);
    expect(y(api6Gw)).toBeLessThan(
      baseRowCenterYForTrack("api6", ROW_PITCH, NOMINAL_SLOT) - 50,
    );
  }, 120_000);
});
