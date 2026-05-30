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
  };
}

describe("buildPipelineColumnIndexMap", () => {
  it("places parallel fanout in one column and sequential runs further right", () => {
    const edges = [
      { source: "a", target: "b", sequence: 0, columnBackoff: 0 },
      { source: "a", target: "c", sequence: 1, columnBackoff: 0 },
      { source: "x", target: "y", sequence: 2, columnBackoff: 0 },
      { source: "a", target: "d", sequence: 3, columnBackoff: 0 },
      { source: "a", target: "e", sequence: 4, columnBackoff: 1 },
    ];
    const atomGraph = mockAtomGraph(["a", "b", "c", "d", "e", "x", "y"], edges);
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("a")).toBe(0);
    expect(colByAtom.get("b")).toBe(colByAtom.get("c"));
    expect(colByAtom.get("d")).toBe(colByAtom.get("b")! + 1);
    expect(colByAtom.get("e")).toBe(colByAtom.get("b"));
  });

  it("assigns separate sequential runs when same-source edges are not contiguous", () => {
    const edges = [
      { source: "a", target: "b", sequence: 0, columnBackoff: 0 },
      { source: "x", target: "y", sequence: 1, columnBackoff: 0 },
      { source: "a", target: "d", sequence: 2, columnBackoff: 0 },
    ];
    const atomGraph = mockAtomGraph(["a", "b", "d", "x", "y"], edges);
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("b")).toBe(1);
    expect(colByAtom.get("d")).toBe(2);
  });

  it("applies gateway-to-compute after cascade when gateway edge is declared first", () => {
    const edges = [
      { source: "a", target: "b", sequence: 0 },
      { source: "gw", target: "compute", sequence: 1 },
      { source: "b", target: "gw", sequence: 2 },
    ];
    const atomGraph = mockAtomGraph(["a", "b", "gw", "compute"], edges);
    const colByAtom = buildPipelineColumnIndexMap(atomGraph, edges);
    expect(colByAtom.get("a")).toBe(0);
    expect(colByAtom.get("b")).toBe(1);
    expect(colByAtom.get("gw")).toBe(2);
    expect(colByAtom.get("compute")).toBe(3);
  });
});

describe("staging pipeline TFD depth layout", () => {
  it("places api2 store at compute+2, ssm at compute+1, with shared lane", async () => {
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
    expect(storePlacement!.columnIndex).toBe(computePlacement!.columnIndex + 2);
    expect(ssmPlacement!.laneIndex).toBe(computePlacement!.laneIndex);
    expect(storePlacement!.laneIndex).toBe(computePlacement!.laneIndex);

    const primaryParent = buildTfdPrimaryParentMap(atomGraph.edges);
    expect(primaryParent.get(api2Store)).toBe(api2Compute);

    expect(layoutPlan.columns.some((c) => c.laneCount >= 5)).toBe(true);
    expect(layoutPlan.columns.length).toBeGreaterThanOrEqual(10);

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

    const gwPlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api7Gateway,
    );
    const api7ComputePlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api7Compute,
    );
    const api7SsmPlacement = layoutPlan.placements.find(
      (p) => p.primaryAddress === api7Ssm,
    );

    expect(gwPlacement).toBeDefined();
    expect(api7ComputePlacement!.columnIndex).toBe(
      gwPlacement!.columnIndex + 1,
    );
    expect(api7SsmPlacement!.columnIndex).toBe(
      api7ComputePlacement!.columnIndex + 1,
    );
    expect(api7ComputePlacement!.laneIndex).toBe(gwPlacement!.laneIndex);
    expect(api7SsmPlacement!.laneIndex).toBe(gwPlacement!.laneIndex);
    expect(api7ComputePlacement!.columnIndex).toBeLessThan(20);
  }, 120_000);
});
