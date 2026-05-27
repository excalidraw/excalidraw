import { describe, expect, it } from "vitest";

import {
  mergeDotAdjacency,
  mergePlanJsons,
  mergePlanWithStates,
  mergeSyntheticPlans,
  parseRawStateJson,
} from "./terraformImportMerge";

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
});
