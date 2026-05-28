import { describe, expect, it } from "vitest";

import {
  collectPlacementSubnetIds,
  computeNatGatewayZonePlacements,
  computeRouteTableBottomEdgePlacements,
  computeVpcRouteTableFanOutAddressesForVpc,
  extractInterfaceEndpointSecurityGroupBuckets,
  extractPrimaryTopologyZones,
  extractRouteTablesByVpc,
  extractSupplementarySubnetZones,
  extractVpcDefaultPlumbingBuckets,
  extractVpcEndpointsByVpc,
  extractVpcFlowLogBundles,
  mergeSupplementarySubnetZonesByTier,
  mergeSupplementarySubnetZonesSharedRouteTable,
  natZonePlacementsKey,
} from "./terraformTopologyPlacement";

import type { TopologyPlacementZone } from "./terraformTopologyPlacement";

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

describe("extractVpcEndpointsByVpc", () => {
  it("groups managed aws_vpc_endpoint by account, region, vpc_id and sorts by service_name then address", () => {
    const plan = {
      resource_changes: [
        {
          address: 'aws_vpc_endpoint.a["z"]',
          mode: "managed",
          type: "aws_vpc_endpoint",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:vpc-endpoint/vpce-aaa",
              vpc_id: "vpc-aaa",
              service_name: "com.amazonaws.us-east-1.logs",
              region: "us-east-1",
            },
          },
        },
        {
          address: 'aws_vpc_endpoint.a["y"]',
          mode: "managed",
          type: "aws_vpc_endpoint",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:vpc-endpoint/vpce-bbb",
              vpc_id: "vpc-aaa",
              service_name: "com.amazonaws.us-east-1.s3",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_vpc_endpoint.other",
          mode: "managed",
          type: "aws_vpc_endpoint",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:eu-west-1:222222222222:vpc-endpoint/vpce-ccc",
              vpc_id: "vpc-bbb",
              service_name: "com.amazonaws.eu-west-1.ec2",
              region: "eu-west-1",
            },
          },
        },
        {
          address: "data.aws_vpc_endpoint_service.svc",
          mode: "data",
          type: "aws_vpc_endpoint_service",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: { actions: ["read"], after: {} },
        },
      ],
    };

    const buckets = extractVpcEndpointsByVpc(plan);
    expect(buckets).toHaveLength(2);

    const us = buckets.find((b) => b.region === "us-east-1");
    expect(us).toBeDefined();
    expect(us!.vpcId).toBe("vpc-aaa");
    expect(us!.accountId).toBe("111111111111");
    expect(us!.addresses).toEqual([
      'aws_vpc_endpoint.a["z"]',
      'aws_vpc_endpoint.a["y"]',
    ]);

    const eu = buckets.find((b) => b.region === "eu-west-1");
    expect(eu?.addresses).toEqual(["aws_vpc_endpoint.other"]);
  });

  it("skips non-managed and rows without vpc_id", () => {
    const plan = {
      resource_changes: [
        {
          address: "aws_vpc_endpoint.x",
          mode: "data",
          type: "aws_vpc_endpoint",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: { arn: "arn:aws:ec2:us-east-1:111111111111:vpc-endpoint/x" },
          },
        },
        {
          address: "aws_vpc_endpoint.y",
          mode: "managed",
          type: "aws_vpc_endpoint",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: { arn: "arn:aws:ec2:us-east-1:111111111111:vpc-endpoint/y" },
          },
        },
      ],
    };
    expect(extractVpcEndpointsByVpc(plan)).toHaveLength(0);
  });
});

describe("extractRouteTablesByVpc", () => {
  it("groups managed aws_route_table by vpc_id and sorts by tag Name then address", () => {
    const plan = {
      resource_changes: [
        {
          address: "module.vpc.aws_route_table.private",
          mode: "managed",
          type: "aws_route_table",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:route-table/rtb-private",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
              id: "rtb-private",
              tags: { Name: "private-rt" },
            },
          },
        },
        {
          address: "module.vpc.aws_route_table.public",
          mode: "managed",
          type: "aws_route_table",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:route-table/rtb-public",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
              id: "rtb-public",
              tags: { Name: "public-rt" },
            },
          },
        },
        {
          address: "module.vpc.aws_route_table_association.a",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-1",
              route_table_id: "rtb-private",
            },
          },
        },
      ],
    };

    const buckets = extractRouteTablesByVpc(plan);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.vpcId).toBe("vpc-aaa");
    expect(buckets[0]!.addresses).toEqual([
      "module.vpc.aws_route_table.private",
      "module.vpc.aws_route_table.public",
    ]);
  });
});

