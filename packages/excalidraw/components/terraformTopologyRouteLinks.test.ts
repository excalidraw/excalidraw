import { describe, expect, it } from "vitest";

import {
  buildRouteTableIdToRouteAddressesFromPlan,
  formatAwsRouteSemanticLabel,
  resolveRouteTableIdForRoute,
} from "./terraformTopologyRouteLinks";
import { computeRouteTableBottomEdgePlacements } from "./terraformTopologyPlacement";
import type { TopologyPlacementZone } from "./terraformTopologyPlacement";

describe("terraformTopologyRouteLinks", () => {
  it("resolveRouteTableIdForRoute uses for_each rtb key when route_table_id is absent in values", () => {
    const rc = {
      address: 'aws_route.east_db_to_tgw["rtb-0f87cbcf24471c65e"]',
      mode: "managed",
      type: "aws_route",
      provider_name: "registry.terraform.io/hashicorp/aws",
      change: {
        actions: ["create"],
        after: {
          destination_cidr_block: "10.1.0.0/16",
          transit_gateway_id: "tgw-abc",
        },
      },
    };
    expect(resolveRouteTableIdForRoute(rc)).toBe("rtb-0f87cbcf24471c65e");
  });

  it("groups routes by rtb id for cross-stack placement", () => {
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-east",
        subnetSignature: "subnet-db",
        subnetIds: ["subnet-db"],
        addresses: [],
      },
    ];
    const plan = {
      resource_changes: [
        {
          address: "module.east_network.module.vpc.aws_route_table.database[0]",
          mode: "managed",
          type: "aws_route_table",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:route-table/rtb-db-east",
              vpc_id: "vpc-east",
              region: "us-east-1",
              id: "rtb-db-east",
            },
          },
        },
        {
          address: "module.east_network.module.vpc.aws_route_table_association.database[0]",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-db",
              route_table_id: "rtb-db-east",
            },
          },
        },
        {
          address: '01-west-network::aws_route.east_db_to_tgw["rtb-db-east"]',
          mode: "managed",
          type: "aws_route",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              route_table_id: "rtb-db-east",
              destination_cidr_block: "10.2.0.0/16",
              transit_gateway_id: "tgw-west",
            },
          },
        },
      ],
    };

    const rtidToRoutes = buildRouteTableIdToRouteAddressesFromPlan(plan);
    expect([...(rtidToRoutes.get("rtb-db-east") ?? [])]).toEqual([
      '01-west-network::aws_route.east_db_to_tgw["rtb-db-east"]',
    ]);

    const { zoneBottom, vpcBottom } = computeRouteTableBottomEdgePlacements(
      zones,
      plan,
    );
    expect(vpcBottom).toHaveLength(0);
    expect(zoneBottom).toHaveLength(1);
    expect(zoneBottom[0]!.routeChildrenByTable).toEqual({
      "module.east_network.module.vpc.aws_route_table.database[0]": [
        '01-west-network::aws_route.east_db_to_tgw["rtb-db-east"]',
      ],
    });
  });

  it("formatAwsRouteSemanticLabel shows destination and next hop", () => {
    expect(
      formatAwsRouteSemanticLabel({
        destination_cidr_block: "0.0.0.0/0",
        gateway_id: "igw-0123",
      }),
    ).toBe("0.0.0.0/0 → IGW");
    expect(
      formatAwsRouteSemanticLabel({
        destination_cidr_block: "10.0.0.0/8",
        transit_gateway_id: "tgw-1",
      }),
    ).toBe("10.0.0.0/8 → TGW");
  });
});
