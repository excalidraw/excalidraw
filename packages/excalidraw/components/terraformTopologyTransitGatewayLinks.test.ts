import { describe, expect, it } from "vitest";

import { extractRegionalTopologyPrimaries } from "./terraformTopologyPlacement";
import {
  buildTransitGatewayCompanionCluster,
  filterTopologyAddressesExcludingTgwSatellites,
  resolveTransitGatewayCompanionParentFromPlan,
  transitGatewayCompanionSatellitePaths,
} from "./terraformTopologyTransitGatewayLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

const planWithDefaultAwsAccountRegion = {
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
};

describe("terraformTopologyTransitGatewayLinks", () => {
  const westPlan = {
    ...planWithDefaultAwsAccountRegion,
    resource_changes: [
      {
        address: "aws_ec2_transit_gateway.west",
        mode: "managed",
        type: "aws_ec2_transit_gateway",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "tgw-west",
            region: "us-west-2",
            association_default_route_table_id: "tgw-rtb-west",
          },
        },
      },
      {
        address: "aws_ec2_transit_gateway_vpc_attachment.west_vpc",
        mode: "managed",
        type: "aws_ec2_transit_gateway_vpc_attachment",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "tgw-att-west",
            transit_gateway_id: "tgw-west",
            region: "us-west-2",
          },
        },
      },
      {
        address: "aws_ec2_transit_gateway_peering_attachment.west_to_east",
        mode: "managed",
        type: "aws_ec2_transit_gateway_peering_attachment",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            id: "tgw-peer-1",
            transit_gateway_id: "tgw-west",
            region: "us-west-2",
          },
        },
      },
      {
        address:
          "aws_ec2_transit_gateway_peering_attachment_accepter.east_accept",
        mode: "managed",
        type: "aws_ec2_transit_gateway_peering_attachment_accepter",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            transit_gateway_attachment_id: "tgw-peer-1",
            region: "us-west-2",
          },
        },
      },
      {
        address: "aws_ec2_transit_gateway_route.west_to_east",
        mode: "managed",
        type: "aws_ec2_transit_gateway_route",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            transit_gateway_route_table_id: "tgw-rtb-west",
            transit_gateway_attachment_id: "tgw-peer-1",
            region: "us-west-2",
          },
        },
      },
    ],
  };

  it("resolves parent TGW from attachment and route resources", () => {
    const changes = westPlan.resource_changes;
    const vpcAtt = changes.find(
      (r) => r.type === "aws_ec2_transit_gateway_vpc_attachment",
    )!;
    const route = changes.find(
      (r) => r.type === "aws_ec2_transit_gateway_route",
    )!;
    expect(resolveTransitGatewayCompanionParentFromPlan(vpcAtt, changes)).toBe(
      "aws_ec2_transit_gateway.west",
    );
    expect(resolveTransitGatewayCompanionParentFromPlan(route, changes)).toBe(
      "aws_ec2_transit_gateway.west",
    );
  });

  it("builds nested peering cluster with accepter and routes", () => {
    const nodes: TerraformPlanNodesMap = {};
    for (const rc of westPlan.resource_changes) {
      nodes[rc.address] = {
        resources: { [rc.address]: rc },
      } as TerraformPlanNodesMap[string];
    }
    const { cluster } = buildTransitGatewayCompanionCluster(
      nodes,
      "aws_ec2_transit_gateway.west",
      westPlan.resource_changes,
    );
    expect(cluster).toBeTruthy();
    expect(cluster!.vpcAttachments).toContain(
      "aws_ec2_transit_gateway_vpc_attachment.west_vpc",
    );
    expect(cluster!.peering).toHaveLength(1);
    expect(cluster!.peering[0]!.accepter).toBe(
      "aws_ec2_transit_gateway_peering_attachment_accepter.east_accept",
    );
    expect(cluster!.peering[0]!.routes).toContain(
      "aws_ec2_transit_gateway_route.west_to_east",
    );
    expect(
      transitGatewayCompanionSatellitePaths(cluster!).length,
    ).toBeGreaterThan(3);
  });

  it("groups TGW satellites in regional primary bucket", () => {
    const regional = extractRegionalTopologyPrimaries(westPlan);
    expect(regional).toHaveLength(1);
    const addrs = regional[0]!.addresses;
    expect(addrs).toContain("aws_ec2_transit_gateway.west");
    expect(addrs).toContain("aws_ec2_transit_gateway_vpc_attachment.west_vpc");
    expect(addrs).toContain(
      "aws_ec2_transit_gateway_peering_attachment.west_to_east",
    );
    expect(
      filterTopologyAddressesExcludingTgwSatellites(
        nodesFromPlan(westPlan),
        addrs,
        westPlan.resource_changes,
      ),
    ).toEqual(["aws_ec2_transit_gateway.west"]);
  });
});

function nodesFromPlan(plan: {
  resource_changes: Array<{ address: string; [key: string]: unknown }>;
}): TerraformPlanNodesMap {
  const nodes: TerraformPlanNodesMap = {};
  for (const rc of plan.resource_changes) {
    nodes[rc.address] = {
      resources: { [rc.address]: rc },
    } as TerraformPlanNodesMap[string];
  }
  return nodes;
}