describe("computeRouteTableBottomEdgePlacements", () => {
  const baseZones = (
    extra: TopologyPlacementZone[],
  ): readonly TopologyPlacementZone[] => [
    {
      accountId: "111111111111",
      region: "us-east-1",
      vpcId: "vpc-aaa",
      subnetSignature: "subnet-a",
      subnetIds: ["subnet-a"],
      addresses: ["aws_lambda_function.a"],
    },
    ...extra,
  ];

  it("places route table on the narrowest subnet zone when association subnets fit one zone", () => {
    const zones = baseZones([
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-aaa",
        subnetSignature: "subnet-a|subnet-b",
        subnetIds: ["subnet-a", "subnet-b"],
        addresses: ["aws_lambda_function.b"],
      },
    ]);
    const plan = {
      resource_changes: [
        {
          address: "aws_route_table.rt",
          mode: "managed",
          type: "aws_route_table",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:route-table/rtb-1",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
              id: "rtb-1",
            },
          },
        },
        {
          address: "aws_route_table_association.assoc",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-a",
              route_table_id: "rtb-1",
            },
          },
        },
        {
          address: "aws_route.to_igw",
          mode: "managed",
          type: "aws_route",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              route_table_id: "rtb-1",
              destination_cidr_block: "0.0.0.0/0",
            },
          },
        },
      ],
    };

    const { zoneBottom, vpcBottom } = computeRouteTableBottomEdgePlacements(
      zones,
      plan,
    );
    expect(vpcBottom).toHaveLength(0);
    expect(zoneBottom).toHaveLength(1);
    expect(zoneBottom[0]!.subnetSignature).toBe("subnet-a");
    expect(zoneBottom[0]!.addresses).toEqual(["aws_route_table.rt"]);
    expect(zoneBottom[0]!.routeChildrenByTable).toEqual({
      "aws_route_table.rt": ["aws_route.to_igw"],
    });
  });

  it("falls back to VPC bottom when associated subnets are not contained in a single zone", () => {
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-aaa",
        subnetSignature: "subnet-a",
        subnetIds: ["subnet-a"],
        addresses: ["aws_lambda_function.a"],
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-aaa",
        subnetSignature: "subnet-b",
        subnetIds: ["subnet-b"],
        addresses: ["aws_lambda_function.b"],
      },
    ];
    const plan = {
      resource_changes: [
        {
          address: "aws_route_table.rt",
          mode: "managed",
          type: "aws_route_table",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:route-table/rtb-1",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
              id: "rtb-1",
            },
          },
        },
        {
          address: "aws_route_table_association.assoc",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-a",
              route_table_id: "rtb-1",
            },
          },
        },
        {
          address: "aws_route_table_association.assoc2",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-b",
              route_table_id: "rtb-1",
            },
          },
        },
      ],
    };

    const { zoneBottom, vpcBottom } = computeRouteTableBottomEdgePlacements(
      zones,
      plan,
    );
    expect(zoneBottom).toHaveLength(0);
    expect(vpcBottom).toHaveLength(1);
    expect(vpcBottom[0]!.addresses).toEqual(["aws_route_table.rt"]);
    expect(vpcBottom[0]!.routeChildrenByTable).toEqual({
      "aws_route_table.rt": [],
    });
  });
});

describe("mergeSupplementarySubnetZonesSharedRouteTable", () => {
  it("merges two supplementary aws_subnet-only zones that share one route table", () => {
    const plan = {
      resource_changes: [
        {
          address: "aws_subnet.a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-a",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_subnet.b",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-b",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_route_table.common",
          mode: "managed",
          type: "aws_route_table",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "rtb-1",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_route_table_association.a",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-a",
              route_table_id: "rtb-1",
            },
          },
        },
        {
          address: "aws_route_table_association.b",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-b",
              route_table_id: "rtb-1",
            },
          },
        },
      ],
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-a",
        subnetIds: ["subnet-a"],
        addresses: [],
        topologyZoneSource: "supplementary",
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-b",
        subnetIds: ["subnet-b"],
        addresses: [],
        topologyZoneSource: "supplementary",
      },
    ];
    const merged = mergeSupplementarySubnetZonesSharedRouteTable(
      zones,
      plan as never,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.subnetSignature).toBe("subnet-a|subnet-b");
    expect(merged[0]!.addresses).toEqual([]);
    expect(merged[0]!.mergedSupplementaryComposite).toBeUndefined();
  });
});

