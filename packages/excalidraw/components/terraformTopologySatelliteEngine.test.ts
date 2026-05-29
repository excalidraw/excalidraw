import { describe, expect, it } from "vitest";

import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import { buildLambdaPermissionCluster } from "./terraformTopologyLambdaPermissionLinks";
import { buildSatelliteClusterForKind } from "./terraformTopologySatelliteEngine";
import { buildSatelliteContext } from "./terraformTopologySatelliteRegistry";

import "./terraformTopologySatelliteRegistry";

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

describe("terraformTopologySatelliteEngine", () => {
  it("lambda_permission declarative rule matches legacy builder", () => {
    const nodes = nodesWithLambdaAndPermission(lambdaArn);
    const arnIndex = buildArnIndexForTopology(nodes);
    const lambdaAddr = "module.x.aws_lambda_function.fn";

    const legacy = buildLambdaPermissionCluster(nodes, lambdaAddr, arnIndex);
    const ctx = buildSatelliteContext(nodes, lambdaAddr, arnIndex);
    const engine = buildSatelliteClusterForKind("lambda_permission", ctx);

    expect(engine.cluster).toEqual(legacy.cluster);
    expect(engine.edges).toEqual(legacy.edges);
  });
});
