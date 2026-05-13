import { describe, expect, it } from "vitest";

import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import {
  buildLambdaPermissionCluster,
  resolveLambdaPermissionTargetLambdaAddress,
  resolveLambdaPermissionTargetLambdaAddressFromPlan,
} from "./terraformTopologyLambdaPermissionLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

const lambdaArn = "arn:aws:lambda:us-east-1:111111111111:function:myfn";

function nodesWithLambdaAndPermission(
  functionNameField: unknown,
): TerraformPlanNodesMap {
  return {
    "module.x.aws_lambda_function.fn": {
      resources: {
        "module.x.aws_lambda_function.fn": {
          address: "module.x.aws_lambda_function.fn",
          mode: "managed",
          type: "aws_lambda_function",
          change: {
            actions: ["no-op"],
            after: {
              arn: lambdaArn,
              function_name: "myfn",
            },
          },
        },
      },
    },
    "module.x.aws_lambda_permission.p": {
      resources: {
        "module.x.aws_lambda_permission.p": {
          address: "module.x.aws_lambda_permission.p",
          mode: "managed",
          type: "aws_lambda_permission",
          change: {
            actions: ["create"],
            after: {
              function_name: functionNameField,
            },
          },
        },
      },
    },
  };
}

describe("terraformTopologyLambdaPermissionLinks", () => {
  it("resolveLambdaPermissionTargetLambdaAddress resolves ARN", () => {
    const nodes = nodesWithLambdaAndPermission(lambdaArn);
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(
      resolveLambdaPermissionTargetLambdaAddress(
        nodes,
        "module.x.aws_lambda_permission.p",
        arnIndex,
      ),
    ).toBe("module.x.aws_lambda_function.fn");
  });

  it("resolveLambdaPermissionTargetLambdaAddress resolves bare function_name in same module", () => {
    const nodes = nodesWithLambdaAndPermission("myfn");
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(
      resolveLambdaPermissionTargetLambdaAddress(
        nodes,
        "module.x.aws_lambda_permission.p",
        arnIndex,
      ),
    ).toBe("module.x.aws_lambda_function.fn");
  });

  it("buildLambdaPermissionCluster lists permission under Lambda", () => {
    const nodes = nodesWithLambdaAndPermission(lambdaArn);
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster, edges } = buildLambdaPermissionCluster(
      nodes,
      "module.x.aws_lambda_function.fn",
      arnIndex,
    );
    expect(cluster?.stack).toEqual(["module.x.aws_lambda_permission.p"]);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.type).toBe("lambda_permission");
  });

  it("resolveLambdaPermissionTargetLambdaAddressFromPlan matches ARN in resource_changes", () => {
    const permRc = {
      address: "module.x.aws_lambda_permission.p",
      mode: "managed",
      type: "aws_lambda_permission",
      provider_name: "registry.terraform.io/hashicorp/aws",
      change: {
        actions: ["create"],
        after: { function_name: lambdaArn },
      },
    };
    const changes = [
      {
        address: "module.x.aws_lambda_function.fn",
        mode: "managed",
        type: "aws_lambda_function",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["no-op"],
          after: {
            arn: lambdaArn,
            function_name: "myfn",
          },
        },
      },
      permRc,
    ];
    expect(
      resolveLambdaPermissionTargetLambdaAddressFromPlan(permRc, changes),
    ).toBe("module.x.aws_lambda_function.fn");
  });

  it("resolveLambdaPermissionTargetLambdaAddress matches function_name across modules (plan parity)", () => {
    const nodes: TerraformPlanNodesMap = {
      "module.writer.aws_lambda_function.fn": {
        resources: {
          "module.writer.aws_lambda_function.fn": {
            address: "module.writer.aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["no-op"],
              after: {
                arn: "arn:aws:lambda:us-east-1:111111111111:function:writer",
                function_name: "writer-fn",
              },
            },
          },
        },
      },
      "module.alb.aws_lambda_permission.invoke": {
        resources: {
          "module.alb.aws_lambda_permission.invoke": {
            address: "module.alb.aws_lambda_permission.invoke",
            mode: "managed",
            type: "aws_lambda_permission",
            change: {
              actions: ["create"],
              after: { function_name: "writer-fn" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(
      resolveLambdaPermissionTargetLambdaAddress(
        nodes,
        "module.alb.aws_lambda_permission.invoke",
        arnIndex,
      ),
    ).toBe("module.writer.aws_lambda_function.fn");
  });
});
