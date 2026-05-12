import { describe, expect, it } from "vitest";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import { buildResourceCloudWatchCluster } from "./terraformTopologyCloudWatchLinks";

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

    const { cluster, edges } = buildResourceCloudWatchCluster(
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

  it("does not attach non-Lambda metric alarms to a Lambda", () => {
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
      buildResourceCloudWatchCluster(nodes, "aws_lambda_function.fn").cluster,
    ).toBeNull();
  });

  it("attaches S3 and SQS metric alarms by CloudWatch dimensions", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_s3_bucket.data": {
        resources: {
          "aws_s3_bucket.data": {
            address: "aws_s3_bucket.data",
            mode: "managed",
            type: "aws_s3_bucket",
            change: {
              after: {
                bucket: "ts-test-lambda-data",
                id: "ts-test-lambda-data",
              },
            },
          },
        },
      },
      "aws_sqs_queue.jobs": {
        resources: {
          "aws_sqs_queue.jobs": {
            address: "aws_sqs_queue.jobs",
            mode: "managed",
            type: "aws_sqs_queue",
            change: {
              after: {
                name: "ts-test-lambda-queue",
                arn: "arn:aws:sqs:us-east-1:111111111111:ts-test-lambda-queue",
              },
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
                dimensions: {
                  BucketName: "ts-test-lambda-data",
                  StorageType: "StandardStorage",
                },
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
                dimensions: { QueueName: "ts-test-lambda-queue" },
              },
            },
          },
        },
      },
    };

    expect(
      buildResourceCloudWatchCluster(nodes, "aws_s3_bucket.data").cluster?.alarms,
    ).toEqual(["aws_cloudwatch_metric_alarm.bucket_size"]);
    expect(
      buildResourceCloudWatchCluster(nodes, "aws_sqs_queue.jobs").cluster?.alarms,
    ).toEqual(["aws_cloudwatch_metric_alarm.queue_depth"]);
  });

  it("attaches multiple S3 alarms when companion bucket resources share the same bucket id", () => {
    const nodes: TerraformPlanNodesMap = {
      "module.bucket.aws_s3_bucket.this[0]": {
        resources: {
          "module.bucket.aws_s3_bucket.this[0]": {
            address: "module.bucket.aws_s3_bucket.this[0]",
            mode: "managed",
            type: "aws_s3_bucket",
            values: {
              bucket: "ts-test-lambda-data",
              id: "ts-test-lambda-data",
            },
          },
        },
      },
      "module.bucket.aws_s3_bucket_policy.secure_transport[0]": {
        resources: {
          "module.bucket.aws_s3_bucket_policy.secure_transport[0]": {
            address: "module.bucket.aws_s3_bucket_policy.secure_transport[0]",
            mode: "managed",
            type: "aws_s3_bucket_policy",
            values: {
              bucket: "ts-test-lambda-data",
              id: "ts-test-lambda-data",
            },
          },
        },
      },
      "module.bucket.aws_s3_bucket_versioning.this[0]": {
        resources: {
          "module.bucket.aws_s3_bucket_versioning.this[0]": {
            address: "module.bucket.aws_s3_bucket_versioning.this[0]",
            mode: "managed",
            type: "aws_s3_bucket_versioning",
            values: {
              bucket: "ts-test-lambda-data",
              id: "ts-test-lambda-data",
            },
          },
        },
      },
      "module.bucket.aws_cloudwatch_metric_alarm.object_count[0]": {
        resources: {
          "module.bucket.aws_cloudwatch_metric_alarm.object_count[0]": {
            address: "module.bucket.aws_cloudwatch_metric_alarm.object_count[0]",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            values: {
              namespace: "AWS/S3",
              metric_name: "NumberOfObjects",
              dimensions: {
                BucketName: "ts-test-lambda-data",
                StorageType: "StandardStorage",
              },
            },
          },
        },
      },
      "module.bucket.aws_cloudwatch_metric_alarm.size_bytes[0]": {
        resources: {
          "module.bucket.aws_cloudwatch_metric_alarm.size_bytes[0]": {
            address: "module.bucket.aws_cloudwatch_metric_alarm.size_bytes[0]",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            values: {
              namespace: "AWS/S3",
              metric_name: "BucketSizeBytes",
              dimensions: {
                BucketName: "ts-test-lambda-data",
                StorageType: "StandardStorage",
              },
            },
          },
        },
      },
    };

    expect(
      buildResourceCloudWatchCluster(
        nodes,
        "module.bucket.aws_s3_bucket.this[0]",
      ).cluster?.alarms,
    ).toEqual([
      "module.bucket.aws_cloudwatch_metric_alarm.object_count[0]",
      "module.bucket.aws_cloudwatch_metric_alarm.size_bytes[0]",
    ]);
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

    const { cluster } = buildResourceCloudWatchCluster(
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

    const { cluster } = buildResourceCloudWatchCluster(
      nodes,
      "aws_lambda_function.fn",
    );

    expect(cluster?.alarms).toEqual(["aws_cloudwatch_metric_alarm.errors"]);
    expect(cluster?.logGroups).toEqual(["aws_cloudwatch_log_group.lambda"]);
  });
});
