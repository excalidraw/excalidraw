import { describe, expect, it } from "vitest";

import {
  computeRouteTableBottomEdgePlacements,
  computeVpcRouteTableFanOutAddressesForVpc,
  extractInterfaceEndpointSecurityGroupBuckets,
  extractRouteTablesByVpc,
  extractSupplementarySubnetZones,
  extractVpcDefaultPlumbingBuckets,
  extractVpcEndpointsByVpc,
  extractVpcFlowLogBundles,
  mergeSupplementarySubnetZonesSharedRouteTable,
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
        addresses: ["aws_subnet.a"],
        topologyZoneSource: "supplementary",
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-1",
        subnetSignature: "subnet-b",
        subnetIds: ["subnet-b"],
        addresses: ["aws_subnet.b"],
        topologyZoneSource: "supplementary",
      },
    ];
    const merged = mergeSupplementarySubnetZonesSharedRouteTable(
      zones,
      plan as never,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.subnetSignature).toBe("subnet-a|subnet-b");
    expect(merged[0]!.mergedSupplementaryComposite).toBe(true);
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
    expect(sup[0]!.addresses).toEqual(["aws_subnet.intra"]);
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
