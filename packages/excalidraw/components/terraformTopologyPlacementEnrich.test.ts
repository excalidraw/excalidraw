import { describe, expect, it } from "vitest";

import {
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
} from "./terraformTopologyPlacement";
import { enrichTopologyPlacementsWithManagedResources } from "./terraformTopologyPlacementEnrich";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("enrichTopologyPlacementsWithManagedResources", () => {
  it("places module.api SSM parameters in the regional strip, not the API VPC zone", () => {
    const plan = {
      configuration: {
        provider_config: {
          aws: {
            name: "aws",
            expressions: {
              region: { constant_value: "us-east-1" },
              assume_role: [
                {
                  role_arn: {
                    constant_value: "arn:aws:iam::111111111111:role/Deploy",
                  },
                },
              ],
            },
          },
        },
      },
      resource_changes: [
        {
          address: "aws_vpc.main",
          mode: "managed",
          type: "aws_vpc",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: { id: "vpc-aaa", region: "us-east-1" },
          },
        },
        {
          address: "aws_subnet.private_a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              id: "subnet-private-a",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
            },
          },
        },
        {
          address: "module.api.aws_api_gateway_rest_api.private",
          mode: "managed",
          type: "aws_api_gateway_rest_api",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: { region: "us-east-1" },
          },
        },
        {
          address:
            "module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
          mode: "managed",
          type: "aws_lambda_function",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              vpc_id: "vpc-aaa",
              subnet_ids: ["subnet-private-a"],
              region: "us-east-1",
            },
          },
        },
        {
          address: "module.api.aws_ssm_parameter.api_name",
          mode: "managed",
          type: "aws_ssm_parameter",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: { region: "us-east-1" },
          },
        },
      ],
    };

    const zones = extractPrimaryTopologyZones(plan);
    const regional = extractRegionalTopologyPrimaries(plan);
    const nodes: TerraformPlanNodesMap = {};
    for (const rc of plan.resource_changes) {
      if (rc.address) {
        nodes[rc.address] = {
          resources: { [rc.address]: rc },
        } as TerraformPlanNodesMap[string];
      }
    }
    enrichTopologyPlacementsWithManagedResources(plan, zones, regional, {
      nodes,
      plan,
    });

    expect(
      zones.some((z) =>
        z.addresses.includes(
          "module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
        ),
      ),
    ).toBe(true);

    expect(
      zones.some((z) =>
        z.addresses.includes("module.api.aws_ssm_parameter.api_name"),
      ),
    ).toBe(false);

    const regionalBucket = regional.find((b) =>
      b.addresses.includes("module.api.aws_ssm_parameter.api_name"),
    );
    expect(regionalBucket).toBeDefined();
    expect(regionalBucket!.region).toBe("us-east-1");
  });
});
