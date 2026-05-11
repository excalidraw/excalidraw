import { describe, expect, it } from "vitest";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import { buildLambdaCloudWatchCluster } from "./terraformTopologyCloudWatchLinks";

describe("terraformTopologyCloudWatchLinks", () => {
  it("attaches Lambda metric alarms by AWS/Lambda FunctionName dimension", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: { function_name: "test-reader" },
            },
          },
        },
      },
      "aws_cloudwatch_metric_alarm.errors": {
        resources: {
          "aws_cloudwatch_metric_alarm.errors": {
            address: "aws_cloudwatch_metric_alarm.errors",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            change: {
              after: {
                namespace: "AWS/Lambda",
                metric_name: "Errors",
                dimensions: { FunctionName: "test-reader" },
              },
            },
          },
        },
      },
    };

    const { cluster, edges } = buildLambdaCloudWatchCluster(
      nodes,
      "aws_lambda_function.fn",
    );

    expect(cluster?.alarms).toEqual(["aws_cloudwatch_metric_alarm.errors"]);
    expect(cluster?.logGroups).toEqual([]);
    expect(edges).toEqual([
      {
        source: "aws_cloudwatch_metric_alarm.errors",
        target: "aws_lambda_function.fn",
        type: "cloudwatch_alarm",
        label: "alarm",
      },
    ]);
  });

  it("does not attach non-Lambda metric alarms", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: { function_name: "test-reader" },
            },
          },
        },
      },
      "aws_cloudwatch_metric_alarm.bucket_size": {
        resources: {
          "aws_cloudwatch_metric_alarm.bucket_size": {
            address: "aws_cloudwatch_metric_alarm.bucket_size",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            change: {
              after: {
                namespace: "AWS/S3",
                dimensions: { BucketName: "test-reader" },
              },
            },
          },
        },
      },
      "aws_cloudwatch_metric_alarm.queue_depth": {
        resources: {
          "aws_cloudwatch_metric_alarm.queue_depth": {
            address: "aws_cloudwatch_metric_alarm.queue_depth",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            change: {
              after: {
                namespace: "AWS/SQS",
                dimensions: { QueueName: "test-reader" },
              },
            },
          },
        },
      },
    };

    expect(
      buildLambdaCloudWatchCluster(nodes, "aws_lambda_function.fn").cluster,
    ).toBeNull();
  });

  it("attaches Lambda log groups by /aws/lambda function name", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: { function_name: "test-reader" },
            },
          },
        },
      },
      "aws_cloudwatch_log_group.lambda": {
        resources: {
          "aws_cloudwatch_log_group.lambda": {
            address: "aws_cloudwatch_log_group.lambda",
            mode: "managed",
            type: "aws_cloudwatch_log_group",
            change: {
              after: { name: "/aws/lambda/test-reader" },
            },
          },
        },
      },
    };

    const { cluster } = buildLambdaCloudWatchCluster(
      nodes,
      "aws_lambda_function.fn",
    );

    expect(cluster?.alarms).toEqual([]);
    expect(cluster?.logGroups).toEqual(["aws_cloudwatch_log_group.lambda"]);
  });

  it("uses before values on deletes when resolving CloudWatch resources", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["delete"],
              before: { function_name: "test-reader" },
              after: {},
            },
          },
        },
      },
      "aws_cloudwatch_metric_alarm.errors": {
        resources: {
          "aws_cloudwatch_metric_alarm.errors": {
            address: "aws_cloudwatch_metric_alarm.errors",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            change: {
              actions: ["delete"],
              before: {
                namespace: "AWS/Lambda",
                dimensions: { FunctionName: "test-reader" },
              },
              after: {},
            },
          },
        },
      },
      "aws_cloudwatch_log_group.lambda": {
        resources: {
          "aws_cloudwatch_log_group.lambda": {
            address: "aws_cloudwatch_log_group.lambda",
            mode: "managed",
            type: "aws_cloudwatch_log_group",
            change: {
              actions: ["delete"],
              before: { name: "/aws/lambda/test-reader" },
              after: {},
            },
          },
        },
      },
    };

    const { cluster } = buildLambdaCloudWatchCluster(
      nodes,
      "aws_lambda_function.fn",
    );

    expect(cluster?.alarms).toEqual(["aws_cloudwatch_metric_alarm.errors"]);
    expect(cluster?.logGroups).toEqual(["aws_cloudwatch_log_group.lambda"]);
  });
});
