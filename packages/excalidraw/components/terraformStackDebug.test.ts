import { describe, expect, it } from "vitest";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
} from "../test-fixtures/terraformPresetFixtures";

import { analyzeTerraformNestedLayout } from "./terraformNestedLayoutDebug";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

describe("staging multi-state import", () => {
  it("imports semantic layout without per-stack visual frames", async () => {
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
    expect(body.meta?.stackIds?.length).toBe(9);
    expect(body.elements.length).toBeGreaterThan(0);

    const stackFrames = body.elements.filter(
      (e: { type?: string; customData?: { terraformTopologyRole?: string } }) =>
        e.type === "frame" && e.customData?.terraformTopologyRole === "stack",
    );
    expect(stackFrames).toHaveLength(0);

    const nested = analyzeTerraformNestedLayout(body.elements);
    expect(nested.orphanExplodeParents).toBe(0);

    const apiGateways = body.elements.filter(
      (e: { customData?: { resourceType?: string; nodePath?: string } }) =>
        e.customData?.resourceType === "aws_api_gateway_rest_api" ||
        e.customData?.nodePath?.endsWith(
          "module.api.aws_api_gateway_rest_api.private",
        ),
    );
    expect(apiGateways.length).toBeGreaterThanOrEqual(5);
    expect(apiGateways.some((e: { isDeleted?: boolean }) => !e.isDeleted)).toBe(
      true,
    );
  }, 180_000);
});
