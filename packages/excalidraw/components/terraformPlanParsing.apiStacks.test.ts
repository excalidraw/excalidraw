import graphlibDot from "@dagrejs/graphlib-dot";
import { describe, expect, it } from "vitest";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import { getTerraformPlanNodeAction } from "./terraformElkLayout";
import {
  namespacePlanDotBundles,
  mergeDotAdjacency,
  mergePlanJsons,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";

describe("staging API stacks node actions", () => {
  it("preserves no-op plan actions for each api stack after dedupe", () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const namespaced = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.bundles.map((b) => b.plan),
      namespaced.bundles.map((b) => b.label),
    );
    const graph = graphlibDot.read("digraph G {}\n");
    const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
      stackIds: namespaced.stackIds,
      adjacency: mergeDotAdjacency(
        namespaced.bundles.map((b) => b.dotText),
        namespaced.stackIds,
      ),
    });

    for (const stackId of ["40-east-api-1", "41-east-api-2"]) {
      const prefix = `${stackId}::module.api.aws_api_gateway_rest_api.private`;
      expect(nodes[prefix]).toBeDefined();
      expect(getTerraformPlanNodeAction(nodes[prefix])).toBe("no-op");
    }
  });
});
