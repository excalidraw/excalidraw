import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import { buildPipelineLayoutPlan } from "./terraformPipelineContainers";
import { buildPipelineAtomGeoMap } from "./terraformPipelineGeo";
import {
  buildPipelineColumnIndexMap,
  buildTfdIncomingSourcesByTarget,
  buildTfdPrimaryParentMap,
} from "./terraformPipelineTfd";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";

function readStagingPipelineTfdFromRepo(): string {
  return readFileSync(
    join(
      process.cwd(),
      "packages/backend/terraform/staging-multi-state/pipeline.tfd",
    ),
    "utf8",
  );
}

function mockAtomGraph(
  ids: readonly string[],
  edges: Array<{
    source: string;
    target: string;
    sequence: number;
    columnBackoff?: number;
  }>,
  tfdVersion: 1 | 2 = 1,
) {
  return {
    atoms: new Map(
      ids.map((id) => [
        id,
        {
          primaryAddress: id,
          resourceType: "aws_lambda_function",
          memberAddresses: [id],
        },
      ]),
    ),
    edges,
    closureAddresses: new Set(ids),
    tfdVersion,
  };
}

describe("buildPipelineColumnIndexMap", () => {
  it("places parallel fanout in one column and sequential runs further right (v1)", () => {
    const edges = [
      { source: "a", target: "b", sequence: 0, columnBackoff: 0 },
      { source: "a", target: "c", sequence: 1, columnBackoff: 0 },
      { source: "x", target: "y", sequence: 2, columnBackoff: 0 },
      { source: "a", target: "d", sequence: 3, columnBackoff: 0 },
      { source: "a", target: "e", sequence: 4, columnBackoff: 1 },
    ];
    const atomGraph = mockAtomGraph(
      ["a", "b", "c", "d", "e", "x", "y"],
      edges,
      1,
    );
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("a")).toBe(0);
    expect(colByAtom.get("b")).toBe(colByAtom.get("c"));
    expect(colByAtom.get("d")).toBe(colByAtom.get("b")! + 1);
    expect(colByAtom.get("e")).toBe(colByAtom.get("b"));
  });

  it("assigns separate sequential runs when same-source edges are not contiguous (v1)", () => {
    const edges = [
      { source: "a", target: "b", sequence: 0, columnBackoff: 0 },
      { source: "x", target: "y", sequence: 1, columnBackoff: 0 },
      { source: "a", target: "d", sequence: 2, columnBackoff: 0 },
    ];
    const atomGraph = mockAtomGraph(["a", "b", "d", "x", "y"], edges, 1);
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("b")).toBe(1);
    expect(colByAtom.get("d")).toBe(2);
  });

  it("places all sibling outputs at source+1 under v2 adjacency", () => {
    const edges = [
      { source: "a", target: "b", sequence: 0 },
      { source: "x", target: "y", sequence: 1 },
      { source: "a", target: "d", sequence: 2 },
    ];
    const atomGraph = mockAtomGraph(["a", "b", "d", "x", "y"], edges, 2);
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("b")).toBe(1);
    expect(colByAtom.get("d")).toBe(1);
  });

  it("applies gateway-to-compute after cascade when gateway edge is declared first", () => {
    const edges = [
      { source: "a", target: "b", sequence: 0 },
      { source: "gw", target: "compute", sequence: 1 },
      { source: "b", target: "gw", sequence: 2 },
    ];
    const atomGraph = mockAtomGraph(["a", "b", "gw", "compute"], edges, 2);
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("a")).toBe(0);
    expect(colByAtom.get("b")).toBe(1);
    expect(colByAtom.get("gw")).toBe(2);
    expect(colByAtom.get("compute")).toBe(3);
  });

  it("adds +2 depth for --> hop chain under v2", () => {
    const edges = [
      { source: "a", target: "__tfd_hop_0", sequence: 0 },
      { source: "__tfd_hop_0", target: "b", sequence: 1 },
      { source: "a", target: "c", sequence: 2 },
    ];
    const atomGraph = mockAtomGraph(
      ["a", "b", "c", "__tfd_hop_0"],
      edges,
      2,
    );
    atomGraph.atoms.set("__tfd_hop_0", {
      primaryAddress: "__tfd_hop_0",
      resourceType: "__tfd_hop",
      memberAddresses: [],
    });
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("c")).toBe(1);
    expect(colByAtom.get("b")).toBe(2);
  });
});

