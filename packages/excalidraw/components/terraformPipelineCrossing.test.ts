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
  countTotalAdjacentCrossings,
  minimizePipelineCrossings,
} from "./terraformPipelineCrossing";
import {
  barycenterSortFanoutColumns,
  buildPipelineColumnsFromTfdDepth,
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

describe("countTotalAdjacentCrossings", () => {
  it("counts one crossing for inverted bipartite edges", () => {
    const columns = [["a", "b"], ["x", "y"]];
    const edges = [
      { source: "a", target: "y", sequence: 0 },
      { source: "b", target: "x", sequence: 1 },
    ];
    expect(countTotalAdjacentCrossings(columns, edges)).toBe(1);
  });

  it("counts zero when parallel edges do not cross", () => {
    const columns = [["a", "b"], ["x", "y"]];
    const edges = [
      { source: "a", target: "x", sequence: 0 },
      { source: "b", target: "y", sequence: 1 },
    ];
    expect(countTotalAdjacentCrossings(columns, edges)).toBe(0);
  });
});

describe("minimizePipelineCrossings", () => {
  it("reduces crossings on a diamond compared to naive order", () => {
    const columns = [
      ["top"],
      ["left", "right"],
      ["bottom"],
    ];
    const edges = [
      { source: "top", target: "left", sequence: 0 },
      { source: "top", target: "right", sequence: 1 },
      { source: "left", target: "bottom", sequence: 2 },
      { source: "right", target: "bottom", sequence: 3 },
    ];
    const naive = [
      ["top"],
      ["right", "left"],
      ["bottom"],
    ];
    const naiveCross = countTotalAdjacentCrossings(naive, edges);
    const optimized = minimizePipelineCrossings(columns, edges);
    const optCross = countTotalAdjacentCrossings(optimized, edges);
    expect(optCross).toBeLessThanOrEqual(naiveCross);
    expect(optCross).toBe(0);
  });

  it("does not change column membership", () => {
    const columns = [
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ];
    const edges = [
      { source: "a", target: "c", sequence: 0 },
      { source: "b", target: "d", sequence: 1 },
      { source: "c", target: "e", sequence: 2 },
      { source: "d", target: "e", sequence: 3 },
    ];
    const result = minimizePipelineCrossings(columns, edges);
    expect(result.map((c) => [...c].sort())).toEqual(
      columns.map((c) => [...c].sort()),
    );
  });

  it("beats single-pass barycenter on a crossing X", () => {
    const columns = [
      ["s1", "s2"],
      ["t1", "t2"],
    ];
    const edges = [
      { source: "s1", target: "t2", sequence: 0 },
      { source: "s2", target: "t1", sequence: 1 },
    ];
    const primaryParent = new Map([
      ["t1", "s2"],
      ["t2", "s1"],
    ]);
    const bary = barycenterSortFanoutColumns(columns, edges, primaryParent);
    const baryCross = countTotalAdjacentCrossings(bary, edges);
    const opt = minimizePipelineCrossings(columns, edges);
    const optCross = countTotalAdjacentCrossings(opt, edges);
    expect(optCross).toBeLessThanOrEqual(baryCross);
    expect(optCross).toBe(0);
  });
});

describe("staging pipeline crossing minimization", () => {
  it("reduces adjacent crossings vs single-pass barycenter without changing column depth", async () => {
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
    const edges = atomGraph.edges;
    const primaryParent = buildTfdPrimaryParentMap(edges);

    const depthColumns = buildPipelineColumnsFromTfdDepth(atomGraph, edges);
    const baryColumns = barycenterSortFanoutColumns(
      depthColumns.map((c) => [...c]),
      edges,
      primaryParent,
    );
    const optColumns = minimizePipelineCrossings(
      depthColumns.map((c) => [...c]),
      edges,
      { maxIterations: 12, useMedian: false, enableSifting: true },
    );

    const baryCross = countTotalAdjacentCrossings(baryColumns, edges);
    const optCross = countTotalAdjacentCrossings(optColumns, edges);
    expect(optCross).toBeLessThanOrEqual(baryCross);

    const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, merged.plan);
    expect(depthColumns.length).toBe(optColumns.length);
    const depthPlan = buildPipelineLayoutPlan(atomGraph, geoMap);
    expect(depthPlan.columns.length).toBe(depthColumns.length);
    expect(depthPlan.columns.length).toBeGreaterThanOrEqual(10);

    for (const placement of depthPlan.placements) {
      const api2Compute = placement.primaryAddress.includes("41-east-api-2");
      if (!api2Compute || !placement.primaryAddress.includes("aws_ecs_service")) {
        continue;
      }
      const ssm = depthPlan.placements.find(
        (p) =>
          p.primaryAddress.includes("41-east-api-2") &&
          p.primaryAddress.includes("aws_ssm_parameter"),
      );
      const store = depthPlan.placements.find(
        (p) =>
          p.primaryAddress.includes("api2_rds") &&
          p.primaryAddress.includes("aws_db_instance"),
      );
      expect(ssm!.columnIndex).toBe(placement.columnIndex + 1);
      expect(store!.columnIndex).toBe(placement.columnIndex + 1);
      break;
    }
  }, 120_000);
});
