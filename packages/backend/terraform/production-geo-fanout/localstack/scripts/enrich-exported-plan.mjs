#!/usr/bin/env node
/**
 * Patch LocalStack terraform show -json output for production-geo-fanout pipeline layout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { STACK_BY_ID, arn } from "./stack-geo-manifest.mjs";

function walkStateResources(module, out = new Map()) {
  if (!module || typeof module !== "object") {
    return out;
  }
  for (const resource of module.resources ?? []) {
    if (typeof resource?.address === "string") {
      out.set(resource.address, resource.values ?? {});
    }
  }
  for (const child of module.child_modules ?? []) {
    walkStateResources(child, out);
  }
  return out;
}

function loadStateValues(stackDir) {
  const statePath = path.join(stackDir, "terraform.tfstate");
  if (!fs.existsSync(statePath)) {
    return new Map();
  }
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return walkStateResources(state.values?.root_module ?? state);
  } catch {
    return new Map();
  }
}

function mergeAfter(change, patch) {
  if (!change || typeof change !== "object") {
    return;
  }
  const after =
    change.after && typeof change.after === "object" && !Array.isArray(change.after)
      ? change.after
      : {};
  change.after = { ...after, ...patch };
}

function resolveSubnetId(stateValues, stack) {
  const subnetState = stateValues.get("module.network.aws_subnet.private");
  return subnetState?.id ?? stack.subnetId;
}

function subnetNameTag(stack) {
  if (stack.kind === "network") {
    return `${stack.name}-private`;
  }
  if (stack.kind === "messaging") {
    return "local-messaging-private";
  }
  return `local-${stack.apiName}-private`;
}

function enrichResourceChange(rc, stack, stateValues) {
  const state = stateValues.get(rc.address) ?? {};
  const { account, region } = stack;

  if (rc.type === "aws_subnet" && rc.address === "module.network.aws_subnet.private") {
    const subnetId = resolveSubnetId(stateValues, stack);
    const vpcId = state.vpc_id ?? stack.vpcId;
    const nameTag = subnetNameTag(stack);
    mergeAfter(rc.change, {
      id: subnetId,
      vpc_id: vpcId,
      owner_id: state.owner_id ?? account,
      availability_zone: state.availability_zone ?? `${region}a`,
      arn:
        state.arn ??
        arn("ec2", region, account, `subnet/${subnetId}`),
      region,
      tags: { Name: nameTag },
      tags_all: { Name: nameTag },
    });
    return;
  }

  if (rc.type === "aws_vpc" && rc.address === "module.network.aws_vpc.this") {
    const vpcId = state.id ?? stack.vpcId;
    mergeAfter(rc.change, {
      id: vpcId,
      owner_id: state.owner_id ?? account,
      arn: state.arn ?? arn("ec2", region, account, `vpc/${vpcId}`),
      region,
    });
    return;
  }

  if (
    rc.type === "aws_lambda_function" &&
    (rc.address === "module.api.aws_lambda_function.this" ||
      rc.address === "module.consumer.aws_lambda_function.consumer")
  ) {
    const functionName =
      state.function_name ??
      (stack.kind === "messaging"
        ? "local-geo-fanout-consumer"
        : `local-${stack.apiName}`);
    const subnetId = resolveSubnetId(stateValues, stack);
    mergeAfter(rc.change, {
      arn:
        state.arn ??
        arn("lambda", region, account, `function:${functionName}`),
      function_name: functionName,
      region,
      vpc_config: [{ subnet_ids: [subnetId] }],
    });
    return;
  }

  if (
    rc.type === "aws_api_gateway_rest_api" &&
    rc.address === "module.api.aws_api_gateway_rest_api.main"
  ) {
    const apiId = state.id ?? `api-${stack.apiName}`;
    mergeAfter(rc.change, {
      id: apiId,
      name: state.name ?? stack.apiName,
      region,
      arn:
        state.arn ??
        arn("apigateway", region, account, `/restapis/${apiId}`),
      endpoint_configuration: state.endpoint_configuration ?? [
        { types: ["REGIONAL"] },
      ],
    });
    return;
  }

  if (
    rc.type === "aws_ssm_parameter" &&
    rc.address === "module.api.aws_ssm_parameter.api_name"
  ) {
    const paramName = state.name ?? `/local/${stack.apiName}/name`;
    mergeAfter(rc.change, {
      name: paramName,
      region,
      type: state.type ?? "String",
      value: state.value ?? stack.apiName,
      arn:
        state.arn ??
        arn("ssm", region, account, `parameter${paramName}`),
    });
    return;
  }

  if (rc.type === "aws_sqs_queue" && rc.address === "aws_sqs_queue.fanout") {
    const queueName = state.name ?? "local-geo-fanout-events.fifo";
    mergeAfter(rc.change, {
      name: queueName,
      region,
      arn:
        state.arn ??
        arn("sqs", region, account, queueName),
    });
  }
}

function enrichPlan(planPath, stackDir, stackId) {
  const stack = STACK_BY_ID.get(stackId);
  if (!stack) {
    throw new Error(`Unknown stack id: ${stackId}`);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const stateValues = loadStateValues(stackDir);

  plan.variables = {
    ...(plan.variables ?? {}),
    aws_account_id: { value: stack.account },
    aws_region: { value: stack.region },
    environment: { value: "local" },
  };

  for (const rc of plan.resource_changes ?? []) {
    enrichResourceChange(rc, stack, stateValues);
  }

  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
}

const stackId = process.argv[2];
const planPath = process.argv[3];
const stackDir = process.argv[4] ?? path.dirname(planPath);

if (!stackId || !planPath) {
  console.error(
    "Usage: enrich-exported-plan.mjs <stack-id> <plan.json> [stack-dir]",
  );
  process.exit(1);
}

enrichPlan(planPath, stackDir, stackId);
console.log(`Enriched ${planPath} for ${stackId}`);
