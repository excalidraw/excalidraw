import { describe, expect, it } from "vitest";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import { buildS3CompanionCluster } from "./terraformTopologyS3Links";

describe("terraformTopologyS3Links", () => {
  it("buildS3CompanionCluster collects bucket policy and edges from bucket", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_s3_bucket.app": {
        resources: {
          "aws_s3_bucket.app": {
            address: "aws_s3_bucket.app",
            mode: "managed",
            type: "aws_s3_bucket",
            change: {
              actions: ["no-op"],
              after: { bucket: "my-bucket" },
            },
          },
        },
      },
      "aws_s3_bucket_policy.app": {
        resources: {
          "aws_s3_bucket_policy.app": {
            address: "aws_s3_bucket_policy.app",
            mode: "managed",
            type: "aws_s3_bucket_policy",
            change: {
              actions: ["create"],
              after: {
                bucket: "aws_s3_bucket.app",
                policy: "{}",
              },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster, edges } = buildS3CompanionCluster(
      nodes,
      "aws_s3_bucket.app",
      arnIndex,
    );
    expect(cluster).not.toBeNull();
    expect(cluster!.stack).toContain("aws_s3_bucket_policy.app");
    expect(
      edges.some(
        (e) =>
          e.source === "aws_s3_bucket.app" &&
          e.target === "aws_s3_bucket_policy.app",
      ),
    ).toBe(true);
  });
});
