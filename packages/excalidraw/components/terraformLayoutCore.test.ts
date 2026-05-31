import { describe, expect, it } from "vitest";

import { layoutTerraformFromSources } from "./terraformLayoutCore";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

const twoStackSources = () => {
  const zonePlan = {
    resource_changes: [
      {
        address: "cloudflare_zone.stack_a",
        mode: "managed",
        type: "cloudflare_zone",
        name: "stack_a",
        change: {
          actions: ["no-op"],
          after: { id: "zone-a", name: "a.example" },
        },
      },
    ],
  };
  const dnsPlan = {
    resource_changes: [
      {
        address: "cloudflare_dns_record.stack_b",
        mode: "managed",
        type: "cloudflare_dns_record",
        name: "stack_b",
        change: {
          actions: ["no-op"],
          after: { id: "dns-b", name: "b.example", type: "CNAME" },
        },
      },
    ],
  };
  const dotA = `digraph { "[root] cloudflare_zone.stack_a (expand)" [shape=box] }`;
  const dotB = `digraph { "[root] cloudflare_dns_record.stack_b (expand)" [shape=box] }`;
  return {
    planDotBundles: [
      { plan: zonePlan, dotText: dotA, label: "stack-a" },
      { plan: dnsPlan, dotText: dotB, label: "stack-b" },
    ],
    states: [] as unknown[],
    tfdTexts: [] as string[],
  };
};

describe("layoutTerraformFromSources", () => {
  it("matches terraformPlanParsingFromSources JSON for two-stack module import", async () => {
    const sources = twoStackSources();
    const coreResult = await layoutTerraformFromSources(sources, {
      semanticLayout: false,
    });
    expect(coreResult.ok).toBe(true);

    const res = await terraformPlanParsingFromSources(sources, {
      semanticLayout: false,
    });
    expect(res.ok).toBe(true);
    const parsed = await res.json();

    if (!coreResult.ok) {
      throw new Error("expected ok");
    }
    const core = coreResult.scene as {
      elements: Array<{ customData?: { nodePath?: string } }>;
      meta?: Record<string, unknown>;
    };
    expect(core.elements.length).toBe(parsed.elements.length);
    expect(core.meta?.importBundleCount).toBe(parsed.meta?.importBundleCount);
    expect(core.meta?.layoutEngine).toBe(parsed.meta?.layoutEngine);

    const nodePaths = (els: typeof core.elements) =>
      els
        .map((el) => el.customData?.nodePath)
        .filter((p): p is string => typeof p === "string")
        .sort();
    expect(nodePaths(core.elements)).toEqual(nodePaths(parsed.elements));
  }, 60_000);
});