describe("mergeSupplementarySubnetZonesByTier", () => {
  it("merges two supplementary private zones with different route tables", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.private_a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              id: "subnet-priv-a",
              vpc_id: "vpc-1",
              region: "us-east-1",
              tags: { Name: "app-private-us-east-1a" },
            },
          },
        },
        {
          address: "aws_subnet.private_b",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              id: "subnet-priv-b",
              vpc_id: "vpc-1",
              region: "us-east-1",
              tags: { Name: "app-private-us-east-1b" },
            },
          },
        },
        {
          address: "aws_route_table_association.a",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              subnet_id: "subnet-priv-a",
              route_table_id: "rtb-priv-a",
            },
          },
        },
        {
          address: "aws_route_table_association.b",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              subnet_id: "subnet-priv-b",
              route_table_id: "rtb-priv-b",
            },
          },
        },
      ],
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-priv-a",
        subnetIds: ["subnet-priv-a"],
        addresses: ["aws_subnet.private_a"],
        topologyZoneSource: "supplementary",
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-priv-b",
        subnetIds: ["subnet-priv-b"],
        addresses: ["aws_subnet.private_b"],
        topologyZoneSource: "supplementary",
      },
    ];
    const afterRt = mergeSupplementarySubnetZonesSharedRouteTable(
      zones,
      plan as never,
    );
    expect(afterRt).toHaveLength(2);
    const merged = mergeSupplementarySubnetZonesByTier(afterRt, plan as never);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.subnetSignature).toBe("subnet-priv-a|subnet-priv-b");
    expect(merged[0]!.addresses).toEqual([]);
    expect(merged[0]!.mergedSupplementaryByTier).toBe(true);
    expect(merged[0]!.mergedSupplementaryComposite).toBeUndefined();
  });

  it("does not merge supplementary zones of different tiers", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.private",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              id: "subnet-priv",
              vpc_id: "vpc-1",
              region: "us-east-1",
              tags: { Name: "app-private-a" },
            },
          },
        },
        {
          address: "aws_subnet.intra",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              id: "subnet-intra",
              vpc_id: "vpc-1",
              region: "us-east-1",
              tags: { Name: "app-intra-a" },
            },
          },
        },
      ],
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-priv",
        subnetIds: ["subnet-priv"],
        addresses: ["aws_subnet.private"],
        topologyZoneSource: "supplementary",
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-intra",
        subnetIds: ["subnet-intra"],
        addresses: ["aws_subnet.intra"],
        topologyZoneSource: "supplementary",
      },
    ];
    const merged = mergeSupplementarySubnetZonesByTier(zones, plan as never);
    expect(merged).toHaveLength(2);
  });

  it("does not merge other-tier or non-subnet-only supplementary zones", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.misc_a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              id: "subnet-misc-a",
              vpc_id: "vpc-1",
              region: "us-east-1",
              tags: { Name: "app-db-a" },
            },
          },
        },
        {
          address: "aws_subnet.misc_b",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["read"],
            after: {
              id: "subnet-misc-b",
              vpc_id: "vpc-1",
              region: "us-east-1",
              tags: { Name: "app-db-b" },
            },
          },
        },
      ],
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-misc-a",
        subnetIds: ["subnet-misc-a"],
        addresses: ["aws_subnet.misc_a"],
        topologyZoneSource: "supplementary",
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-misc-b",
        subnetIds: ["subnet-misc-b"],
        addresses: ["aws_subnet.misc_b", "aws_lambda_function.x"],
        topologyZoneSource: "supplementary",
      },
    ];
    const merged = mergeSupplementarySubnetZonesByTier(zones, plan as never);
    expect(merged).toHaveLength(2);
  });
});

