import { describe, expect, it } from "vitest";

import { extractVpcEndpointsByVpc } from "./terraformTopologyPlacement";

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
