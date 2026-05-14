import { describe, expect, it } from "vitest";

import {
  buildDataFlowEdges,
  buildDataFlowIndex,
  buildNetworkingEdges,
  resolveNodeRefsAcrossAllResourceTypes,
} from "./terraformDataFlowEdges";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe("terraformDataFlowEdges", () => {
  it("buildDataFlowIndex registers security group ids for peer resolution", () => {
    const sg = "aws_security_group.app";
    const id = "sg-0a1b2c3d4e5f67890";
    const nodes = {
      [sg]: {
        resources: {
          [sg]: {
            address: sg,
            type: "aws_security_group",
            change: { after: { id } },
          },
        },
      },
    };
    const index = buildDataFlowIndex(nodes);
    expect(index.bySecurityGroupId.get(id)?.has(sg)).toBe(true);
  });

  it("resolveNodeRefsAcrossAllResourceTypes narrows data_bucket keys to S3 buckets", () => {
    const bucketPath = "aws_s3_bucket.data";
    const nodes = {
      [bucketPath]: {
        resources: {
          [bucketPath]: {
            address: bucketPath,
            type: "aws_s3_bucket",
            change: { after: { bucket: "my-data-bucket" } },
          },
        },
      },
    };
    const index = buildDataFlowIndex(nodes);
    const matches = resolveNodeRefsAcrossAllResourceTypes(
      { DATA_BUCKET: "my-data-bucket" },
      index,
      nodes,
    );
    expect(matches).toEqual([bucketPath]);
  });

  it("buildNetworkingEdges links security groups via rule peer SG ids", () => {
    const sgA = "aws_security_group.a";
    const sgB = "aws_security_group.b";
    const idA = "sg-11111111111111111";
    const idB = "sg-22222222222222222";
    const nodes = {
      [sgA]: {
        resources: {
          [sgA]: {
            address: sgA,
            type: "aws_security_group",
            change: {
              after: {
                id: idA,
                ingress: [{ source_security_group_id: idB }],
              },
            },
          },
        },
      },
      [sgB]: {
        resources: {
          [sgB]: {
            address: sgB,
            type: "aws_security_group",
            change: { after: { id: idB } },
          },
        },
      },
    };
    buildNetworkingEdges(nodes);
    const edges = (nodes as Record<string, any>)[sgA].edges_networking || [];
    expect(edges.some((e: { target: string }) => e.target === sgB)).toBe(true);
  });

  it("buildDataFlowEdges adds IAM policy data-flow edges from compute to S3", () => {
    const role = "aws_iam_role.exec";
    const lambda = "aws_lambda_function.fn";
    const bucket = "aws_s3_bucket.data";
    const policy = "aws_iam_role_policy.inline";
    const base = {
      [role]: {
        resources: {
          [role]: {
            address: role,
            type: "aws_iam_role",
            name: "exec",
            change: {
              actions: ["create"],
              after: { arn: "arn:aws:iam::111111111111:role/exec" },
            },
          },
        },
      },
      [lambda]: {
        resources: {
          [lambda]: {
            address: lambda,
            type: "aws_lambda_function",
            name: "fn",
            change: {
              actions: ["create"],
              after: { role },
            },
          },
        },
      },
      [bucket]: {
        resources: {
          [bucket]: {
            address: bucket,
            type: "aws_s3_bucket",
            name: "data",
            change: {
              actions: ["create"],
              after: {
                bucket: "tf-dataflow-bucket",
                arn: "arn:aws:s3:::tf-dataflow-bucket",
              },
            },
          },
        },
      },
      [policy]: {
        resources: {
          [policy]: {
            address: policy,
            type: "aws_iam_role_policy",
            name: "inline",
            change: {
              actions: ["create"],
              after: {
                role,
                policy: JSON.stringify({
                  Version: "2012-10-17",
                  Statement: [
                    {
                      Effect: "Allow",
                      Action: ["s3:GetObject"],
                      Resource: "arn:aws:s3:::tf-dataflow-bucket/*",
                    },
                  ],
                }),
              },
            },
          },
        },
      },
    };
    const nodes = clone(base);
    buildDataFlowEdges(nodes);
    const edges = (nodes as Record<string, any>)[bucket].edges_data_flow || [];
    expect(
      edges.some(
        (e: { target: string; type: string }) =>
          e.target === lambda && e.type === "reads",
      ),
    ).toBe(true);
  });

  it("resolveNodeRefsAcrossAllResourceTypes ignores keys listed in ignoredKeys", () => {
    const nodes = {
      "aws_s3_bucket.x": {
        resources: {
          "aws_s3_bucket.x": {
            address: "aws_s3_bucket.x",
            type: "aws_s3_bucket",
            change: { after: { bucket: "b1" } },
          },
        },
      },
    };
    const index = buildDataFlowIndex(nodes);
    const byBucketKey = resolveNodeRefsAcrossAllResourceTypes(
      { bucket: "b1" },
      index,
      nodes,
    );
    expect(byBucketKey).toContain("aws_s3_bucket.x");
    const ignored = resolveNodeRefsAcrossAllResourceTypes(
      { bucket: "b1" },
      index,
      nodes,
      { ignoredKeys: ["bucket"] },
    );
    expect(ignored).toEqual([]);
  });
});