describe("computeVpcRouteTableFanOutAddressesForVpc", () => {
  it("returns route table addresses that hit two or more placement zones", () => {
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-aaa",
        subnetSignature: "subnet-a",
        subnetIds: ["subnet-a"],
        addresses: ["aws_lambda_function.a"],
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-aaa",
        subnetSignature: "subnet-b",
        subnetIds: ["subnet-b"],
        addresses: ["aws_lambda_function.b"],
      },
    ];
    const plan = {
      resource_changes: [
        {
          address: "aws_route_table.rt",
          mode: "managed",
          type: "aws_route_table",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:route-table/rtb-1",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
              id: "rtb-1",
            },
          },
        },
        {
          address: "aws_route_table_association.assoc",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-a",
              route_table_id: "rtb-1",
            },
          },
        },
        {
          address: "aws_route_table_association.assoc2",
          mode: "managed",
          type: "aws_route_table_association",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              subnet_id: "subnet-b",
              route_table_id: "rtb-1",
            },
          },
        },
      ],
    };
    const placements = computeRouteTableBottomEdgePlacements(
      zones,
      plan as never,
    );
    const fan = computeVpcRouteTableFanOutAddressesForVpc(
      zones,
      placements,
      plan as never,
      "111111111111",
      "us-east-1",
      "vpc-aaa",
    );
    expect(fan.has("aws_route_table.rt")).toBe(true);
  });
});

describe("extractVpcDefaultPlumbingBuckets", () => {
  it("groups default VPC resources by vpc id", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_default_security_group.this",
          mode: "managed",
          type: "aws_default_security_group",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              vpc_id: "vpc-aaa",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_default_network_acl.this",
          mode: "managed",
          type: "aws_default_network_acl",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              vpc_id: "vpc-aaa",
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const buckets = extractVpcDefaultPlumbingBuckets(plan);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.vpcId).toBe("vpc-aaa");
    expect(buckets[0]!.addresses.sort()).toEqual(
      [
        "aws_default_network_acl.this",
        "aws_default_security_group.this",
      ].sort(),
    );
  });
});

describe("computeNatGatewayZonePlacements", () => {
  /** Two AZs, two NATs each in its own public-subnet zone, each NAT pairs with one EIP. */
  const twoAzNatPlan = () => ({
    ...planWithDefaultAwsAccountRegion,
    resource_changes: [
      {
        address: "aws_nat_gateway.a",
        mode: "managed",
        type: "aws_nat_gateway",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            subnet_id: "subnet-pub-a",
            allocation_id: "eipalloc-a",
            vpc_id: "vpc-1",
          },
        },
      },
      {
        address: "aws_nat_gateway.b",
        mode: "managed",
        type: "aws_nat_gateway",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: {
            subnet_id: "subnet-pub-b",
            allocation_id: "eipalloc-b",
            vpc_id: "vpc-1",
          },
        },
      },
      {
        address: "aws_eip.a",
        mode: "managed",
        type: "aws_eip",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: { id: "eipalloc-a", allocation_id: "eipalloc-a" },
        },
      },
      {
        address: "aws_eip.b",
        mode: "managed",
        type: "aws_eip",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["create"],
          after: { id: "eipalloc-b", allocation_id: "eipalloc-b" },
        },
      },
    ],
  });

  it("pairs each NAT with its EIP and routes the pair into the owning public-subnet zone", () => {
    const plan = twoAzNatPlan();
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-pub-a",
        subnetIds: ["subnet-pub-a"],
        addresses: [],
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-pub-b",
        subnetIds: ["subnet-pub-b"],
        addresses: [],
      },
    ];

    const result = computeNatGatewayZonePlacements(plan, zones);
    expect(result.byZone.size).toBe(2);

    const az1 = result.byZone.get(
      natZonePlacementsKey(
        "111111111111",
        "us-east-1",
        "vpc-1",
        "subnet-pub-a",
      ),
    );
    expect(az1).toBeDefined();
    expect(az1!).toEqual([
      { natAddress: "aws_nat_gateway.a", eipAddresses: ["aws_eip.a"] },
    ]);

    const az2 = result.byZone.get(
      natZonePlacementsKey(
        "111111111111",
        "us-east-1",
        "vpc-1",
        "subnet-pub-b",
      ),
    );
    expect(az2).toBeDefined();
    expect(az2!).toEqual([
      { natAddress: "aws_nat_gateway.b", eipAddresses: ["aws_eip.b"] },
    ]);

    expect([...result.consumedAddresses].sort()).toEqual(
      [
        "aws_nat_gateway.a",
        "aws_nat_gateway.b",
        "aws_eip.a",
        "aws_eip.b",
      ].sort(),
    );
  });

  it("leaves NAT and orphan EIP unconsumed when no zone owns the NAT subnet", () => {
    const plan = twoAzNatPlan();
    const zonesMissingB: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-pub-a",
        subnetIds: ["subnet-pub-a"],
        addresses: [],
      },
      /** Zone for subnet-pub-b intentionally omitted — NAT.b should fall back to the right edge. */
    ];

    const result = computeNatGatewayZonePlacements(plan, zonesMissingB);
    expect(result.byZone.size).toBe(1);
    expect(result.consumedAddresses.has("aws_nat_gateway.a")).toBe(true);
    expect(result.consumedAddresses.has("aws_eip.a")).toBe(true);
    expect(result.consumedAddresses.has("aws_nat_gateway.b")).toBe(false);
    expect(result.consumedAddresses.has("aws_eip.b")).toBe(false);
  });

  it("emits a NAT cluster with no EIP when allocation_id has no matching aws_eip", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_nat_gateway.solo",
          mode: "managed",
          type: "aws_nat_gateway",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              subnet_id: "subnet-pub-a",
              allocation_id: "eipalloc-missing",
              vpc_id: "vpc-1",
            },
          },
        },
      ],
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-pub-a",
        subnetIds: ["subnet-pub-a"],
        addresses: [],
      },
    ];

    const result = computeNatGatewayZonePlacements(plan, zones);
    expect(result.byZone.size).toBe(1);
    const az = result.byZone.get(
      natZonePlacementsKey(
        "111111111111",
        "us-east-1",
        "vpc-1",
        "subnet-pub-a",
      ),
    )!;
    expect(az).toEqual([
      { natAddress: "aws_nat_gateway.solo", eipAddresses: [] },
    ]);
    expect([...result.consumedAddresses]).toEqual(["aws_nat_gateway.solo"]);
  });
});

