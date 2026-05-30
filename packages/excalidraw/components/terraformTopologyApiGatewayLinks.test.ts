import { describe, expect, it } from "vitest";

import {
  apiGatewayCompanionSatellitePaths,
  buildApiGatewayCompanionCluster,
  isPrivateVpcEndpointBoundRestApi,
  resolveApiGatewayCompanionParentRestApiAddressFromPlan,
  resolveVpcPlacementFromPrivateRestApi,
} from "./terraformTopologyApiGatewayLinks";
import {
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
  mergePrimaryTopologyZonesByTier,
} from "./terraformTopologyPlacement";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformTopologyApiGatewayLinks", () => {
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
        address: "aws_subnet.private_b",
        mode: "managed",
        type: "aws_subnet",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "subnet-private-b",
            vpc_id: "vpc-aaa",
            region: "us-east-1",
          },
        },
      },
      {
        address: "aws_subnet.intra_a",
        mode: "managed",
        type: "aws_subnet",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "subnet-intra-a",
            vpc_id: "vpc-aaa",
            region: "us-east-1",
          },
        },
      },
      {
        address: "aws_vpc_endpoint.execute_api",
        mode: "managed",
        type: "aws_vpc_endpoint",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "vpce-execute-api",
            vpc_id: "vpc-aaa",
            subnet_ids: ["subnet-intra-a"],
            service_name: "com.amazonaws.us-east-1.execute-api",
            region: "us-east-1",
          },
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
            subnet_ids: ["subnet-private-a", "subnet-private-b"],
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
          after: {
            id: "api-abc",
            region: "us-east-1",
            endpoint_configuration: [
              {
                types: ["PRIVATE"],
                vpc_endpoint_ids: ["vpce-execute-api"],
              },
            ],
          },
        },
      },
      {
        address: "module.api.aws_api_gateway_deployment.this",
        mode: "managed",
        type: "aws_api_gateway_deployment",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "dep-xyz",
            rest_api_id: "api-abc",
            region: "us-east-1",
          },
        },
      },
      {
        address: "module.api.aws_api_gateway_stage.stage",
        mode: "managed",
        type: "aws_api_gateway_stage",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            rest_api_id: "api-abc",
            deployment_id: "dep-xyz",
            stage_name: "v1",
            region: "us-east-1",
            access_log_settings: [
              {
                destination_arn:
                  "arn:aws:logs:us-east-1:111111111111:log-group:/aws/apigateway/staging-api-1",
              },
            ],
          },
        },
      },
      {
        address: "module.api.aws_cloudwatch_log_group.api_access",
        mode: "managed",
        type: "aws_cloudwatch_log_group",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            name: "/aws/apigateway/staging-api-1",
            arn: "arn:aws:logs:us-east-1:111111111111:log-group:/aws/apigateway/staging-api-1",
            region: "us-east-1",
          },
        },
      },
      {
        address: "module.api.aws_api_gateway_method_settings.all",
        mode: "managed",
        type: "aws_api_gateway_method_settings",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            rest_api_id: "api-abc",
            stage_name: "v1",
            method_path: "*/*",
            region: "us-east-1",
          },
        },
      },
      {
        address: "module.api.aws_api_gateway_vpc_link.this",
        mode: "managed",
        type: "aws_api_gateway_vpc_link",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "vpclink-abc",
            target_arns: [
              "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/net/internal/abc",
            ],
            region: "us-east-1",
          },
        },
      },
    ],
  };

  it("detects private VPC endpoint–bound REST APIs", () => {
    const apiRc = plan.resource_changes.find(
      (rc) => rc.address === "module.api.aws_api_gateway_rest_api.private",
    )!;
    const values = (apiRc.change as { after: Record<string, unknown> }).after;
    expect(isPrivateVpcEndpointBoundRestApi(values)).toBe(true);
  });

  it("resolves VPC placement from execute-api VPC endpoint id", () => {
    const apiRc = plan.resource_changes.find(
      (rc) => rc.address === "module.api.aws_api_gateway_rest_api.private",
    )!;
    const values = (apiRc.change as { after: Record<string, unknown> }).after;
    const subnetToVpc = new Map([
      ["subnet-intra-a", "vpc-aaa"],
      ["subnet-private-a", "vpc-aaa"],
    ]);
    expect(
      resolveVpcPlacementFromPrivateRestApi(plan, values, subnetToVpc),
    ).toEqual({
      vpcId: "vpc-aaa",
      subnetIds: ["subnet-intra-a"],
    });
  });

  it("places private REST API in VPC zone with companions", () => {
    const rawZones = extractPrimaryTopologyZones(plan);
    expect(
      rawZones.filter((z) =>
        z.addresses.some(
          (a) =>
            a.includes("aws_api_gateway_rest_api") ||
            a.includes("aws_lambda_function"),
        ),
      ),
    ).toHaveLength(2);
    const zones = mergePrimaryTopologyZonesByTier(
      rawZones.map((z) => ({
        ...z,
        topologyZoneSource: "primary" as const,
      })),
      plan,
    );
    const regional = extractRegionalTopologyPrimaries(plan);
    const apiAddr = "module.api.aws_api_gateway_rest_api.private";

    expect(zones.some((z) => z.addresses.includes(apiAddr))).toBe(true);
    expect(regional.some((b) => b.addresses.includes(apiAddr))).toBe(false);

    const lambdaAddr =
      "module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]";
    const primaryZones = zones.filter((z) =>
      z.addresses.some(
        (a) =>
          a === apiAddr ||
          a === lambdaAddr ||
          a.includes("aws_api_gateway_rest_api") ||
          a.includes("aws_lambda_function"),
      ),
    );
    expect(primaryZones.length).toBeGreaterThanOrEqual(2);
    const apiZone = zones.find((z) => z.addresses.includes(apiAddr));
    const lambdaZone = zones.find((z) => z.addresses.includes(lambdaAddr));
    expect(apiZone).toBeDefined();
    expect(lambdaZone).toBeDefined();
    expect(apiZone).not.toBe(lambdaZone);
    expect(apiZone!.subnetIds).toContain("subnet-intra-a");
    expect(lambdaZone!.subnetSignature).toBe(
      "subnet-private-a|subnet-private-b",
    );
    expect(apiZone!.addresses).toContain(
      "module.api.aws_api_gateway_stage.stage",
    );
    expect(apiZone!.addresses).toContain(
      "module.api.aws_api_gateway_vpc_link.this",
    );
  });

  it("buildApiGatewayCompanionCluster nests deployment and logs under stage", () => {
    const nodes: TerraformPlanNodesMap = {};
    for (const rc of plan.resource_changes) {
      if (rc.address) {
        nodes[rc.address] = {
          resources: { [rc.address]: rc },
        } as TerraformPlanNodesMap[string];
      }
    }
    const { cluster, edges } = buildApiGatewayCompanionCluster(
      nodes,
      "module.api.aws_api_gateway_rest_api.private",
    );
    expect(cluster?.stages).toHaveLength(1);
    expect(cluster?.stages[0]).toEqual({
      stage: "module.api.aws_api_gateway_stage.stage",
      deployment: "module.api.aws_api_gateway_deployment.this",
      logGroup: "module.api.aws_cloudwatch_log_group.api_access",
    });
    expect(cluster?.methodSettings).toEqual([
      "module.api.aws_api_gateway_method_settings.all",
    ]);
    expect(cluster?.vpcLinks).toEqual([
      "module.api.aws_api_gateway_vpc_link.this",
    ]);
    expect(apiGatewayCompanionSatellitePaths(cluster!)).toEqual([
      "module.api.aws_api_gateway_vpc_link.this",
      "module.api.aws_api_gateway_stage.stage",
      "module.api.aws_api_gateway_deployment.this",
      "module.api.aws_cloudwatch_log_group.api_access",
      "module.api.aws_api_gateway_method_settings.all",
    ]);
    expect(edges.some((e) => e.type === "api_gateway_deployment")).toBe(true);
    expect(edges.some((e) => e.type === "api_gateway_access_log")).toBe(true);
    expect(edges.some((e) => e.type === "api_gateway_vpc_link")).toBe(true);
  });

  it("resolves vpc link parent REST API from module scope", () => {
    const vpcRc = plan.resource_changes.find(
      (rc) => rc.address === "module.api.aws_api_gateway_vpc_link.this",
    )!;
    const nodes: TerraformPlanNodesMap = {};
    for (const rc of plan.resource_changes) {
      if (rc.address) {
        nodes[rc.address] = {
          resources: { [rc.address]: rc },
        } as TerraformPlanNodesMap[string];
      }
    }
    expect(
      resolveApiGatewayCompanionParentRestApiAddressFromPlan(
        vpcRc,
        plan.resource_changes,
        nodes,
      ),
    ).toBe("module.api.aws_api_gateway_rest_api.private");
  });
});
