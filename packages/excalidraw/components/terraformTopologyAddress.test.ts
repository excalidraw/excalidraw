import { describe, expect, it } from "vitest";

import { preferTopologyNodeKeyAmongAliases } from "./terraformStackAddress";
import {
  canonicalTopologyNodeKey,
  dedupeTerraformPlanNodesByBareAddress,
} from "./terraformTopologyAddress";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformTopologyAddress", () => {
  it("prefers stack-qualified alias when bare and qualified collide", () => {
    expect(
      preferTopologyNodeKeyAmongAliases([
        "aws_security_group.alb",
        "10-east-ecs-edge::aws_security_group.alb",
      ]),
    ).toBe("10-east-ecs-edge::aws_security_group.alb");
  });

  it("dedupes ghost unqualified nodes after multi-stack merge", () => {
    const nodes = {
      "aws_security_group.alb": { resources: { "aws_security_group.alb": {} } },
      "10-east-ecs-edge::aws_security_group.alb": {
        resources: { "10-east-ecs-edge::aws_security_group.alb": {} },
      },
    } as TerraformPlanNodesMap;
    dedupeTerraformPlanNodesByBareAddress(nodes);
    expect(nodes["aws_security_group.alb"]).toBeUndefined();
    expect(nodes["10-east-ecs-edge::aws_security_group.alb"]).toBeDefined();
    expect(canonicalTopologyNodeKey(nodes, "aws_security_group.alb")).toBe(
      "10-east-ecs-edge::aws_security_group.alb",
    );
  });
});
