import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  beforeValuesSatisfyRef,
  buildUnknownAfterDependencies,
  buildUnknownAfterIntentPreview,
  dedupeModuleInputRefs,
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

  it("buildUnknownAfterIntentPreview uses value-based matching for writer lambda", () => {
    const addr =
      "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
    const rc = (plan.resource_changes || []).find(
      (r: { address?: string }) => r.address === addr,
    );
    const before = rc?.change?.before?.environment;
    const preview = buildUnknownAfterIntentPreview(
      plan,
      addr,
      "environment",
      "aws_lambda_function",
      before,
    );
    expect(preview).toHaveLength(1);
    expect(preview[0]).toEqual(
      expect.objectContaining({
        key: "queue_url",
        kind: "new",
        resolvesTo: "module.application_job_queue.queue_url",
      }),
    );
    expect(String(preview[0]?.nodePath ?? "")).toMatch(/aws_sqs_queue/);
    expect(preview.find((r) => r.key === "s3_bucket_id")).toBeUndefined();
    expect(preview.find((r) => r.key === "test")).toBeUndefined();
  });

  it("infers env keys from refs when before is absent", () => {
    const addr = "module.new_lambda.module.lambda.aws_lambda_function.this[0]";
    const preview = buildUnknownAfterIntentPreview(
      plan,
      addr,
      "environment",
      "aws_lambda_function",
      undefined,
    );
    expect(preview.length).toBe(0);
  });
});

describe("dedupeModuleInputRefs", () => {
  it("drops bare module refs when a longer ref exists", () => {
    const refs = [
      "module.application_data_bucket",
      "module.application_data_bucket.s3_bucket_id",
      "module.application_job_queue",
      "module.application_job_queue.queue_url",
    ];
    expect(dedupeModuleInputRefs(refs).sort()).toEqual(
      [
        "module.application_data_bucket.s3_bucket_id",
        "module.application_job_queue.queue_url",
      ].sort(),
    );
  });
});

describe("beforeValuesSatisfyRef", () => {
  const plan = {
    resource_changes: [
      {
        address:
          "module.application_data_bucket.module.bucket.aws_s3_bucket.this[0]",
        type: "aws_s3_bucket",
        change: {
          actions: ["no-op"],
          before: { id: "ts-test-lambda-data" },
        },
      },
      {
        address:
          "module.application_job_queue.module.queue.aws_sqs_queue.this[0]",
        type: "aws_sqs_queue",
        change: { actions: ["create"], before: null },
      },
    ],
  };

  it("matches when a before env value equals target resource before.id", () => {
    expect(
      beforeValuesSatisfyRef(
        plan,
        "module.application_data_bucket.s3_bucket_id",
        { DATA_BUCKET: "ts-test-lambda-data", test: "test1" },
      ),
    ).toBe(true);
  });

  it("does not match refs for resources with no overlapping before scalars", () => {
    expect(
      beforeValuesSatisfyRef(plan, "module.application_job_queue.queue_url", {
        DATA_BUCKET: "ts-test-lambda-data",
        test: "test1",
      }),
    ).toBe(false);
  });
});

describe("buildUnknownAfterIntentPreview create-only", () => {
  it("lists new rows from configuration refs without before (ref last segment as key)", () => {
    const plan = {
      format_version: "1.2",
      resource_changes: [
        {
          address: "module.api.module.lambda.aws_lambda_function.this[0]",
          type: "aws_lambda_function",
          change: {
            actions: ["create"],
            after: { environment: [{}] },
            after_unknown: { environment: [{ variables: true }] },
          },
        },
        {
          address:
            "module.application_job_queue.module.queue.aws_sqs_queue.this[0]",
          type: "aws_sqs_queue",
          change: { actions: ["create"] },
        },
      ],
      configuration: {
        root_module: {
          module_calls: {
            api: {
              expressions: {
                environment_variables: {
                  references: [
                    "module.application_data_bucket.s3_bucket_id",
                    "module.application_job_queue.queue_url",
                  ],
                },
              },
              module: { module_calls: {} },
            },
          },
        },
      },
    };
    const preview = buildUnknownAfterIntentPreview(
      plan,
      "module.api.module.lambda.aws_lambda_function.this[0]",
      "environment",
      "aws_lambda_function",
      undefined,
    );
    expect(preview.map((r) => r.key).sort()).toEqual(
      ["queue_url", "s3_bucket_id"].sort(),
    );
    expect(preview.every((r) => r.kind === "new")).toBe(true);
    expect(preview.find((r) => r.key === "queue_url")?.resolvesTo).toBe(
      "module.application_job_queue.queue_url",
    );
  });
});
