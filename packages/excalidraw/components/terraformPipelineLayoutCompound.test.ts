import { describe, expect, it } from "vitest";

import { getFrameDescendants } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  buildTerraformCompoundPipelineExcalidrawScene,
  buildTerraformPipelineExcalidrawScene,
} from "./terraformPipelineLayout";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

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

const rc = (
  address: string,
  type: string,
  after: Record<string, unknown> = {},
) => ({
  address,
  mode: "managed",
  type,
  name: address.split(".").pop() ?? address,
  change: { actions: ["no-op"], after },
});

function frameRoleChain(
  elements: readonly ExcalidrawElement[],
  startFrameId: string | null,
): string[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const roles: string[] = [];
  let frameId = startFrameId;
  while (frameId) {
    const frame = byId.get(frameId);
    if (!frame || frame.type !== "frame") {
      break;
    }
    const role = (frame as { customData?: { terraformTopologyRole?: string } })
      .customData?.terraformTopologyRole;
    if (role) {
      roles.push(role);
    }
    frameId = frame.frameId ?? null;
  }
  return roles;
}

const resourceX = (elements: ExcalidrawElement[], address: string) => {
  const el = elements.find(
    (e) =>
      e.type === "rectangle" &&
      (e as { customData?: { nodePath?: string } }).customData?.nodePath ===
        address,
  );
  expect(el).toBeTruthy();
  return el!.x;
};

