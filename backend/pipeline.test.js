const { buildDataFlowEdges, ensureEdgeLists } = require("./pipeline");

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

    expect(dataFlowTargets(nodes, "aws_lambda_function.reader")).toContainEqual(
      {
        target: "aws_s3_bucket.assets",
        type: "reads",
        origin: "iam_policy",
      },
    );
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

    expect(dataFlowTargets(nodes, "aws_lambda_function.reader")).toContainEqual(
      {
        target: "aws_dynamodb_table.items",
        type: "reads",
        origin: "iam_policy",
      },
    );
  });
});
