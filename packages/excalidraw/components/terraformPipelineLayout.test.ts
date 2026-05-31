import { describe, expect, it } from "vitest";

import { buildTerraformPipelineExcalidrawScene } from "./terraformPipelineLayout";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

const rc = (
  address: string,
  type: string,
  after: Record<string, unknown> = {},
) => ({
  address,
  mode: "managed",
  type,
  name: address.split(".").pop() ?? address,
  change: {
    actions: ["no-op"],
    after,
  },
});

const node = (
  address: string,
  type: string,
): TerraformPlanNodesMap[string] => ({
  resources: {
    [address]: {
      address,
      mode: "managed",
      type,
      name: address.split(".").pop() ?? address,
      change: { actions: ["no-op"], after: {} },
    },
  },
  edges_new: [],
  edges_existing: [],
  edges_data_flow: [],
});

const nodeFromRc = (
  change: ReturnType<typeof rc>,
): TerraformPlanNodesMap[string] => ({
  resources: {
    [change.address]: change,
  },
  edges_new: [],
  edges_existing: [],
  edges_data_flow: [],
});

const resourceX = (elements: any[], address: string) => {
  const el = elements.find((e) => e.customData?.nodePath === address);
  expect(el).toBeTruthy();
  return el.x as number;
};

describe("buildTerraformPipelineExcalidrawScene", () => {
  it("assigns left-to-right depth columns from .tfd edges", async () => {
    const nodes = {
      "aws_s3_bucket.a": node("aws_s3_bucket.a", "aws_s3_bucket"),
      "aws_sqs_queue.b": node("aws_sqs_queue.b", "aws_sqs_queue"),
      "aws_dynamodb_table.c": node(
        "aws_dynamodb_table.c",
        "aws_dynamodb_table",
      ),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_s3_bucket.a",
          target: "aws_sqs_queue.b",
          sequence: 0,
          origin: "tfd",
        },
        {
          source: "aws_sqs_queue.b",
          target: "aws_dynamodb_table.c",
          sequence: 1,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const scene = await buildTerraformPipelineExcalidrawScene(nodes, {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket"),
        rc("aws_sqs_queue.b", "aws_sqs_queue"),
        rc("aws_dynamodb_table.c", "aws_dynamodb_table"),
      ],
    });

    expect(resourceX(scene.elements, "aws_s3_bucket.a")).toBeLessThan(
      resourceX(scene.elements, "aws_sqs_queue.b"),
    );
    expect(resourceX(scene.elements, "aws_sqs_queue.b")).toBeLessThan(
      resourceX(scene.elements, "aws_dynamodb_table.c"),
    );
  });

  it("keeps fanout targets in the same next column", async () => {
    const nodes = {
      "aws_s3_bucket.a": node("aws_s3_bucket.a", "aws_s3_bucket"),
      "aws_sqs_queue.b": node("aws_sqs_queue.b", "aws_sqs_queue"),
      "aws_dynamodb_table.c": node(
        "aws_dynamodb_table.c",
        "aws_dynamodb_table",
      ),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_s3_bucket.a",
          target: "aws_sqs_queue.b",
          sequence: 0,
          origin: "tfd",
        },
        {
          source: "aws_s3_bucket.a",
          target: "aws_dynamodb_table.c",
          sequence: 1,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const scene = await buildTerraformPipelineExcalidrawScene(nodes, {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket"),
        rc("aws_sqs_queue.b", "aws_sqs_queue"),
        rc("aws_dynamodb_table.c", "aws_dynamodb_table"),
      ],
    });

    expect(resourceX(scene.elements, "aws_sqs_queue.b")).toBe(
      resourceX(scene.elements, "aws_dynamodb_table.c"),
    );
  });

  it("collapses ALB listener and target group endpoints into one aws_lb cluster", async () => {
    const lb = rc("aws_lb.app", "aws_lb", {
      arn: "arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/app/1",
    });
    const listener = rc("aws_lb_listener.http", "aws_lb_listener", {
      load_balancer_arn:
        "arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/app/1",
      default_action: [
        {
          type: "forward",
          target_group_arn:
            "arn:aws:elasticloadbalancing:us-east-1:123:targetgroup/app/1",
        },
      ],
    });
    const tg = rc("aws_lb_target_group.app", "aws_lb_target_group", {
      arn: "arn:aws:elasticloadbalancing:us-east-1:123:targetgroup/app/1",
    });
    const nodes = {
      "aws_lb.app": nodeFromRc(lb),
      "aws_lb_listener.http": nodeFromRc(listener),
      "aws_lb_target_group.app": nodeFromRc(tg),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_lb_listener.http",
          target: "aws_lb_target_group.app",
          sequence: 0,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const scene = await buildTerraformPipelineExcalidrawScene(nodes, {
      resource_changes: [lb, listener, tg],
    });

    expect(scene.meta.pipelineClusterCount).toBe(1);
    expect(
      scene.elements.some((e: any) => e.customData?.nodePath === "aws_lb.app"),
    ).toBe(true);
    expect(
      scene.elements.some(
        (e: any) => e.customData?.nodePath === "aws_lb_listener.http",
      ),
    ).toBe(true);
    expect(
      scene.elements.some(
        (e: any) => e.customData?.nodePath === "aws_lb_target_group.app",
      ),
    ).toBe(true);
  });
});
