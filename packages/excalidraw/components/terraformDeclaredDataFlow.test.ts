import { describe, expect, it } from "vitest";

import {
  applyDeclaredDataFlow,
  DECLARED_DATAFLOW_ORDERED_KEY,
  parseDeclaredDataFlowText,
  resolveDeclaredDataFlowEndpoint,
} from "./terraformDeclaredDataFlow";

import type { TerraformPlanGraphNode } from "./terraformPlanParsing";

const WRITER =
  "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
const READER =
  "module.workload_reader_lambda.module.lambda.aws_lambda_function.this[0]";
const BUCKET =
  "module.application_data_bucket.module.bucket.aws_s3_bucket.this[0]";
const QUEUE = "module.application_job_queue.module.queue.aws_sqs_queue.this[0]";

function minimalNodes(): Record<string, TerraformPlanGraphNode> {
  const node = (address: string, type: string): TerraformPlanGraphNode => ({
    resources: {
      [address]: {
        address,
        type,
        change: { after: {} },
      },
    },
  });
  return {
    [WRITER]: node(WRITER, "aws_lambda_function"),
    [READER]: node(READER, "aws_lambda_function"),
    [BUCKET]: node(BUCKET, "aws_s3_bucket"),
    [QUEUE]: node(QUEUE, "aws_sqs_queue"),
  };
}

describe("parseDeclaredDataFlowText", () => {
  it("parses binds with full addresses and edges in file order", () => {
    const parsed = parseDeclaredDataFlowText(`
      bind writer = ${WRITER}
      writer -> bucket
      writer -> queue
      bind bucket = ${BUCKET}
    `);
    expect(parsed.binds.get("writer")).toBe(WRITER);
    expect(parsed.binds.get("bucket")).toBe(BUCKET);
    expect(parsed.edgeSpecs).toEqual([
      { source: "writer", target: "bucket" },
      { source: "writer", target: "queue" },
    ]);
  });
});

describe("resolveDeclaredDataFlowEndpoint", () => {
  it("resolves bound alias via full address", () => {
    const nodes = minimalNodes();
    const binds = new Map([
      ["writer", WRITER],
      ["bucket", BUCKET],
    ]);
    expect(resolveDeclaredDataFlowEndpoint(nodes, "writer", binds)).toBe(
      WRITER,
    );
    expect(resolveDeclaredDataFlowEndpoint(nodes, "bucket", binds)).toBe(
      BUCKET,
    );
  });

  it("resolves full address on arrow without bind", () => {
    const nodes = minimalNodes();
    expect(resolveDeclaredDataFlowEndpoint(nodes, WRITER, new Map())).toBe(
      WRITER,
    );
  });

  it("rejects bare alias without bind", () => {
    const nodes = minimalNodes();
    expect(resolveDeclaredDataFlowEndpoint(nodes, "writer", new Map())).toBe(
      null,
    );
  });
});

describe("applyDeclaredDataFlow", () => {
  it("stores ordered edges on nodes map", () => {
    const nodes = minimalNodes();
    const text = `
bind writer = ${WRITER}
bind reader = ${READER}
bind bucket = ${BUCKET}
bind queue = ${QUEUE}

writer -> bucket
writer -> queue
queue -> reader
bucket -> reader
`;
    const { edges, errors } = applyDeclaredDataFlow(nodes, text);
    expect(errors).toEqual([]);
    expect(edges).toHaveLength(4);
    expect(edges.map((e) => [e.source, e.target])).toEqual([
      [WRITER, BUCKET],
      [WRITER, QUEUE],
      [QUEUE, READER],
      [BUCKET, READER],
    ]);
    expect(edges.map((e) => e.sequence)).toEqual([0, 1, 2, 3]);
    expect(nodes[DECLARED_DATAFLOW_ORDERED_KEY]).toEqual(edges);
  });

  it("errors when bind RHS is not a full address", () => {
    const nodes = minimalNodes();
    const { edges, errors } = applyDeclaredDataFlow(nodes, "bind bad = foo");
    expect(edges).toHaveLength(0);
    expect(
      errors.some((e) => e.includes("must be a full Terraform address")),
    ).toBe(true);
  });
});