describe("staging pipeline TFD depth layout", () => {
  it("places api2 ssm and store at compute+1 with shared lane under v2", async () => {
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
    const tfd = readStagingPipelineTfdFromRepo();
    applyDeclaredDataFlowFromMany(nodes, [tfd]);

    const atomGraph = buildPipelineAtomGraph(nodes, merged.plan, [tfd])!;
    expect(atomGraph.tfdVersion).toBe(2);

    const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, merged.plan);
    const layoutPlan = buildPipelineLayoutPlan(atomGraph, geoMap);

    const api2Compute = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("41-east-api-2") && a.includes("aws_ecs_service"),
    )!;
    const api2Ssm = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("41-east-api-2") && a.includes("aws_ssm_parameter"),
    )!;
    const api2Store = [...atomGraph.atoms.keys()].find(
      (a) => a.includes("api2_rds") && a.includes("aws_db_instance"),
    )!;

    const computePlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api2Compute,
    );
    const ssmPlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api2Ssm,
    );
    const storePlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api2Store,
    );

    expect(computePlacement).toBeDefined();
    expect(ssmPlacement!.columnIndex).toBe(computePlacement!.columnIndex + 1);
    expect(storePlacement!.columnIndex).toBe(computePlacement!.columnIndex + 1);
    expect(ssmPlacement!.columnIndex).toBe(storePlacement!.columnIndex);

    const primaryParent = buildTfdPrimaryParentMap(atomGraph.edges);
    expect(primaryParent.get(api2Store)).toBe(api2Compute);

    expect(layoutPlan.columns.some((c) => c.laneCount >= 5)).toBe(true);
    expect(layoutPlan.columns.length).toBeGreaterThanOrEqual(10);

    const api6Compute = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("45-east-api-6") &&
        a.includes("aws_lambda_function"),
    )!;
    const api6Ssm = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("45-east-api-6") && a.includes("aws_ssm_parameter"),
    )!;
    const api6Store = [...atomGraph.atoms.keys()].find(
      (a) => a.includes("api6_rds") && a.includes("aws_db_instance"),
    )!;

    const api6ComputePlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api6Compute,
    );
    const api6SsmPlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api6Ssm,
    );
    const api6StorePlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api6Store,
    );

    expect(api6SsmPlacement!.columnIndex).toBe(
      api6ComputePlacement!.columnIndex + 1,
    );
    expect(api6StorePlacement!.columnIndex).toBe(
      api6ComputePlacement!.columnIndex + 1,
    );

    const api7Gateway = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("46-east-api-7") &&
        a.includes("aws_api_gateway_rest_api"),
    )!;
    const api7Compute = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("46-east-api-7") && a.includes("aws_ecs_service"),
    )!;
    const api7Ssm = [...atomGraph.atoms.keys()].find(
      (a) =>
        a.includes("46-east-api-7") && a.includes("aws_ssm_parameter"),
    )!;
    const api7Store = [...atomGraph.atoms.keys()].find(
      (a) => a.includes("api7_aurora") && a.includes("aws_rds_cluster"),
    )!;

    const gwPlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api7Gateway,
    );
    const api7ComputePlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api7Compute,
    );
    const api7SsmPlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api7Ssm,
    );
    const api7StorePlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api7Store,
    );

    expect(gwPlacement).toBeDefined();
    expect(api7ComputePlacement!.columnIndex).toBe(
      gwPlacement!.columnIndex + 1,
    );
    expect(api7SsmPlacement!.columnIndex).toBe(
      api7ComputePlacement!.columnIndex + 1,
    );
    expect(api7StorePlacement!.columnIndex).toBe(
      api7ComputePlacement!.columnIndex + 1,
    );
    expect(api7ComputePlacement!.laneIndex).toBe(gwPlacement!.laneIndex);
    expect(api7SsmPlacement!.laneIndex).toBe(gwPlacement!.laneIndex);
    expect(api7ComputePlacement!.columnIndex).toBeLessThan(20);
  }, 120_000);
});

describe("buildTfdIncomingSourcesByTarget", () => {
  it("records every declared source while primary parent keeps the first", () => {
    const edges = [
      { source: "api4_compute", target: "api6_gateway", sequence: 0 },
      { source: "api5_compute", target: "api6_gateway", sequence: 1 },
    ];
    const incoming = buildTfdIncomingSourcesByTarget(edges);
    expect(incoming.get("api6_gateway")).toEqual([
      "api4_compute",
      "api5_compute",
    ]);
    expect(buildTfdPrimaryParentMap(edges).get("api6_gateway")).toBe(
      "api4_compute",
    );
  });
});
