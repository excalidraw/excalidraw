import { describe, expect, it } from "vitest";

import {
  buildArnIndexForTopology,
  buildLambdaIamCluster,
  collectPoliciesForIamRole,
  mergeTerraformPlanResourceValues,
  resolveLambdaExecutionRolePath,
} from "./terraformTopologyIamLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformTopologyIamLinks", () => {
  it("matches aws_iam_role_policy.role to IAM role by AWS name, not Terraform block name", () => {
    const nodes: TerraformPlanNodesMap = {
      "module.m.module.lambda.aws_iam_role.lambda[0]": {
        resources: {
          "module.m.module.lambda.aws_iam_role.lambda[0]": {
            address: "module.m.module.lambda.aws_iam_role.lambda[0]",
            mode: "managed",
            type: "aws_iam_role",
            name: "lambda",
            change: {
              actions: ["create"],
              after: { name: "test-reader" },
            },
          },
        },
      },
      "module.m.module.lambda.aws_iam_role_policy.logs[0]": {
        resources: {
          "module.m.module.lambda.aws_iam_role_policy.logs[0]": {
            address: "module.m.module.lambda.aws_iam_role_policy.logs[0]",
            mode: "managed",
            type: "aws_iam_role_policy",
            name: "logs",
            change: {
              actions: ["create"],
              after: { name: "test-reader-logs", role: "test-reader" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const policies = collectPoliciesForIamRole(
      nodes,
      "module.m.module.lambda.aws_iam_role.lambda[0]",
      arnIndex,
    );
    expect(policies).toEqual([
      "module.m.module.lambda.aws_iam_role_policy.logs[0]",
    ]);
  });

  it("mergeTerraformPlanResourceValues prefers before on delete", () => {
    const resource = {
      type: "aws_lambda_function",
      change: {
        actions: ["delete"],
        before: { role: "arn:aws:iam::111111111111:role/lambda-role" },
        after: {},
      },
    };
    const v = mergeTerraformPlanResourceValues(resource);
    expect(v.role).toBe("arn:aws:iam::111111111111:role/lambda-role");
  });

  it("resolves Lambda execution role from ARN and builds cluster with policies", () => {
    const roleArn = "arn:aws:iam::111111111111:role/lambda-role";
    const policyArn = "arn:aws:iam::111111111111:policy/managed-p";

    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["update"],
              after: { role: roleArn },
            },
          },
        },
      },
      "aws_iam_role.lambda_role": {
        resources: {
          "aws_iam_role.lambda_role": {
            address: "aws_iam_role.lambda_role",
            mode: "managed",
            type: "aws_iam_role",
            name: "lambda_role",
            change: {
              actions: ["no-op"],
              after: { arn: roleArn, name: "lambda_role" },
            },
          },
        },
      },
      "aws_iam_role_policy.inline_logs": {
        resources: {
          "aws_iam_role_policy.inline_logs": {
            address: "aws_iam_role_policy.inline_logs",
            mode: "managed",
            type: "aws_iam_role_policy",
            change: {
              actions: ["no-op"],
              after: { role: "lambda_role", name: "inline_logs" },
            },
          },
        },
      },
      "aws_iam_policy.managed": {
        resources: {
          "aws_iam_policy.managed": {
            address: "aws_iam_policy.managed",
            mode: "managed",
            type: "aws_iam_policy",
            change: {
              actions: ["no-op"],
              after: { arn: policyArn, name: "managed" },
            },
          },
        },
      },
      "aws_iam_role_policy_attachment.attach": {
        resources: {
          "aws_iam_role_policy_attachment.attach": {
            address: "aws_iam_role_policy_attachment.attach",
            mode: "managed",
            type: "aws_iam_role_policy_attachment",
            change: {
              actions: ["no-op"],
              after: {
                role: "lambda_role",
                policy_arn: policyArn,
              },
            },
          },
        },
      },
    };

    const arnIndex = buildArnIndexForTopology(nodes);
    expect(arnIndex.get(roleArn)).toBe("aws_iam_role.lambda_role");
    expect(arnIndex.get(policyArn)).toBe("aws_iam_policy.managed");

    const rolePath = resolveLambdaExecutionRolePath(
      nodes,
      "aws_lambda_function.fn",
      roleArn,
      arnIndex,
    );
    expect(rolePath).toBe("aws_iam_role.lambda_role");

    const policies = collectPoliciesForIamRole(
      nodes,
      "aws_iam_role.lambda_role",
      arnIndex,
    );
    expect(policies).toContain("aws_iam_role_policy.inline_logs");
    expect(policies).toContain("aws_iam_policy.managed");

    const { cluster, edges } = buildLambdaIamCluster(
      nodes,
      "aws_lambda_function.fn",
      arnIndex,
    );
    expect(cluster?.stack).toEqual([
      "aws_iam_role.lambda_role",
      "aws_iam_policy.managed",
      "aws_iam_role_policy.inline_logs",
    ]);
    expect(edges.some((e) => e.type === "execution_role")).toBe(true);
    expect(edges.filter((e) => e.type === "iam_policy").length).toBe(2);
  });
});
