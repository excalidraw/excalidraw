import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
} from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import { buildPipelineAtomGeoMap } from "./terraformPipelineGeo";
import { buildPipelineLayoutPlan } from "./terraformPipelineContainers";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";

describe("terraformPipelineAtoms", () => {
  it("collapses LB listener and target group into the LB atom for staging pipeline", async () => {
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

    const atomGraph = buildPipelineAtomGraph(nodes, merged.plan, [tfd]);
    expect(atomGraph).not.toBeNull();

    const lb = "10-east-ecs-edge::aws_lb.ecs";
    const listener = "10-east-ecs-edge::aws_lb_listener.http";
    const tg = "10-east-ecs-edge::aws_lb_target_group.ecs";

    expect(atomGraph!.atoms.has(lb)).toBe(true);
    expect(atomGraph!.atoms.get(lb)?.memberAddresses).toEqual(
      expect.arrayContaining([listener, tg]),
    );

    const collapsed = atomGraph!.edges;
    const hasLbToEcs = collapsed.some(
      (e) =>
        e.source.includes("aws_lb.ecs") &&
        e.target.includes("aws_ecs_service.producer"),
    );
    expect(hasLbToEcs).toBe(true);
    expect(
      collapsed.some(
        (e) =>
          e.source.includes("aws_lb_listener") ||
          e.target.includes("aws_lb_listener"),
      ),
    ).toBe(false);

    const fanout = collapsed.filter((e) =>
      e.source.includes("consumer_lambda"),
    );
    expect(fanout.length).toBe(5);
  }, 120_000);

  it("builds layout plan with fanout column for five API gateways", async () => {
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

    expect(layoutPlan.columns.some((c) => c.laneCount >= 5)).toBe(true);
    expect(layoutPlan.columns).toHaveLength(7);

    const fanoutColumns = layoutPlan.columns.filter((c) => c.laneCount === 5);
    expect(fanoutColumns).toHaveLength(3);
  }, 120_000);
});
