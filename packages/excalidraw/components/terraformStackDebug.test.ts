import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeTerraformNestedLayout } from "./terraformNestedLayoutDebug";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

describe("staging multi-state import", () => {
  it("imports semantic layout without per-stack visual frames", async () => {
    const root = join(
      import.meta.dirname,
      "../../backend/terraform/staging-multi-state",
    );
    const stacks = readdirSync(root)
      .filter((d) => statSync(join(root, d)).isDirectory() && /^\d/.test(d))
      .sort();
    const bundles = stacks.map((id) => ({
      plan: JSON.parse(readFileSync(join(root, id, "plan.json"), "utf8")),
      dotText: readFileSync(join(root, id, "graph.dot"), "utf8"),
      label: id,
    }));
    const tfd = readFileSync(join(root, "pipeline.tfd"), "utf8");
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
