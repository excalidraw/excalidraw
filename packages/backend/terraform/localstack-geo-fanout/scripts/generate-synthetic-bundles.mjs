#!/usr/bin/env node
/**
 * Generate minimal plan.json + graph.dot bundles for localstack-geo-fanout tests
 * without running LocalStack (CI / offline).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { STACKS, arn } from "./stack-geo-manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(
  ROOT,
  "../../../excalidraw/test-fixtures/localstack-geo-fanout/bundles",
);

function subnetChange(stack) {
  return {
    address: "module.network.aws_subnet.private",
    mode: "managed",
    type: "aws_subnet",
    name: "private",
    provider_name: "registry.terraform.io/hashicorp/aws",
    change: {
      actions: ["no-op"],
      after: {
        id: stack.subnetId,
        vpc_id: stack.vpcId,
        cidr_block: "10.0.1.0/24",
        availability_zone: `${stack.region}a`,
        owner_id: stack.account,
        arn: arn(
          "ec2",
          stack.region,
          stack.account,
          `subnet/${stack.subnetId}`,
        ),
        tags: { Name: `${stack.apiName ?? "consumer"}-private` },
        tags_all: { Name: `${stack.apiName ?? "consumer"}-private` },
      },
    },
  };
}

function vpcChange(stack) {
  return {
    address: "module.network.aws_vpc.this",
    mode: "managed",
    type: "aws_vpc",
    name: "this",
    provider_name: "registry.terraform.io/hashicorp/aws",
    change: {
      actions: ["no-op"],
      after: {
        id: stack.vpcId,
        cidr_block: "10.0.0.0/16",
        owner_id: stack.account,
        arn: arn("ec2", stack.region, stack.account, `vpc/${stack.vpcId}`),
      },
    },
  };
}

function consumerPlan(stack) {
  const lambdaArn = arn(
    "lambda",
    stack.region,
    stack.account,
    "function:local-consumer",
  );
  return {
    format_version: "1.2",
    terraform_version: "1.11.5",
    variables: {
      aws_account_id: { value: stack.account },
      aws_region: { value: stack.region },
      environment: { value: "local" },
    },
    resource_changes: [
      vpcChange(stack),
      subnetChange(stack),
      {
        address: "module.consumer.aws_lambda_function.consumer",
        mode: "managed",
        type: "aws_lambda_function",
        name: "consumer",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["no-op"],
          after: {
            arn: lambdaArn,
            function_name: "local-consumer",
            region: stack.region,
            vpc_config: [{ subnet_ids: [stack.subnetId] }],
          },
        },
      },
    ],
  };
}

function apiPlan(stack) {
  const lambdaArn = arn(
    "lambda",
    stack.region,
    stack.account,
    `function:local-${stack.apiName}`,
  );
  const apiId = `api-${stack.apiName}`;
  return {
    format_version: "1.2",
    terraform_version: "1.11.5",
    variables: {
      aws_account_id: { value: stack.account },
      aws_region: { value: stack.region },
      environment: { value: "local" },
    },
    resource_changes: [
      vpcChange(stack),
      subnetChange(stack),
      {
        address: "module.api.aws_api_gateway_rest_api.main",
        mode: "managed",
        type: "aws_api_gateway_rest_api",
        name: "main",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["no-op"],
          after: {
            id: apiId,
            name: stack.apiName,
            region: stack.region,
            arn: arn(
              "apigateway",
              stack.region,
              stack.account,
              `/restapis/${apiId}`,
            ),
            endpoint_configuration: [{ types: ["REGIONAL"] }],
          },
        },
      },
      {
        address: "module.api.aws_lambda_function.this",
        mode: "managed",
        type: "aws_lambda_function",
        name: "this",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["no-op"],
          after: {
            arn: lambdaArn,
            function_name: `local-${stack.apiName}`,
            region: stack.region,
            vpc_config: [{ subnet_ids: [stack.subnetId] }],
          },
        },
      },
      {
        address: "module.api.aws_ssm_parameter.api_name",
        mode: "managed",
        type: "aws_ssm_parameter",
        name: "api_name",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["no-op"],
          after: {
            arn: arn(
              "ssm",
              stack.region,
              stack.account,
              `parameter/local/${stack.apiName}/name`,
            ),
            name: `/local/${stack.apiName}/name`,
            region: stack.region,
            type: "String",
            value: stack.apiName,
          },
        },
      },
      {
        address: "module.api.aws_lambda_permission.apigw",
        mode: "managed",
        type: "aws_lambda_permission",
        name: "apigw",
        provider_name: "registry.terraform.io/hashicorp/aws",
        change: {
          actions: ["no-op"],
          after: {
            function_name: `local-${stack.apiName}`,
            region: stack.region,
          },
        },
      },
    ],
  };
}

function dotForPlan(plan) {
  const lines = ["digraph G {"];
  for (const rc of plan.resource_changes) {
    lines.push(`  "[root] ${rc.address} (expand)" [shape=box];`);
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const stack of STACKS) {
  const plan =
    stack.kind === "consumer" ? consumerPlan(stack) : apiPlan(stack);
  fs.writeFileSync(
    path.join(OUT_DIR, `${stack.id}.plan.json`),
    `${JSON.stringify(plan, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(OUT_DIR, `${stack.id}.graph.dot`),
    dotForPlan(plan),
  );
}

fs.copyFileSync(
  path.join(ROOT, "pipeline.tfd"),
  path.join(OUT_DIR, "pipeline.tfd"),
);

console.log(`Wrote synthetic bundles to ${OUT_DIR}`);