describe("extractSupplementarySubnetZones", () => {
  it("emits a zone for aws_subnet ids not covered by primary zones", () => {
    const primaryZones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-aaa",
        subnetSignature: "subnet-a",
        subnetIds: ["subnet-a"],
        addresses: ["aws_lambda_function.x"],
      },
    ];
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.intra",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-b",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const sup = extractSupplementarySubnetZones(plan, primaryZones);
    expect(sup).toHaveLength(1);
    expect(sup[0]!.subnetIds).toEqual(["subnet-b"]);
    expect(sup[0]!.addresses).toEqual([]);
  });
});

describe("extractVpcFlowLogBundles", () => {
  it("merges same-module companions into the VPC flow log bucket", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "module.vpc.aws_flow_log.this",
          mode: "managed",
          type: "aws_flow_log",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              vpc_id: "vpc-aaa",
              region: "us-east-1",
            },
          },
        },
        {
          address: "module.vpc.aws_cloudwatch_log_group.flow",
          mode: "managed",
          type: "aws_cloudwatch_log_group",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: { region: "us-east-1" },
          },
        },
      ],
    };
    const buckets = extractVpcFlowLogBundles(plan);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.vpcId).toBe("vpc-aaa");
    expect(buckets[0]!.addresses).toContain("module.vpc.aws_flow_log.this");
    expect(buckets[0]!.addresses).toContain(
      "module.vpc.aws_cloudwatch_log_group.flow",
    );
  });
});

describe("extractInterfaceEndpointSecurityGroupBuckets", () => {
  it("maps endpoint security_group_ids to aws_security_group addresses", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_vpc_endpoint.int",
          mode: "managed",
          type: "aws_vpc_endpoint",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:vpc-endpoint/vpce-int",
              vpc_id: "vpc-aaa",
              region: "us-east-1",
              security_group_ids: ["sg-endpoint123"],
            },
          },
        },
        {
          address: "aws_security_group.endpoint",
          mode: "managed",
          type: "aws_security_group",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              vpc_id: "vpc-aaa",
              region: "us-east-1",
              id: "sg-endpoint123",
            },
          },
        },
      ],
    };
    const epBuckets = extractVpcEndpointsByVpc(plan);
    const sgBuckets = extractInterfaceEndpointSecurityGroupBuckets(
      plan,
      epBuckets,
    );
    expect(sgBuckets).toHaveLength(1);
    expect(sgBuckets[0]!.addresses).toEqual(["aws_security_group.endpoint"]);
  });
});

