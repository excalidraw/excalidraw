import { describe, expect, it } from "vitest";

import {
  buildSyntheticPlanFromTfstate,
  inferProviderVariablesFromState,
  isSyntheticPlanEmptyForSemantic,
} from "./terraformStateToPlan";

describe("buildSyntheticPlanFromTfstate", () => {
  it("maps state instances to resource_changes with change.after", () => {
    const plan = buildSyntheticPlanFromTfstate({
      resources: [
        {
          mode: "managed",
          type: "aws_s3_bucket",
          name: "logs",
          provider: 'provider["registry.terraform.io/hashicorp/aws"]',
          instances: [
            {
              attributes: { bucket: "my-bucket", region: "us-east-1" },
            },
          ],
        },
      ],
    });

    expect(plan.resource_changes).toHaveLength(1);
    expect(plan.resource_changes[0].address).toBe("aws_s3_bucket.logs");
    expect(plan.resource_changes[0].change.actions).toEqual(["read"]);
    expect(plan.resource_changes[0].change.after).toEqual({
      bucket: "my-bucket",
      region: "us-east-1",
    });
  });

  it("includes index keys in addresses", () => {
    const plan = buildSyntheticPlanFromTfstate({
      resources: [
        {
          mode: "managed",
          type: "aws_subnet",
          name: "private",
          instances: [
            { index_key: 0, attributes: { id: "subnet-a" } },
            { index_key: 1, attributes: { id: "subnet-b" } },
          ],
        },
      ],
    });

    expect(plan.resource_changes.map((rc) => rc.address)).toEqual([
      "aws_subnet.private[0]",
      "aws_subnet.private[1]",
    ]);
  });

  it("skips non-allowlisted data sources except iam policy document", () => {
    const plan = buildSyntheticPlanFromTfstate({
      resources: [
        {
          mode: "data",
          type: "aws_region",
          name: "current",
          instances: [{ attributes: { id: "us-east-1" } }],
        },
        {
          mode: "data",
          type: "aws_iam_policy_document",
          name: "lambda_assume",
          instances: [{ attributes: { statement: [{ Effect: "Allow" }] } }],
        },
      ],
    });

    expect(plan.resource_changes).toHaveLength(1);
    expect(plan.resource_changes[0].type).toBe("aws_iam_policy_document");
  });
});

describe("inferProviderVariablesFromState", () => {
  it("extracts aws_account_id and aws_region from data sources", () => {
    const variables = inferProviderVariablesFromState({
      resources: [
        {
          mode: "data",
          type: "aws_caller_identity",
          name: "current",
          instances: [{ attributes: { account_id: "123456789012" } }],
        },
        {
          mode: "data",
          type: "aws_region",
          name: "current",
          instances: [{ attributes: { name: "eu-west-1" } }],
        },
      ],
    });

    expect(variables?.aws_account_id?.value).toBe("123456789012");
    expect(variables?.aws_region?.value).toBe("eu-west-1");
  });
});

describe("isSyntheticPlanEmptyForSemantic", () => {
  it("returns true when only non-aws or data-only resources", () => {
    expect(
      isSyntheticPlanEmptyForSemantic({
        resource_changes: [
          { mode: "managed", type: "random_id", name: "x" },
          { mode: "data", type: "aws_region", name: "current" },
        ],
      }),
    ).toBe(true);
  });

  it("returns false when managed aws resources exist", () => {
    expect(
      isSyntheticPlanEmptyForSemantic({
        resource_changes: [{ mode: "managed", type: "aws_vpc", name: "main" }],
      }),
    ).toBe(false);
  });
});