describe("terraformPipelineLayoutCompound hierarchical post-pass", () => {
  it("emits provider, account, and region context frames without regionalBucket", async () => {
    const nodes = {
      "aws_s3_bucket.a": node("aws_s3_bucket.a", "aws_s3_bucket"),
      "aws_sqs_queue.b": node("aws_sqs_queue.b", "aws_sqs_queue"),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_s3_bucket.a",
          target: "aws_sqs_queue.b",
          sequence: 0,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const plan = {
      configuration: {
        provider_config: {
          aws: {
            expressions: {
              assume_role: [
                {
                  role_arn: {
                    constant_value: "arn:aws:iam::999988887777:role/Deploy",
                  },
                },
              ],
            },
          },
        },
      },
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket", { region: "us-east-1" }),
        rc("aws_sqs_queue.b", "aws_sqs_queue", { region: "us-east-1" }),
      ],
    };

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
    );
    expect(scene.meta.pipelineCompoundHierarchical).toBe(true);

    const frameRoles = scene.elements
      .filter((el) => el.type === "frame")
      .map(
        (el) =>
          (el as { customData?: { terraformTopologyRole?: string } }).customData
            ?.terraformTopologyRole,
      )
      .filter(Boolean);

    expect(frameRoles).toContain("provider");
    expect(frameRoles).toContain("account");
    expect(frameRoles).toContain("region");
    expect(frameRoles).not.toContain("regionalBucket");
  });

  it("stamps terraformCompoundLocal on cluster resources", async () => {
    const nodes = {
      "aws_s3_bucket.a": node("aws_s3_bucket.a", "aws_s3_bucket"),
      "aws_sqs_queue.b": node("aws_sqs_queue.b", "aws_sqs_queue"),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_s3_bucket.a",
          target: "aws_sqs_queue.b",
          sequence: 0,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const plan = {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket", { region: "us-east-1" }),
        rc("aws_sqs_queue.b", "aws_sqs_queue", { region: "us-east-1" }),
      ],
    };

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
    );
    const resource = scene.elements.find(
      (el) =>
        el.type === "rectangle" &&
        (el as { customData?: { nodePath?: string } }).customData?.nodePath ===
          "aws_s3_bucket.a",
    );
    const cd = (
      resource as { customData?: Record<string, unknown> } | undefined
    )?.customData;
    expect(cd?.terraformCompoundLayout).toBe(true);
    expect(cd?.terraformCompoundParentKey).toBeTruthy();
    expect(cd?.terraformCompoundLocal).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
  });

  it("parents intra-region TFD arrow under region frame", async () => {
    const nodes = {
      "aws_s3_bucket.a": node("aws_s3_bucket.a", "aws_s3_bucket"),
      "aws_sqs_queue.b": node("aws_sqs_queue.b", "aws_sqs_queue"),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_s3_bucket.a",
          target: "aws_sqs_queue.b",
          sequence: 0,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const plan = {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket", { region: "us-east-1" }),
        rc("aws_sqs_queue.b", "aws_sqs_queue", { region: "us-east-1" }),
      ],
    };

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
    );
    const arrow = scene.elements.find(
      (el) =>
        (el.type === "arrow" || el.type === "line") &&
        (el as { customData?: { terraformEdgeLayer?: string } }).customData
          ?.terraformEdgeLayer === "declaredDataFlow",
    );
    expect(arrow?.frameId).toBeTruthy();

    const roles = frameRoleChain(scene.elements, arrow?.frameId ?? null);
    expect(roles).toContain("region");

    const regionFrame = scene.elements.find(
      (el) =>
        el.type === "frame" &&
        (el as { customData?: { terraformTopologyRole?: string } }).customData
          ?.terraformTopologyRole === "region",
    );
    expect(regionFrame).toBeTruthy();
    const descendants = getFrameDescendants(scene.elements, regionFrame!.id);
    expect(descendants.some((el) => el.id === arrow?.id)).toBe(true);
  });

  it("preserves TFD column order after re-anchor", async () => {
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

    const plan = {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket", { region: "us-east-1" }),
        rc("aws_sqs_queue.b", "aws_sqs_queue", { region: "us-east-1" }),
        rc("aws_dynamodb_table.c", "aws_dynamodb_table", {
          region: "us-east-1",
        }),
      ],
    };

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
    );
    expect(resourceX(scene.elements, "aws_s3_bucket.a")).toBeLessThan(
      resourceX(scene.elements, "aws_sqs_queue.b"),
    );
    expect(resourceX(scene.elements, "aws_sqs_queue.b")).toBeLessThan(
      resourceX(scene.elements, "aws_dynamodb_table.c"),
    );
  });

  it("parents cross-region TFD arrow under account frame", async () => {
    const nodes = {
      "aws_lambda_function.a": node(
        "aws_lambda_function.a",
        "aws_lambda_function",
      ),
      "aws_lambda_function.b": node(
        "aws_lambda_function.b",
        "aws_lambda_function",
      ),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_lambda_function.a",
          target: "aws_lambda_function.b",
          sequence: 0,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const plan = {
      configuration: {
        provider_config: {
          aws: {
            expressions: {
              assume_role: [
                {
                  role_arn: {
                    constant_value: "arn:aws:iam::111111111111:role/Deploy",
                  },
                },
              ],
            },
          },
        },
      },
      resource_changes: [
        rc("aws_lambda_function.a", "aws_lambda_function", {
          region: "us-east-1",
          vpc_id: "vpc-east",
          subnet_ids: ["subnet-east-a"],
        }),
        rc("aws_lambda_function.b", "aws_lambda_function", {
          region: "us-west-2",
          vpc_id: "vpc-west",
          subnet_ids: ["subnet-west-a"],
        }),
      ],
    };

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
    );
    const arrow = scene.elements.find(
      (el) =>
        (el.type === "arrow" || el.type === "line") &&
        (el as { customData?: { terraformEdgeLayer?: string } }).customData
          ?.terraformEdgeLayer === "declaredDataFlow",
    );
    expect(arrow?.frameId).toBeTruthy();
    const parentFrame = scene.elements.find((el) => el.id === arrow?.frameId);
    expect(
      (parentFrame as { customData?: { terraformTopologyRole?: string } })
        ?.customData?.terraformTopologyRole,
    ).toBe("account");
    const roles = frameRoleChain(scene.elements, arrow?.frameId ?? null);
    expect(roles).toContain("account");
    expect(roles).toContain("provider");
  });

  it("matches classic roleChain after hierarchical re-anchor", async () => {
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

    const plan = {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket", { region: "us-east-1" }),
        rc("aws_sqs_queue.b", "aws_sqs_queue", { region: "us-east-1" }),
        rc("aws_dynamodb_table.c", "aws_dynamodb_table", {
          region: "us-east-1",
        }),
      ],
    };

    const classic = await buildTerraformPipelineExcalidrawScene(nodes, plan);
    const compound = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
    );

    for (const clusterId of [
      "aws_s3_bucket.a",
      "aws_sqs_queue.b",
      "aws_dynamodb_table.c",
    ]) {
      const classicEl = classic.elements.find(
        (e) =>
          (e as { customData?: { nodePath?: string } }).customData?.nodePath ===
          clusterId,
      );
      const compoundEl = compound.elements.find(
        (e) =>
          (e as { customData?: { nodePath?: string } }).customData?.nodePath ===
          clusterId,
      );
      expect(classicEl).toBeTruthy();
      expect(compoundEl).toBeTruthy();
      expect(
        frameRoleChain(compound.elements, compoundEl?.frameId ?? null),
      ).toEqual(frameRoleChain(classic.elements, classicEl?.frameId ?? null));
    }
  });
});
