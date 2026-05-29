import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
} from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import {
  namespacePlanDotBundles,
  mergePlanJsons,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

describe("staging pipeline.tfd resolution", () => {
  it("new stack-qualified pipeline.tfd resolves all 20 edges", async () => {
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
    const { edges, errors } = applyDeclaredDataFlowFromMany(nodes, [tfd]);
    expect(errors).toEqual([]);
    expect(edges).toHaveLength(20);
  }, 120_000);

  it("new pipeline.tfd draws all 20 declared arrows in semantic layout", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: bundles,
        states: [],
        stateLabels: [],
        tfdTexts: [tfd],
        tfdLabels: ["pipeline.tfd"],
      },
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    const declared = body.elements.filter(
      (e: { type?: string; customData?: { terraformEdgeLayer?: string } }) =>
        e.type === "arrow" &&
        e.customData?.terraformEdgeLayer === "declaredDataFlow",
    );
    expect(declared).toHaveLength(20);
  }, 180_000);

  it("pipeline layout draws 20 declared arrows and omits unbound resources", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: bundles,
        states: [],
        stateLabels: [],
        tfdTexts: [tfd],
        tfdLabels: ["pipeline.tfd"],
      },
      { pipelineLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("pipeline");

    const declared = body.elements.filter(
      (e: { type?: string; customData?: { terraformEdgeLayer?: string } }) =>
        e.type === "arrow" &&
        e.customData?.terraformEdgeLayer === "declaredDataFlow",
    );
    expect(declared).toHaveLength(20);

    const resourceRects = body.elements.filter(
      (e: {
        type?: string;
        customData?: { terraformVisibilityRole?: string; nodePath?: string };
      }) =>
        e.type === "rectangle" &&
        e.customData?.terraformVisibilityRole === "resource" &&
        typeof e.customData?.nodePath === "string",
    );
    const nodePaths = new Set<string>(
      resourceRects.map(
        (e: { customData: { nodePath: string } }) => e.customData.nodePath,
      ),
    );
    expect(nodePaths.has("10-east-ecs-edge::aws_lb.ecs")).toBe(true);
    expect(nodePaths.has("10-east-ecs-edge::aws_lb_listener.http")).toBe(true);
    expect(nodePaths.has("01-west-network::aws_vpc.main")).toBe(false);

    const lbClusters = body.elements.filter(
      (e: {
        type?: string;
        name?: string;
        customData?: { terraformTopologyRole?: string };
      }) =>
        e.type === "frame" &&
        e.customData?.terraformTopologyRole === "primaryCluster" &&
        String(e.name ?? "").includes("aws_lb"),
    );
    expect(lbClusters.length).toBe(1);

    const apiPrimaries = [...nodePaths].filter((p) =>
      p.includes("aws_api_gateway_rest_api"),
    );
    expect(apiPrimaries).toHaveLength(5);

    const ssmRects = resourceRects.filter(
      (e: { customData: { nodePath: string } }) =>
        e.customData.nodePath.includes("aws_ssm_parameter"),
    );
    expect(ssmRects).toHaveLength(5);

    expect(body.meta?.geoInstanceCount).toBeGreaterThanOrEqual(2);
    expect(body.meta?.atomCount).toBe(19);
    expect(body.meta?.declaredEdgeCount).toBe(20);
    expect(body.meta?.columnCount).toBe(7);

    const frames = body.elements.filter(
      (e: { type?: string; id?: string }) => e.type === "frame",
    );
    const frameIds = frames.map((e: { id: string }) => e.id);
    expect(frameIds.length).toBe(new Set(frameIds).size);

    const vpcFrames = frames.filter(
      (e: { customData?: { terraformTopologyRole?: string } }) =>
        e.customData?.terraformTopologyRole === "vpc",
    );
    expect(vpcFrames.length).toBeGreaterThanOrEqual(1);

    const lambdaRects = resourceRects.filter(
      (e: { customData: { nodePath: string } }) =>
        e.customData.nodePath.includes("aws_lambda_function") &&
        e.customData.nodePath.includes("api"),
    );
    expect(lambdaRects.length).toBe(5);
    const lambdaXs = lambdaRects.map((e: { x: number }) => e.x);
    expect(Math.max(...lambdaXs) - Math.min(...lambdaXs)).toBeLessThan(8);

    const ssmXs = ssmRects.map((e: { x: number }) => e.x);
    expect(Math.max(...ssmXs) - Math.min(...ssmXs)).toBeLessThan(8);

    const zoneFrames = frames.filter(
      (e: {
        customData?: { terraformTopologyRole?: string };
        height?: number;
      }) =>
        e.customData?.terraformTopologyRole === "subnetZone" ||
        e.customData?.terraformTopologyRole === "regionalBand",
    );
    for (const zf of zoneFrames) {
      if (zf.customData?.terraformTopologyRole === "regionalBand") {
        continue;
      }
      expect(zf.height ?? 0).toBeGreaterThanOrEqual(80);
    }
  }, 180_000);
});
