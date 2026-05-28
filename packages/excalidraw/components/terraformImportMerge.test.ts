import { describe, expect, it } from "vitest";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import {
  mergeDotAdjacency,
  mergePlanJsons,
  mergePlanWithStates,
  mergeSyntheticPlans,
  namespacePlanDotBundles,
  parseRawStateJson,
} from "./terraformImportMerge";
import { prefixStackAddress } from "./terraformStackAddress";

describe("terraformImportMerge", () => {
  it("parseRawStateJson accepts terraform state pull shape", () => {
    const r = parseRawStateJson(JSON.stringify({ resources: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Array.isArray(r.state.resources)).toBe(true);
    }
  });

  it("parseRawStateJson rejects invalid JSON", () => {
    const r = parseRawStateJson("not json");
    expect(r.ok).toBe(false);
  });

  it("mergePlanJsons returns single plan unchanged", () => {
    const plan = {
      configuration: { root_module: {} },
      resource_changes: [{ address: "aws_s3_bucket.a" }],
    };
    const { plan: out, warnings } = mergePlanJsons([plan]);
    expect(out).toBe(plan);
    expect(warnings).toEqual([]);
  });

  it("mergePlanJsons concatenates resource_changes and warns on duplicate address", () => {
    const a = {
      resource_changes: [
        { address: "aws_s3_bucket.a", change: { actions: ["create"] } },
      ],
    };
    const b = {
      resource_changes: [
        { address: "aws_s3_bucket.a", change: { actions: ["update"] } },
        { address: "aws_s3_bucket.b", change: { actions: ["create"] } },
      ],
    };
    const { plan, warnings } = mergePlanJsons([a, b], ["stack-a", "stack-b"]);
    expect(plan.resource_changes).toHaveLength(2);
    expect(
      (plan.resource_changes[0] as { change: { actions: string[] } }).change
        .actions,
    ).toEqual(["update"]);
    expect(warnings.some((w) => w.code === "duplicate_address")).toBe(true);
  });

  it("mergeDotAdjacency unions edges from multiple DOT files", () => {
    const dotA = `digraph {
      "a" -> "b"
    }`;
    const dotB = `digraph {
      "a" -> "c"
    }`;
    const adj = mergeDotAdjacency([dotA, dotB]);
    expect(adj.a).toContain("b");
    expect(adj.a).toContain("c");
  });

  it("mergeSyntheticPlans merges two minimal states", () => {
    const stateA = {
      resources: [
        {
          mode: "managed",
          type: "aws_s3_bucket",
          name: "a",
          instances: [{ attributes: { id: "bucket-a" } }],
        },
      ],
    };
    const stateB = {
      resources: [
        {
          mode: "managed",
          type: "aws_s3_bucket",
          name: "b",
          instances: [{ attributes: { id: "bucket-b" } }],
        },
      ],
    };
    const { plan } = mergeSyntheticPlans([stateA, stateB]);
    const addresses = plan.resource_changes.map(
      (rc) => (rc as { address: string }).address,
    );
    expect(addresses).toContain("aws_s3_bucket.a");
    expect(addresses).toContain("aws_s3_bucket.b");
  });

  it("mergePlanWithStates adds state resources to an existing plan", () => {
    const plan = {
      resource_changes: [
        { address: "aws_vpc.main", mode: "managed", type: "aws_vpc" },
      ],
    };
    const state = {
      resources: [
        {
          mode: "managed",
          type: "cloudflare_zone",
          name: "example",
          instances: [{ attributes: { id: "zone-1", name: "example.com" } }],
        },
      ],
    };
    const warnings: import("./terraformImportMerge").TerraformImportWarning[] =
      [];
    const merged = mergePlanWithStates(
      plan,
      [plan],
      [state],
      ["state"],
      warnings,
    );
    const addresses = merged.plan.resource_changes.map(
      (rc) => (rc as { address: string }).address,
    );
    expect(addresses).toContain("aws_vpc.main");
    expect(addresses).toContain("cloudflare_zone.example");
  });

  it("mergePlanWithStates keeps plan change actions over state synthetic read", () => {
    const plan = {
      resource_changes: [
        {
          address: "module.app.aws_lambda_function.this[0]",
          mode: "managed",
          type: "aws_lambda_function",
          change: { actions: ["update"], before: { x: 1 }, after: { x: 2 } },
        },
      ],
    };
    const state = {
      resources: [
        {
          mode: "managed",
          type: "aws_lambda_function",
          name: "this",
          module: "module.app",
          instances: [
            {
              index_key: 0,
              attributes: { function_name: "app" },
            },
          ],
        },
      ],
    };
    const warnings: import("./terraformImportMerge").TerraformImportWarning[] =
      [];
    const merged = mergePlanWithStates(
      plan,
      [plan],
      [state],
      ["state"],
      warnings,
    );
    const writer = merged.plan.resource_changes.find(
      (rc) =>
        (rc as { address?: string }).address ===
        "module.app.aws_lambda_function.this[0]",
    ) as { change?: { actions?: string[] } } | undefined;
    expect(writer?.change?.actions).toContain("update");
  });

  it("namespaced staging multi-state merge has no duplicate_address warnings", () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced, stackIds } = namespacePlanDotBundles(bundles);
    expect(stackIds).toHaveLength(9);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    expect(
      merged.warnings.filter((w) => w.code === "duplicate_address"),
    ).toHaveLength(0);
    expect(merged.plan.resource_changes.length).toBeGreaterThan(150);

    const apiLambdas = merged.plan.resource_changes.filter((rc) =>
      (rc as { address?: string }).address?.includes(
        "module.api.module.lambda_service.module.lambda.aws_lambda_function",
      ),
    );
    expect(apiLambdas.length).toBe(5);
    const stacksSeen = new Set(
      apiLambdas.map(
        (rc) => (rc as { address: string }).address.split("::")[0],
      ),
    );
    expect(stacksSeen.size).toBe(5);
  });

  it("mergeDotAdjacency prefixes node ids per stack", () => {
    const dotA = `digraph { "a" -> "b" }`;
    const dotB = `digraph { "a" -> "c" }`;
    const adj = mergeDotAdjacency([dotA, dotB], ["stack-a", "stack-b"]);
    expect(adj[prefixStackAddress("stack-a", "a")]).toContain(
      prefixStackAddress("stack-a", "b"),
    );
    expect(adj[prefixStackAddress("stack-b", "a")]).toContain(
      prefixStackAddress("stack-b", "c"),
    );
  });
});
