import { describe, expect, it } from "vitest";

import { buildTerraformElkExcalidrawScene } from "./terraformElkLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import type { TerraformPlanGraphNode, TerraformPlanNodesMap } from "./terraformPlanParsing";

function minimalNode(resources: Record<string, unknown>): TerraformPlanGraphNode {
  return { resources };
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe("buildTerraformElkExcalidrawScene", () => {
  it("lays out a nested module tree and returns rectangles plus arrows", async () => {
    const nodes = {
      "aws_s3_bucket.root": minimalNode({
        "aws_s3_bucket.root": { address: "aws_s3_bucket.root" },
      }),
      "module.network.aws_vpc.main": minimalNode({
        "module.network.aws_vpc.main": { address: "module.network.aws_vpc.main" },
      }),
      "module.network.aws_subnet.a": minimalNode({
        "module.network.aws_subnet.a": { address: "module.network.aws_subnet.a" },
      }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {
          "module.network": {
            path: "module.network",
            modules: {},
            resourceAddresses: [
              "module.network.aws_vpc.main",
              "module.network.aws_subnet.a",
            ],
          },
        },
        resourceAddresses: ["aws_s3_bucket.root"],
      },
    } as unknown as TerraformPlanNodesMap;

    (nodes["aws_s3_bucket.root"] as { edges_new?: string[] }).edges_new = [
      "module.network.aws_vpc.main",
    ];
    (nodes["module.network.aws_vpc.main"] as { edges_new?: string[] }).edges_new = [
      "module.network.aws_subnet.a",
    ];

    const { elements, meta } = await buildTerraformElkExcalidrawScene(nodes);

    expect(meta.layoutEngine).toBe("elk");
    expect(meta.skippedLayout).toBeUndefined();
    expect(meta.vertexCount).toBe(3);
    expect(meta.edgeCount).toBe(2);
    expect(elements.length).toBeGreaterThan(0);
    const rects = elements.filter((e) => e.type === "rectangle");
    const arrows = elements.filter((e) => e.type === "arrow");
    const frames = elements.filter((e) => e.type === "frame");
    expect(rects.length).toBe(3);
    expect(arrows.length).toBeGreaterThanOrEqual(1);
    expect(frames.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps sibling module frames from expanding over cross-module arrows", async () => {
    const nodes = {
      "module.api.aws_lambda_function.fn": minimalNode({
        "module.api.aws_lambda_function.fn": {
          address: "module.api.aws_lambda_function.fn",
        },
      }),
      "module.api.aws_cloudwatch_log_group.logs": minimalNode({
        "module.api.aws_cloudwatch_log_group.logs": {
          address: "module.api.aws_cloudwatch_log_group.logs",
        },
      }),
      "module.data.aws_s3_bucket.bucket": minimalNode({
        "module.data.aws_s3_bucket.bucket": {
          address: "module.data.aws_s3_bucket.bucket",
        },
      }),
      "module.data.aws_sqs_queue.queue": minimalNode({
        "module.data.aws_sqs_queue.queue": {
          address: "module.data.aws_sqs_queue.queue",
        },
      }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {
          "module.api": {
            path: "module.api",
            modules: {},
            resourceAddresses: [
              "module.api.aws_cloudwatch_log_group.logs",
              "module.api.aws_lambda_function.fn",
            ],
          },
          "module.data": {
            path: "module.data",
            modules: {},
            resourceAddresses: [
              "module.data.aws_s3_bucket.bucket",
              "module.data.aws_sqs_queue.queue",
            ],
          },
        },
        resourceAddresses: [],
      },
    } as unknown as TerraformPlanNodesMap;

    (
      nodes["module.api.aws_lambda_function.fn"] as { edges_new?: string[] }
    ).edges_new = ["module.data.aws_s3_bucket.bucket"];
    (nodes["module.data.aws_sqs_queue.queue"] as { edges_new?: string[] }).edges_new = [
      "module.api.aws_cloudwatch_log_group.logs",
    ];

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);

    const apiFrame = elements.find(
      (e) => e.type === "frame" && e.name === "module.api",
    );
    const dataFrame = elements.find(
      (e) => e.type === "frame" && e.name === "module.data",
    );
    const arrows = elements.filter((e) => e.type === "arrow");

    expect(apiFrame).toBeDefined();
    expect(dataFrame).toBeDefined();
    expect(arrows.length).toBe(2);
    expect(apiFrame).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(dataFrame).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(apiFrame!.width).toBeGreaterThan(0);
    expect(apiFrame!.height).toBeGreaterThan(0);
    expect(dataFrame!.width).toBeGreaterThan(0);
    expect(dataFrame!.height).toBeGreaterThan(0);
    expect(boxesOverlap(apiFrame!, dataFrame!)).toBe(false);
  });

  it("skips layout when vertex cap is exceeded", async () => {
    const many = {
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {},
        resourceAddresses: [] as string[],
      },
    } as unknown as TerraformPlanNodesMap;

    for (let i = 0; i < 601; i++) {
      const id = `null_resource.n${i}`;
      many[id] = minimalNode({ [id]: { address: id } });
      (many[TERRAFORM_MODULE_TREE_KEY] as { resourceAddresses: string[] }).resourceAddresses.push(
        id,
      );
    }

    const { elements, meta } = await buildTerraformElkExcalidrawScene(many);
    expect(meta.skippedLayout).toBe(true);
    expect(meta.skipReason).toContain("vertex_count");
    expect(elements.length).toBe(0);
  });
});
