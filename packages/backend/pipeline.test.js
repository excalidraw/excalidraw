const {
  buildDataFlowEdges,
  ensureEdgeLists,
  ensureTerraformModuleNodes,
  collectAllTerraformModulePaths,
  getModulePathChainFromAddress,
  buildNewEdges,
  refineCloudWatchMetricAlarmEdges,
} = require("./pipeline");

const resource = (address, type, name, values = {}) => ({
  address,
  type,
  name,
  values,
  change: { actions: ["create"], after: values },
});

const buildNodes = (resources) => {
  const nodes = {};
  for (const item of resources) {
    nodes[item.address] = {
      resources: {
        [item.address]: item,
      },
    };
  }
  return ensureEdgeLists(nodes);
};

const dataFlowTargets = (nodes, source) =>
  (nodes[source].edges_data_flow || []).map((edge) => ({
    target: edge.target,
    type: edge.type,
    origin: edge.origin,
  }));

describe("terraform module graph nodes", () => {
  it("collects nested module prefixes from addresses", () => {
    expect(
      getModulePathChainFromAddress("module.a.module.b.aws_lambda_function.this"),
    ).toEqual(["module.a", "module.a.module.b"]);
    expect(
      [...collectAllTerraformModulePaths(["module.x.aws_s3_bucket.y", "aws_vpc.z"])].sort(),
    ).toEqual(["module.x"]);
  });

  it("buildNewEdges stops at module boundaries instead of fanning out", () => {
    const adjacency = {
      root_alarm: ["module.app"],
      "module.app": ["module.app.aws_lambda_function.a", "module.app.aws_iam_role.b"],
      "module.app.aws_lambda_function.a": [],
      "module.app.aws_iam_role.b": [],
    };

    let nodes = ensureEdgeLists({
      root_alarm: { resources: {} },
      "module.app.aws_lambda_function.a": { resources: {} },
      "module.app.aws_iam_role.b": { resources: {} },
    });
    nodes = ensureTerraformModuleNodes(nodes);
    buildNewEdges(nodes, adjacency);

    expect(nodes.root_alarm.edges_new.sort()).toEqual(["module.app"]);
  });

  it("refineCloudWatchMetricAlarmEdges collapses DOT+state fan-out to the owning module", () => {
    let nodes = ensureEdgeLists({
      "aws_cloudwatch_metric_alarm.lambda_errors": {
        resources: {
          "aws_cloudwatch_metric_alarm.lambda_errors": {
            type: "aws_cloudwatch_metric_alarm",
            address: "aws_cloudwatch_metric_alarm.lambda_errors",
            change: {
              actions: ["create"],
              after: {
                namespace: "AWS/Lambda",
                dimensions: { FunctionName: "test-writer" },
              },
            },
          },
        },
        edges_new: [
          "module.lambda-writer.aws_lambda_function.main",
          "aws_vpc.lambda",
          "aws_s3_bucket.data",
        ],
        edges_existing: ["module.lambda-writer.aws_iam_role.x", "aws_kms_key.s3"],
      },
      "module.lambda-writer.aws_lambda_function.main": {
        resources: {
          "module.lambda-writer.aws_lambda_function.main": {
            type: "aws_lambda_function",
            address: "module.lambda-writer.aws_lambda_function.main",
            change: { after: { function_name: "test-writer" } },
          },
        },
      },
      "module.lambda-writer": {
        resources: {
          "module.lambda-writer": {
            type: "terraform_module",
            address: "module.lambda-writer",
            change: { actions: ["no-op"] },
          },
        },
      },
      "aws_vpc.lambda": {
        resources: {
          "aws_vpc.lambda": {
            type: "aws_vpc",
            address: "aws_vpc.lambda",
            change: { after: {} },
          },
        },
      },
    });

    nodes = ensureTerraformModuleNodes(nodes);
    refineCloudWatchMetricAlarmEdges(nodes);

    expect(nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_new).toEqual([
      "module.lambda-writer",
    ]);
    expect(nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_existing).toEqual([
      "module.lambda-writer",
    ]);
  });
});

