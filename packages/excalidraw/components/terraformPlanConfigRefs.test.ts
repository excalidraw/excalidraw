import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildUnknownAfterDependencies,
  resolveModuleCallExpressionRefs,
  resolveTerraformReferenceToNodePaths,
} from "./terraformPlanConfigRefs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_FIXTURE = path.resolve(
  __dirname,
  "../../backend/terraform/allplanmodules.json",
);

describe("terraformPlanConfigRefs (allplanmodules)", () => {
  const plan = JSON.parse(fs.readFileSync(PLAN_FIXTURE, "utf8"));

  it("resolves writer lambda environment_variables module refs", () => {
    const addr =
      "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
    const refs = resolveModuleCallExpressionRefs(
      plan,
      addr,
      "environment",
      "aws_lambda_function",
    );
    expect(refs).toEqual(
      expect.arrayContaining([
        "module.application_data_bucket.s3_bucket_id",
        "module.application_job_queue.queue_url",
      ]),
    );
    expect(refs.length).toBe(2);
  });

  it("expands queue_url ref to aws_sqs_queue node path", () => {
    const paths = resolveTerraformReferenceToNodePaths(
      plan,
      "module.application_job_queue.queue_url",
    );
    expect(paths.some((p) => p.includes("aws_sqs_queue.this"))).toBe(true);
  });

  it("buildUnknownAfterDependencies links refs to plan addresses", () => {
    const addr =
      "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
    const deps = buildUnknownAfterDependencies(
      plan,
      addr,
      "environment",
      "aws_lambda_function",
    );
    expect(deps.length).toBeGreaterThanOrEqual(2);
    const queueDep = deps.find((d) =>
      d.reference.includes("application_job_queue"),
    );
    expect(String(queueDep?.nodePath ?? "")).toMatch(/aws_sqs_queue/);
  });
});
