import { describe, expect, it } from "vitest";

import {
  applyDeclaredDataFlow,
  applyDeclaredDataFlowFromMany,
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
    expect(parsed.version).toBe(1);
    expect(parsed.binds.get("writer")).toBe(WRITER);
    expect(parsed.binds.get("bucket")).toBe(BUCKET);
    expect(parsed.edgeSpecs).toEqual([
      { source: "writer", target: "bucket" },
      { source: "writer", target: "queue" },
    ]);
  });

  it("detects tfd 2 version header", () => {
    const parsed = parseDeclaredDataFlowText(`
      tfd 2
      bind writer = ${WRITER}
      writer -> bucket
    `);
    expect(parsed.version).toBe(2);
  });

  it("parses comma fanout as parallel edges", () => {
    const parsed = parseDeclaredDataFlowText(`
      tfd 2
      writer -> bucket, queue
    `);
    expect(parsed.edgeSpecs).toEqual([
      { source: "writer", target: "bucket" },
      { source: "writer", target: "queue" },
    ]);
  });

  it("expands --> into hop alias edges", () => {
    const parsed = parseDeclaredDataFlowText(`
      tfd 2
      writer --> reader
    `);
    expect(parsed.edgeSpecs).toHaveLength(2);
    expect(parsed.edgeSpecs[0]).toEqual({
      source: "writer",
      target: "__tfd_hop_0",
    });
    expect(parsed.edgeSpecs[1]).toEqual({
      source: "__tfd_hop_0",
      target: "reader",
    });
    expect(parsed.hopAliases.has("__tfd_hop_0")).toBe(true);
    expect(parsed.binds.get("__tfd_hop_0")).toBe("@hop");
  });

  it("registers explicit @hop bind alias", () => {
    const parsed = parseDeclaredDataFlowText(`
      tfd 2
      bind mid = @hop
      writer -> mid
      mid -> reader
    `);
    expect(parsed.hopAliases.has("mid")).toBe(true);
    expect(parsed.edgeSpecs).toEqual([
      { source: "writer", target: "mid" },
      { source: "mid", target: "reader" },
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
    const { edges, errors, warnings } = applyDeclaredDataFlow(nodes, text);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
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

describe("applyDeclaredDataFlowFromMany", () => {
  it("preserves global sequence across files", () => {
    const nodes = minimalNodes();
    const file1 = `bind writer = ${WRITER}\nbind bucket = ${BUCKET}\nwriter -> bucket`;
    const file2 = `bind queue = ${QUEUE}\nbucket -> queue`;
    const { edges, errors } = applyDeclaredDataFlowFromMany(nodes, [
      file1,
      file2,
    ]);
    expect(errors).toEqual([]);
    expect(edges.map((e) => e.sequence)).toEqual([0, 1]);
    expect(edges[0].source).toBe(WRITER);
    expect(edges[1].target).toBe(QUEUE);
  });

  it("warns when bind alias is redefined across files", () => {
    const nodes = minimalNodes();
    const { warnings } = applyDeclaredDataFlowFromMany(
      nodes,
      [`bind writer = ${WRITER}`, `bind writer = ${READER}`],
      ["a.tfd", "b.tfd"],
    );
    expect(warnings.some((w) => w.includes('bind "writer"'))).toBe(true);
  });
});
