import graphlibDot from "@dagrejs/graphlib-dot";
import { describe, expect, it } from "vitest";

import {
  buildTerraformLocalImportNodesMap,
  resolveTerraformPlanNodeKey,
} from "./terraformPlanParsing";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("buildTerraformLocalImportNodesMap stack aliases", () => {
  const graph = graphlibDot.read("digraph G {}\n");

  it("prefixes tfstate addresses per parallel stackId and dedupes ghosts", () => {
    const plan = {
      resource_changes: [
        {
          address: "stack-a::aws_s3_bucket.logs",
          type: "aws_s3_bucket",
          name: "logs",
          mode: "managed",
          change: { actions: ["no-op"] },
        },
      ],
    };
    const tfstate = {
      resources: [
        {
          mode: "managed",
          type: "aws_s3_bucket",
          name: "logs",
          instances: [{ attributes: { bucket: "logs" }, dependencies: [] }],
        },
      ],
    };
    const nodes = buildTerraformLocalImportNodesMap(plan, graph, tfstate, {
      stackIds: ["stack-a"],
    });
    expect(nodes["aws_s3_bucket.logs"]).toBeUndefined();
    expect(nodes["stack-a::aws_s3_bucket.logs"]).toBeDefined();
  });

  it("resolveTerraformPlanNodeKey prefers stack-qualified over bare", () => {
    const nodes = {
      "aws_vpc.main": { resources: {} },
      "stack-b::aws_vpc.main": { resources: {} },
    } as TerraformPlanNodesMap;
    expect(resolveTerraformPlanNodeKey(nodes, "aws_vpc.main")).toBe(
      "stack-b::aws_vpc.main",
    );
    expect(resolveTerraformPlanNodeKey(nodes, "stack-b::aws_vpc.main")).toBe(
      "stack-b::aws_vpc.main",
    );
  });
});
