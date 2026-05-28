import { describe, expect, it } from "vitest";

import { getTerraformPlanNodeAction } from "./terraformElkLayout";
import { preferTopologyNodeKeyAmongAliases } from "./terraformStackAddress";
import {
  canonicalTopologyNodeKey,
  dedupeTerraformPlanNodesByBareAddress,
  topologyAddressesMatch,
} from "./terraformTopologyAddress";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

const noopChange = { change: { actions: ["no-op"] } };

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

  it("keeps separate nodes for the same module path on different stacks", () => {
    const nodes = {
      "40-east-api-1::module.api.aws_api_gateway_rest_api.private": {
        resources: {
          "40-east-api-1::module.api.aws_api_gateway_rest_api.private":
            noopChange,
        },
      },
      "41-east-api-2::module.api.aws_api_gateway_rest_api.private": {
        resources: {
          "41-east-api-2::module.api.aws_api_gateway_rest_api.private":
            noopChange,
        },
      },
    } as TerraformPlanNodesMap;
    dedupeTerraformPlanNodesByBareAddress(nodes);
    expect(
      nodes["40-east-api-1::module.api.aws_api_gateway_rest_api.private"],
    ).toBeDefined();
    expect(
      nodes["41-east-api-2::module.api.aws_api_gateway_rest_api.private"],
    ).toBeDefined();
    expect(
      getTerraformPlanNodeAction(
        nodes["41-east-api-2::module.api.aws_api_gateway_rest_api.private"],
      ),
    ).toBe("no-op");
  });

  it("does not match addresses across stacks", () => {
    expect(
      topologyAddressesMatch(
        "40-east-api-1::module.api.aws_api_gateway_rest_api.private",
        "41-east-api-2::module.api.aws_api_gateway_rest_api.private",
      ),
    ).toBe(false);
  });

  it("does not collapse count/for_each instance indexes during dedupe", () => {
    const nodes = {
      "00-east-network::module.east_network.module.vpc.aws_subnet.public[0]": {
        resources: {
          "00-east-network::module.east_network.module.vpc.aws_subnet.public[0]":
            noopChange,
        },
      },
      "00-east-network::module.east_network.module.vpc.aws_subnet.public[1]": {
        resources: {
          "00-east-network::module.east_network.module.vpc.aws_subnet.public[1]":
            noopChange,
        },
      },
    } as TerraformPlanNodesMap;
    dedupeTerraformPlanNodesByBareAddress(nodes);
    expect(
      nodes[
        "00-east-network::module.east_network.module.vpc.aws_subnet.public[0]"
      ],
    ).toBeDefined();
    expect(
      nodes[
        "00-east-network::module.east_network.module.vpc.aws_subnet.public[1]"
      ],
    ).toBeDefined();
    expect(
      getTerraformPlanNodeAction(
        nodes[
          "00-east-network::module.east_network.module.vpc.aws_subnet.public[1]"
        ],
      ),
    ).toBe("no-op");
  });
});
