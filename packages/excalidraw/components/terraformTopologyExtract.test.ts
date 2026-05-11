import { describe, expect, it } from "vitest";

import {
  extractTerraformTopologyFromPlan,
  parseAwsArnLocation,
  pickResourceChangeValues,
  TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT,
} from "./terraformTopologyExtract";

describe("parseAwsArnLocation", () => {
  it("parses regional ARN", () => {
    expect(
      parseAwsArnLocation(
        "arn:aws:ec2:us-east-1:992382747916:subnet/subnet-0a342e3606f8ce4e8",
      ),
    ).toEqual({ region: "us-east-1", account: "992382747916" });
  });
});

describe("pickResourceChangeValues", () => {
  it("prefers after over before", () => {
    const rc = {
      change: {
        before: { id: "old" },
        after: { id: "subnet-1", vpc_id: "vpc-1" },
      },
    };
    expect(pickResourceChangeValues(rc)).toEqual({
      id: "subnet-1",
      vpc_id: "vpc-1",
    });
  });
});

describe("extractTerraformTopologyFromPlan", () => {
  it("indexes aws_subnet id to vpc_id", () => {
    const plan = {
      resource_changes: [
        {
          type: "aws_subnet",
          mode: "managed",
          provider_name: "registry.opentofu.org/hashicorp/aws",
          change: {
            actions: ["no-op"],
            after: {
              id: "subnet-aaa",
              vpc_id: "vpc-bbb",
              arn: "arn:aws:ec2:us-west-2:111111111111:subnet/subnet-aaa",
              region: "us-west-2",
            },
          },
        },
      ],
    };
    const model = extractTerraformTopologyFromPlan(plan);
    expect(model.sawAwsResourceChanges).toBe(true);
    const acc = model.accounts.get("111111111111");
    expect(acc).toBeDefined();
    const reg = acc!.regions.get("us-west-2");
    expect(reg).toBeDefined();
    const vpc = reg!.vpcs.get("vpc-bbb");
    expect(vpc).toBeDefined();
    expect(vpc!.subnets.has("subnet-aaa")).toBe(true);
  });

  it("maps lambda vpc_config subnet_ids through subnet index", () => {
    const plan = {
      resource_changes: [
        {
          type: "aws_subnet",
          mode: "managed",
          provider_name: "hashicorp/aws",
          change: {
            after: {
              id: "subnet-s1",
              vpc_id: "vpc-v1",
              arn: "arn:aws:ec2:eu-west-1:222222222222:subnet/subnet-s1",
              region: "eu-west-1",
            },
          },
        },
        {
          type: "aws_lambda_function",
          mode: "managed",
          provider_name: "hashicorp/aws",
          change: {
            after: {
              arn: "arn:aws:lambda:eu-west-1:222222222222:function:fn",
              region: "eu-west-1",
              vpc_config: [
                {
                  subnet_ids: ["subnet-s1"],
                  security_group_ids: [],
                },
              ],
            },
          },
        },
      ],
    };
    const model = extractTerraformTopologyFromPlan(plan);
    const vpc = model.accounts.get("222222222222")?.regions.get("eu-west-1")
      ?.vpcs.get("vpc-v1");
    expect(vpc?.subnets.has("subnet-s1")).toBe(true);
  });

  it("omits topology when account cannot be resolved from subnet row", () => {
    const plan = {
      resource_changes: [
        {
          type: "aws_subnet",
          mode: "managed",
          change: {
            after: {
              id: "subnet-x",
              vpc_id: "vpc-y",
              region: "ap-south-1",
            },
          },
        },
      ],
    };
    const model = extractTerraformTopologyFromPlan(plan);
    expect(model.accounts.has(TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT)).toBe(false);
    expect(model.accounts.size).toBe(0);
  });

  it("inherits account from aws_subnet when resource has no parseable ARN but subnet_ids", () => {
    const plan = {
      resource_changes: [
        {
          type: "aws_subnet",
          mode: "managed",
          change: {
            after: {
              id: "subnet-inherit",
              vpc_id: "vpc-same",
              arn: "arn:aws:ec2:eu-west-1:333333333333:subnet/subnet-inherit",
              region: "eu-west-1",
            },
          },
        },
        {
          type: "aws_network_acl_association",
          mode: "managed",
          change: {
            after: {
              subnet_id: "subnet-inherit",
              network_acl_id: "acl-1",
              region: "eu-west-1",
            },
          },
        },
      ],
    };
    const model = extractTerraformTopologyFromPlan(plan);
    expect(model.accounts.has(TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT)).toBe(false);
    expect(model.accounts.get("333333333333")?.regions.get("eu-west-1")?.vpcs.get("vpc-same")).toBeDefined();
  });

  it("does not emit placeholder topology when plan has AWS but no VPC/subnet signals", () => {
    const plan = {
      resource_changes: [
        {
          type: "aws_s3_bucket",
          mode: "managed",
          provider_name: "hashicorp/aws",
          change: {
            after: { bucket: "b", region: "us-east-1" },
          },
        },
      ],
    };
    const model = extractTerraformTopologyFromPlan(plan);
    expect(model.accounts.size).toBe(0);
    expect(model.accounts.get(TERRAFORM_TOPOLOGY_UNKNOWN_ACCOUNT)).toBeUndefined();
  });
});