describe("buildDataFlowEdges", () => {
  it("infers API Gateway to Lambda invocation", () => {
    const nodes = buildNodes([
      resource(
        "aws_api_gateway_rest_api.api",
        "aws_api_gateway_rest_api",
        "api",
        {
          id: "api-id",
        },
      ),
      resource(
        "aws_lambda_function.handler",
        "aws_lambda_function",
        "handler",
        {
          function_name: "handler",
          invoke_arn:
            "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123:function:handler/invocations",
          arn: "arn:aws:lambda:us-east-1:123:function:handler",
        },
      ),
      resource(
        "aws_api_gateway_integration.integration",
        "aws_api_gateway_integration",
        "integration",
        {
          rest_api_id: "api-id",
          uri: "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123:function:handler/invocations",
        },
      ),
    ]);

    buildDataFlowEdges(nodes);

    expect(
      dataFlowTargets(nodes, "aws_api_gateway_rest_api.api"),
    ).toContainEqual({
      target: "aws_lambda_function.handler",
      type: "invokes",
      origin: "terraform_resource",
    });
  });

  it("infers S3 notification targets", () => {
    const nodes = buildNodes([
      resource("aws_s3_bucket.assets", "aws_s3_bucket", "assets", {
        bucket: "assets",
        arn: "arn:aws:s3:::assets",
      }),
      resource(
        "aws_lambda_function.processor",
        "aws_lambda_function",
        "processor",
        {
          function_name: "processor",
          arn: "arn:aws:lambda:us-east-1:123:function:processor",
        },
      ),
      resource(
        "aws_s3_bucket_notification.assets",
        "aws_s3_bucket_notification",
        "assets",
        {
          bucket: "assets",
          lambda_function: [
            {
              lambda_function_arn:
                "arn:aws:lambda:us-east-1:123:function:processor",
            },
          ],
        },
      ),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_s3_bucket.assets")).toContainEqual({
      target: "aws_lambda_function.processor",
      type: "triggers",
      origin: "terraform_resource",
    });
  });

  it("infers SQS event source mappings to Lambda", () => {
    const nodes = buildNodes([
      resource("aws_sqs_queue.jobs", "aws_sqs_queue", "jobs", {
        name: "jobs",
        arn: "arn:aws:sqs:us-east-1:123:jobs",
      }),
      resource("aws_lambda_function.worker", "aws_lambda_function", "worker", {
        function_name: "worker",
      }),
      resource(
        "aws_lambda_event_source_mapping.jobs",
        "aws_lambda_event_source_mapping",
        "jobs",
        {
          event_source_arn: "arn:aws:sqs:us-east-1:123:jobs",
          function_name: "worker",
        },
      ),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_sqs_queue.jobs")).toContainEqual({
      target: "aws_lambda_function.worker",
      type: "triggers",
      origin: "terraform_resource",
    });
  });

  it("infers Lambda IAM access to S3", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.lambda", "aws_iam_role", "lambda", {
        name: "lambda-role",
        arn: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_lambda_function.writer", "aws_lambda_function", "writer", {
        function_name: "writer",
        role: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_s3_bucket.assets", "aws_s3_bucket", "assets", {
        bucket: "assets",
        arn: "arn:aws:s3:::assets",
      }),
      resource("aws_iam_role_policy.lambda", "aws_iam_role_policy", "lambda", {
        role: "lambda-role",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: "s3:PutObject",
              Resource: "arn:aws:s3:::assets/*",
            },
          ],
        }),
      }),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_lambda_function.writer")).toContainEqual(
      {
        target: "aws_s3_bucket.assets",
        type: "writes",
        origin: "iam_policy",
      },
    );
  });

  it("maps new Lambda roles through Terraform dependency edges", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.reader", "aws_iam_role", "reader", {
        name: "reader-role",
      }),
      resource("aws_lambda_function.reader", "aws_lambda_function", "reader", {
        function_name: "reader",
      }),
      resource("aws_s3_bucket.assets", "aws_s3_bucket", "assets", {
        bucket: "assets",
        arn: "arn:aws:s3:::assets",
      }),
      resource("aws_iam_role_policy.reader", "aws_iam_role_policy", "reader", {
        role: "reader-role",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: "s3:GetObject",
              Resource: "arn:aws:s3:::assets/*",
            },
          ],
        }),
      }),
    ]);
    nodes["aws_iam_role.reader"].edges_new = ["aws_lambda_function.reader"];

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_s3_bucket.assets")).toContainEqual({
      target: "aws_lambda_function.reader",
      type: "reads",
      origin: "iam_policy",
    });
  });

  it("infers attached IAM policy access to DynamoDB", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.lambda", "aws_iam_role", "lambda", {
        name: "lambda-role",
        arn: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_lambda_function.reader", "aws_lambda_function", "reader", {
        function_name: "reader",
        role: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_dynamodb_table.items", "aws_dynamodb_table", "items", {
        name: "items",
        arn: "arn:aws:dynamodb:us-east-1:123:table/items",
      }),
      resource("aws_iam_policy.reader", "aws_iam_policy", "reader", {
        arn: "arn:aws:iam::123:policy/reader",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: "dynamodb:GetItem",
              Resource: "arn:aws:dynamodb:us-east-1:123:table/items",
            },
          ],
        }),
      }),
      resource(
        "aws_iam_role_policy_attachment.reader",
        "aws_iam_role_policy_attachment",
        "reader",
        {
          role: "lambda-role",
          policy_arn: "arn:aws:iam::123:policy/reader",
        },
      ),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_dynamodb_table.items")).toContainEqual({
      target: "aws_lambda_function.reader",
      type: "reads",
      origin: "iam_policy",
    });
  });

  it("keeps read and write IAM permissions in opposite directions", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.lambda", "aws_iam_role", "lambda", {
        name: "lambda-role",
        arn: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_lambda_function.sync", "aws_lambda_function", "sync", {
        function_name: "sync",
        role: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_s3_bucket.assets", "aws_s3_bucket", "assets", {
        bucket: "assets",
        arn: "arn:aws:s3:::assets",
      }),
      resource("aws_iam_role_policy.sync", "aws_iam_role_policy", "sync", {
        role: "lambda-role",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:GetObject", "s3:PutObject"],
              Resource: "arn:aws:s3:::assets/*",
            },
          ],
        }),
      }),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_s3_bucket.assets")).toContainEqual({
      target: "aws_lambda_function.sync",
      type: "reads",
      origin: "iam_policy",
    });
    expect(dataFlowTargets(nodes, "aws_lambda_function.sync")).toContainEqual({
      target: "aws_s3_bucket.assets",
      type: "writes",
      origin: "iam_policy",
    });
  });
});
