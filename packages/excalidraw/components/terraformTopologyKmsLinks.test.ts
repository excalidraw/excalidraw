import { describe, expect, it } from "vitest";

import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import {
  buildKmsKeyPolicyCluster,
  collectKmsKeyPoliciesForKey,
  kmsPolicySatelliteStackHeightPx,
  resolveKmsKeyIdToNodePath,
} from "./terraformTopologyKmsLinks";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("resolveKmsKeyIdToNodePath", () => {
  it("resolves raw KMS key id to the key resource path", () => {
    const keyId = "12345678-1234-1234-1234-123456789012";
    const nodes: TerraformPlanNodesMap = {
      "aws_kms_key.main": {
        resources: {
          "aws_kms_key.main": {
            address: "aws_kms_key.main",
            type: "aws_kms_key",
            mode: "managed",
            change: {
              after: {
                id: keyId,
                arn: `arn:aws:kms:us-east-1:111111111111:key/${keyId}`,
              },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(resolveKmsKeyIdToNodePath(nodes, keyId, arnIndex)).toBe("aws_kms_key.main");
  });

  it("resolves full key ARN via arn index", () => {
    const arn = "arn:aws:kms:us-east-1:111111111111:key/abc-def-000";
    const nodes: TerraformPlanNodesMap = {
      "aws_kms_key.main": {
        resources: {
          "aws_kms_key.main": {
            address: "aws_kms_key.main",
            type: "aws_kms_key",
            mode: "managed",
            change: { after: { id: "abc-def-000", arn } },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(resolveKmsKeyIdToNodePath(nodes, arn, arnIndex)).toBe("aws_kms_key.main");
  });
});

describe("collectKmsKeyPoliciesForKey / buildKmsKeyPolicyCluster", () => {
  it("links aws_kms_key_policy to parent key by key_id", () => {
    const keyId = "12345678-1234-1234-1234-123456789012";
    const nodes: TerraformPlanNodesMap = {
      "aws_kms_key.main": {
        resources: {
          "aws_kms_key.main": {
            address: "aws_kms_key.main",
            type: "aws_kms_key",
            mode: "managed",
            change: {
              after: {
                id: keyId,
                arn: `arn:aws:kms:us-east-1:111111111111:key/${keyId}`,
              },
            },
          },
        },
      },
      "aws_kms_key_policy.main": {
        resources: {
          "aws_kms_key_policy.main": {
            address: "aws_kms_key_policy.main",
            type: "aws_kms_key_policy",
            mode: "managed",
            change: {
              after: { key_id: keyId, policy: "{}" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(collectKmsKeyPoliciesForKey(nodes, "aws_kms_key.main", arnIndex)).toEqual([
      "aws_kms_key_policy.main",
    ]);

    const { cluster, edges } = buildKmsKeyPolicyCluster(nodes, "aws_kms_key.main", arnIndex);
    expect(cluster).toEqual({
      kms: "aws_kms_key.main",
      policies: ["aws_kms_key_policy.main"],
    });
    expect(edges).toEqual([
      {
        source: "aws_kms_key.main",
        target: "aws_kms_key_policy.main",
        type: "kms_key_policy",
        label: "policy",
      },
    ]);
  });

  it("returns null cluster for non-KMS addresses", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_s3_bucket.x": {
        resources: {
          "aws_s3_bucket.x": {
            address: "aws_s3_bucket.x",
            type: "aws_s3_bucket",
            mode: "managed",
            change: { after: { bucket: "b" } },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(buildKmsKeyPolicyCluster(nodes, "aws_s3_bucket.x", arnIndex).cluster).toBeNull();
  });
});

describe("kmsPolicySatelliteStackHeightPx", () => {
  it("returns 0 without policies", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_kms_key.main": {
        resources: {
          "aws_kms_key.main": {
            address: "aws_kms_key.main",
            type: "aws_kms_key",
            mode: "managed",
            change: { after: { id: "k1", arn: "arn:aws:kms:us-east-1:1:key/k1" } },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(
      kmsPolicySatelliteStackHeightPx(nodes, "aws_kms_key.main", arnIndex, 52, 8),
    ).toBe(0);
  });

  it("counts one tile height per policy plus gaps", () => {
    const keyId = "12345678-1234-1234-1234-123456789012";
    const nodes: TerraformPlanNodesMap = {
      "aws_kms_key.main": {
        resources: {
          "aws_kms_key.main": {
            address: "aws_kms_key.main",
            type: "aws_kms_key",
            mode: "managed",
            change: {
              after: {
                id: keyId,
                arn: `arn:aws:kms:us-east-1:111111111111:key/${keyId}`,
              },
            },
          },
        },
      },
      "aws_kms_key_policy.main": {
        resources: {
          "aws_kms_key_policy.main": {
            address: "aws_kms_key_policy.main",
            type: "aws_kms_key_policy",
            mode: "managed",
            change: { after: { key_id: keyId } },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(
      kmsPolicySatelliteStackHeightPx(nodes, "aws_kms_key.main", arnIndex, 52, 8),
    ).toBe(8 + 52 + 8);
  });
});
