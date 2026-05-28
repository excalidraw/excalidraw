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
});
