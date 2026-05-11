import { describe, expect, it } from "vitest";

import {
  collectPlacementSubnetIds,
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
} from "./terraformTopologyPlacement";

describe("collectPlacementSubnetIds", () => {
  it("merges vpc_config subnet_ids with top-level fields and sorts uniquely", () => {
    const values = {
      vpc_config: [
        {
          subnet_ids: ["subnet-z", "subnet-a"],
        },
      ],
      subnet_ids: ["subnet-a"],
      subnet_id: "subnet-m",
    };
    expect(collectPlacementSubnetIds(values)).toEqual([
      "subnet-a",
      "subnet-m",
      "subnet-z",
    ]);
  });
});

describe("extractPrimaryTopologyZones", () => {
  it("groups one Lambda with two vpc_config subnets into a single zone", () => {
    const plan = {
      resource_changes: [
        {
          address: "aws_subnet.one",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            after: {
              id: "subnet-a",
              vpc_id: "vpc-shared",
              owner_id: "111111111111",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_subnet.two",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            after: {
              id: "subnet-b",
              vpc_id: "vpc-shared",
              owner_id: "111111111111",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lambda_function.shared",
          type: "aws_lambda_function",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            after: {
              region: "us-east-1",
              vpc_config: [
                {
                  subnet_ids: ["subnet-b", "subnet-a"],
                },
              ],
            },
          },
        },
      ],
    };

    const zones = extractPrimaryTopologyZones(plan);
    expect(zones).toHaveLength(1);
    const z = zones[0]!;
    expect(z.accountId).toBe("111111111111");
    expect(z.region).toBe("us-east-1");
    expect(z.vpcId).toBe("vpc-shared");
    expect(z.subnetIds).toEqual(["subnet-a", "subnet-b"]);
    expect(z.subnetSignature).toBe("subnet-a|subnet-b");
    expect(z.addresses).toEqual(["aws_lambda_function.shared"]);
  });

  it("uses before-state vpc_config for a deleted Lambda", () => {
    const plan = {
      resource_changes: [
        {
          address: "aws_subnet.one",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            after: {
              id: "subnet-a",
              vpc_id: "vpc-shared",
              owner_id: "111111111111",
              region: "us-east-1",
            },
          },
        },
        {
          address: "aws_lambda_function.old",
          type: "aws_lambda_function",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["delete"],
            before: {
              region: "us-east-1",
              arn: "arn:aws:lambda:us-east-1:111111111111:function:old",
              vpc_config: [
                {
                  subnet_ids: ["subnet-a"],
                },
              ],
            },
            after: null,
          },
        },
      ],
    };

    const zones = extractPrimaryTopologyZones(plan);
    expect(zones).toHaveLength(1);
    expect(zones[0]!.addresses).toEqual(["aws_lambda_function.old"]);
  });

  it("falls back to before when after is an empty object", () => {
    const plan = {
      resource_changes: [
        {
          address: "aws_subnet.one",
          type: "aws_subnet",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            after: {
              id: "subnet-x",
              vpc_id: "vpc-z",
              owner_id: "222222222222",
              region: "eu-west-1",
            },
          },
        },
        {
          address: "aws_lambda_function.x",
          type: "aws_lambda_function",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            actions: ["update"],
            before: {
              region: "eu-west-1",
              owner_id: "222222222222",
              vpc_config: [{ subnet_ids: ["subnet-x"] }],
            },
            after: {},
          },
        },
      ],
    };

    const zones = extractPrimaryTopologyZones(plan);
    expect(zones).toHaveLength(1);
    expect(zones[0]!.vpcId).toBe("vpc-z");
  });
});

describe("extractRegionalTopologyPrimaries", () => {
  it("infers account from aws_subnet owner_id when SQS create has region but no ARN yet", () => {
    const plan = {
      resource_changes: [
        {
          address: "module.vpc.aws_subnet.private",
          type: "aws_subnet",
          provider_name: "registry.opentofu.org/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-aaa",
              vpc_id: "vpc-xx",
              owner_id: "992382747916",
              region: "us-east-1",
              arn: "arn:aws:ec2:us-east-1:992382747916:subnet/subnet-aaa",
            },
          },
        },
        {
          address: "module.queue.aws_sqs_queue.this[0]",
          type: "aws_sqs_queue",
          provider_name: "registry.opentofu.org/hashicorp/aws",
          change: {
            actions: ["create"],
            before: null,
            after: {
              name: "jobs",
              region: "us-east-1",
            },
          },
        },
      ],
    };

    const buckets = extractRegionalTopologyPrimaries(plan);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.accountId).toBe("992382747916");
    expect(buckets[0]!.region).toBe("us-east-1");
    expect(buckets[0]!.addresses).toEqual(["module.queue.aws_sqs_queue.this[0]"]);
  });

  it("groups S3 and SQS without VPC into one bucket per account and region", () => {
    const plan = {
      resource_changes: [
        {
          address: "aws_s3_bucket.logs",
          type: "aws_s3_bucket",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            after: {
              region: "us-east-1",
              owner_id: "111111111111",
            },
          },
        },
        {
          address: "aws_sqs_queue.jobs",
          type: "aws_sqs_queue",
          provider_name: "registry.terraform.io/hashicorp/aws",
          change: {
            after: {
              region: "us-east-1",
              name: "jobs.fifo",
              arn: "arn:aws:sqs:us-east-1:111111111111:jobs.fifo",
            },
          },
        },
      ],
    };

    const buckets = extractRegionalTopologyPrimaries(plan);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.accountId).toBe("111111111111");
    expect(buckets[0]!.region).toBe("us-east-1");
    expect([...buckets[0]!.addresses].sort()).toEqual(
      ["aws_s3_bucket.logs", "aws_sqs_queue.jobs"].sort(),
    );
  });
});