describe("extractPrimaryTopologyZones aws_lb subnets and SG inference", () => {
  it("collectPlacementSubnetIds includes aws_lb subnets and subnet_mapping subnet_id", () => {
    expect(
      collectPlacementSubnetIds({
        subnets: ["subnet-a", "subnet-b"],
      }),
    ).toEqual(["subnet-a", "subnet-b"]);
    expect(
      collectPlacementSubnetIds({
        subnet_mapping: [
          { subnet_id: "subnet-nlb-1" },
          { subnet_id: "subnet-nlb-2" },
        ],
      }),
    ).toEqual(["subnet-nlb-1", "subnet-nlb-2"]);
  });

  it("collectPlacementSubnetIds includes aws_ecs_service network_configuration subnets", () => {
    expect(
      collectPlacementSubnetIds({
        network_configuration: [
          {
            subnets: ["subnet-private-a", "subnet-private-b"],
            security_groups: ["sg-ecs"],
          },
        ],
      }),
    ).toEqual(["subnet-private-a", "subnet-private-b"]);
  });

  it("places aws_ecs_service in VPC zone from network_configuration subnets", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.private_a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-private-a",
              vpc_id: "vpc-east",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_ecs_service.producer",
          mode: "managed",
          type: "aws_ecs_service",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              name: "staging-producer",
              region: "us-east-1",
              network_configuration: [
                {
                  subnets: ["subnet-private-a"],
                  security_groups: ["sg-ecs"],
                },
              ],
            },
          },
        },
      ],
    };
    const zones = extractPrimaryTopologyZones(plan);
    const ecsZone = zones.find((z) =>
      z.addresses.includes("aws_ecs_service.producer"),
    );
    expect(ecsZone).toBeDefined();
    expect(ecsZone!.vpcId).toBe("vpc-east");
    expect(ecsZone!.subnetIds).toContain("subnet-private-a");
  });

  it("places aws_lb in subnet zone inferred from aws_instance sharing security_groups", () => {
    const subnetArn = "arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0work";
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.work",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: subnetArn,
              id: "subnet-0work",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_instance.web",
          mode: "managed",
          type: "aws_instance",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:instance/i-0abc",
              subnet_id: "subnet-0work",
              vpc_security_group_ids: ["sg-shared"],
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lb.app",
          mode: "managed",
          type: "aws_lb",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              arn: "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/app/app/abc",
              vpc_id: "vpc-1",
              security_groups: ["sg-shared"],
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const zones = extractPrimaryTopologyZones(plan);
    const lbZone = zones.find((z) => z.addresses.includes("aws_lb.app"));
    expect(lbZone).toBeDefined();
    expect(lbZone!.subnetIds).toContain("subnet-0work");
    expect(lbZone!.subnetSignature).toContain("subnet-0work");
    expect(lbZone!.vpcId).toBe("vpc-1");
  });

  it("uses explicit aws_lb subnets and does not replace with SG-inferred subnets", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0aaa",
              id: "subnet-0aaa",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_subnet.b",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0bbb",
              id: "subnet-0bbb",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_instance.web",
          mode: "managed",
          type: "aws_instance",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:instance/i-0abc",
              subnet_id: "subnet-0aaa",
              vpc_security_group_ids: ["sg-shared"],
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lb.app",
          mode: "managed",
          type: "aws_lb",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              arn: "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/app/app/abc",
              vpc_id: "vpc-1",
              subnets: ["subnet-0bbb"],
              security_groups: ["sg-shared"],
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const zones = extractPrimaryTopologyZones(plan);
    const lbZone = zones.find((z) => z.addresses.includes("aws_lb.app"));
    expect(lbZone).toBeDefined();
    expect(lbZone!.subnetIds).toEqual(["subnet-0bbb"]);
  });

  it("infers subnets from aws_lambda_function vpc_config sharing security_group_ids", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.lambda",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0lam",
              id: "subnet-0lam",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lambda_function.fn",
          mode: "managed",
          type: "aws_lambda_function",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:lambda:us-east-1:111111111111:function:fn",
              region: "us-east-1",
              vpc_config: [
                {
                  subnet_ids: ["subnet-0lam"],
                  security_group_ids: ["sg-lambda-lb"],
                },
              ],
            },
          },
        },
        {
          address: "aws_lb.internal",
          mode: "managed",
          type: "aws_lb",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              arn: "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/net/nlb/xyz",
              vpc_id: "vpc-1",
              security_groups: ["sg-lambda-lb"],
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const zones = extractPrimaryTopologyZones(plan);
    const lbZone = zones.find((z) => z.addresses.includes("aws_lb.internal"));
    expect(lbZone).toBeDefined();
    expect(lbZone!.subnetIds).toContain("subnet-0lam");
  });

  it("places aws_lambda_permission in the same zone as the target Lambda", () => {
    const lambdaArn = "arn:aws:lambda:us-east-1:111111111111:function:myfn";
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.lambda",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0lam",
              id: "subnet-0lam",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "module.api.aws_lambda_function.fn",
          mode: "managed",
          type: "aws_lambda_function",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: lambdaArn,
              function_name: "myfn",
              region: "us-east-1",
              vpc_config: [
                {
                  subnet_ids: ["subnet-0lam"],
                  security_group_ids: ["sg-lambda"],
                },
              ],
            },
          },
        },
        {
          address: "module.api.aws_lambda_permission.invoke",
          mode: "managed",
          type: "aws_lambda_permission",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              function_name: lambdaArn,
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const zones = extractPrimaryTopologyZones(plan);
    expect(zones).toHaveLength(1);
    const z = zones[0]!;
    expect(z.addresses).toContain("module.api.aws_lambda_function.fn");
    expect(z.addresses).toContain("module.api.aws_lambda_permission.invoke");
  });

  it("places LB security_groups and matching rules in the same zone as aws_lb", () => {
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.public",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              arn: "arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0pub",
              id: "subnet-0pub",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_security_group.lb",
          mode: "managed",
          type: "aws_security_group",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              id: "sg-lb01",
              vpc_id: "vpc-1",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_security_group_rule.https",
          mode: "managed",
          type: "aws_security_group_rule",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              security_group_id: "sg-lb01",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lb.main",
          mode: "managed",
          type: "aws_lb",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              arn: "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/app/x/abc",
              vpc_id: "vpc-1",
              subnets: ["subnet-0pub"],
              security_groups: ["sg-lb01"],
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const zones = extractPrimaryTopologyZones(plan);
    const lbZone = zones.find((z) => z.addresses.includes("aws_lb.main"));
    expect(lbZone).toBeDefined();
    expect(lbZone!.addresses).toContain("aws_security_group.lb");
    expect(lbZone!.addresses).toContain("aws_security_group_rule.https");
  });

  it("places ALB listener and target group in the same zone as aws_lb (staging-like)", () => {
    const lbArn =
      "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/app/ecs/abc";
    const tgArn =
      "arn:aws:elasticloadbalancing:us-east-1:111111111111:targetgroup/ecs/xyz";
    const plan = {
      ...planWithDefaultAwsAccountRegion,
      resource_changes: [
        {
          address: "aws_subnet.public_a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-public-a",
              vpc_id: "vpc-east",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_subnet.private_a",
          mode: "managed",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-private-a",
              vpc_id: "vpc-east",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lb.ecs",
          mode: "managed",
          type: "aws_lb",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              arn: lbArn,
              vpc_id: "vpc-east",
              subnets: ["subnet-public-a"],
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lb_listener.http",
          mode: "managed",
          type: "aws_lb_listener",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              load_balancer_arn: lbArn,
              port: 80,
              protocol: "HTTP",
              default_action: {
                type: "forward",
                target_group_arn: tgArn,
              },
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lb_target_group.ecs",
          mode: "managed",
          type: "aws_lb_target_group",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              arn: tgArn,
              port: 8080,
              vpc_id: "vpc-east",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_ecs_service.producer",
          mode: "managed",
          type: "aws_ecs_service",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["create"],
            after: {
              name: "staging-producer",
              network_configuration: [
                {
                  subnets: ["subnet-private-a"],
                  security_groups: ["sg-ecs"],
                },
              ],
              region: "us-east-1",
            },
          },
        },
      ],
    };
    const zones = extractPrimaryTopologyZones(plan);
    const lbZone = zones.find((z) => z.addresses.includes("aws_lb.ecs"));
    expect(lbZone).toBeDefined();
    expect(lbZone!.subnetIds).toContain("subnet-public-a");
    expect(lbZone!.addresses).toContain("aws_lb_listener.http");
    expect(lbZone!.addresses).toContain("aws_lb_target_group.ecs");

    const ecsZone = zones.find((z) =>
      z.addresses.includes("aws_ecs_service.producer"),
    );
    expect(ecsZone).toBeDefined();
    expect(ecsZone!.subnetIds).toContain("subnet-private-a");
    expect(ecsZone!.addresses).not.toContain("aws_lb_listener.http");
    expect(ecsZone!.addresses).not.toContain("aws_lb_target_group.ecs");
  });
});
