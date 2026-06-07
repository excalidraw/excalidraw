import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  buildTerraformElkExcalidrawScene,
  buildTerraformResourcePanelDetails,
  strokeColorForTerraformDependencyEdge,
} from "./terraformElkLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import { collapseAllTerraformExplode } from "./terraformVisibility";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

function minimalNode(
  resources: Record<string, unknown>,
): TerraformPlanGraphNode {
  return { resources };
}

describe("strokeColorForTerraformDependencyEdge", () => {
  it("prefers delete over new/existing hues", () => {
    expect(
      strokeColorForTerraformDependencyEdge({
        hasNew: true,
        hasExisting: false,
        sourceAction: "delete",
      }),
    ).toBe("#ff8787");
  });

  it("uses replace orange when no delete on endpoints (even if existing+new)", () => {
    expect(
      strokeColorForTerraformDependencyEdge({
        hasNew: true,
        hasExisting: true,
        sourceAction: "replace",
        targetAction: "create",
      }),
    ).toBe("#ffa94d");
  });

  it("treats existing+new as blue when no delete/replace", () => {
    expect(
      strokeColorForTerraformDependencyEdge({
        hasNew: true,
        hasExisting: true,
      }),
    ).toBe("#4dabf7");
  });
});

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

function getLabeledContainer(
  elements: Awaited<
    ReturnType<typeof buildTerraformElkExcalidrawScene>
  >["elements"],
  addressOrSuffix: string,
) {
  return elements.find(
    (element: any) =>
      element.type === "rectangle" &&
      element.customData?.terraformVisibilityRole === "resource" &&
      (element.customData?.terraformVisibilityKey === addressOrSuffix ||
        (typeof element.customData?.terraformVisibilityKey === "string" &&
          element.customData.terraformVisibilityKey.endsWith(
            `.${addressOrSuffix}`,
          ))),
  );
}

/** Detached card title; AWS icon sub-shapes may reuse visibility keys without this role. */
function getTerraformResourceTitleLabel(
  elements: readonly ExcalidrawElement[],
  nodePath: string,
): ExcalidrawElement | undefined {
  return elements.find(
    (e) =>
      e.type === "text" &&
      e.customData?.terraformVisibilityRole === "resource" &&
      e.customData?.nodePath === nodePath,
  );
}

function oneResourceNodes(
  address: string,
  resource: Record<string, unknown>,
): TerraformPlanNodesMap {
  return {
    [address]: minimalNode({ [address]: { address, ...resource } }),
    [TERRAFORM_MODULE_TREE_KEY]: {
      path: "root",
      modules: {},
      resourceAddresses: [address],
    },
  } as unknown as TerraformPlanNodesMap;
}

async function getTerraformResourceDetails(
  address: string,
  resource: Record<string, unknown>,
) {
  const { elements } = await buildTerraformElkExcalidrawScene(
    oneResourceNodes(address, resource),
  );
  const rect = getLabeledContainer(elements, address);
  return rect?.customData?.terraformResources?.[0];
}

async function getTerraformResourceRect(
  address: string,
  resource: Record<string, unknown>,
) {
  const { elements } = await buildTerraformElkExcalidrawScene(
    oneResourceNodes(address, resource),
  );
  return getLabeledContainer(elements, address);
}

describe("buildTerraformElkExcalidrawScene", () => {
  it("lays out a nested module tree and returns rectangles plus lines", async () => {
    const nodes = {
      "aws_s3_bucket.root": minimalNode({
        "aws_s3_bucket.root": { address: "aws_s3_bucket.root" },
      }),
      "module.network.aws_vpc.main": minimalNode({
        "module.network.aws_vpc.main": {
          address: "module.network.aws_vpc.main",
        },
      }),
      "module.network.aws_subnet.a": minimalNode({
        "module.network.aws_subnet.a": {
          address: "module.network.aws_subnet.a",
        },
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
    (
      nodes["module.network.aws_vpc.main"] as { edges_new?: string[] }
    ).edges_new = ["module.network.aws_subnet.a"];

    const { elements, meta } = await buildTerraformElkExcalidrawScene(nodes);

    expect(meta.layoutEngine).toBe("elk");
    expect(meta.skippedLayout).toBeUndefined();
    expect(meta.vertexCount).toBe(3);
    expect(meta.edgeCount).toBe(2);
    expect(elements.length).toBeGreaterThan(0);
    const rects = elements.filter(
      (e) =>
        e.type === "rectangle" &&
        (e as { customData?: { terraformVisibilityRole?: string } }).customData
          ?.terraformVisibilityRole === "resource",
    );
    const tfEdges = elements.filter(
      (e) =>
        e.type === "arrow" &&
        (e as { customData?: { terraformEdgeLayer?: string } }).customData
          ?.terraformEdgeLayer,
    );
    const frames = elements.filter((e) => e.type === "frame");
    expect(rects.length).toBe(3);
    expect(tfEdges.length).toBeGreaterThanOrEqual(1);
    expect(frames.length).toBeGreaterThanOrEqual(2);

    const rootFrame = frames.find((e) => e.name === "Root module");
    const networkFrame = frames.find((e) => e.name === "module.network");
    const networkVpc = getLabeledContainer(elements, "aws_vpc.main");

    expect(rootFrame).toBeDefined();
    expect(networkFrame).toBeDefined();
    expect(networkVpc).toBeDefined();
    expect(rootFrame!.frameId).toBe(null);
    expect(networkFrame!.frameId).toBe(rootFrame!.id);
    expect(networkVpc!.frameId).toBe(networkFrame!.id);

    const resourceRect = getLabeledContainer(elements, "aws_s3_bucket.root");
    expect(resourceRect?.customData).toMatchObject({
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: "aws_s3_bucket.root",
      terraformNodeKind: "resource",
      terraformInitiallyVisible: true,
      terraformExplodeParentKeys: expect.arrayContaining([
        "module.network.aws_vpc.main",
      ]),
      nodePath: "aws_s3_bucket.root",
      resourceType: "aws_s3_bucket",
    });
    const labelEl = getTerraformResourceTitleLabel(
      elements,
      String(resourceRect?.customData?.nodePath ?? ""),
    );
    expect((labelEl as { strokeColor?: string })?.strokeColor).toBe("#1e1e1e");
    expect((labelEl as { containerId?: string | null })?.containerId).toBe(
      null,
    );
    expect(resourceRect?.customData?.terraformResources).toEqual([
      expect.objectContaining({
        address: "aws_s3_bucket.root",
        type: "aws_s3_bucket",
      }),
    ]);

    expect(tfEdges[0].customData).toMatchObject({
      terraform: true,
      terraformEdgeLayer: "dependency",
      relationship: expect.objectContaining({
        source: expect.any(String),
        target: expect.any(String),
        type: "dependency",
      }),
    });
    expect((tfEdges[0] as any).startArrowhead).toBe(null);
    expect((tfEdges[0] as any).endArrowhead).toBe("arrow");
    // Edges sit behind everything (incl. frames), then frames, then resource rects.
    expect(
      Math.max(...tfEdges.map((edge) => elements.indexOf(edge))),
    ).toBeLessThan(Math.min(...frames.map((frame) => elements.indexOf(frame))));
    expect(
      Math.max(...frames.map((frame) => elements.indexOf(frame))),
    ).toBeLessThan(Math.min(...rects.map((rect) => elements.indexOf(rect))));
  });

  it("pins AWS icon glyphs to resource card frame and group", async () => {
    const nodes = {
      "module.network.aws_vpc.main": minimalNode({
        "module.network.aws_vpc.main": {
          address: "module.network.aws_vpc.main",
          type: "aws_vpc",
        },
      }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {
          "module.network": {
            path: "module.network",
            modules: {},
            resourceAddresses: ["module.network.aws_vpc.main"],
          },
        },
        resourceAddresses: [],
      },
    } as unknown as TerraformPlanNodesMap;

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);
    const vpcRect = getLabeledContainer(elements, "aws_vpc.main");
    expect(vpcRect).toBeDefined();
    expect(vpcRect!.frameId).toBeTruthy();

    const label = getTerraformResourceTitleLabel(
      elements,
      String(vpcRect!.customData?.nodePath ?? ""),
    );
    expect(label).toBeDefined();

    const glyphs = elements.filter(
      (e) =>
        (e as { customData?: { terraformAwsIconGlyph?: boolean } }).customData
          ?.terraformAwsIconGlyph === true,
    );
    expect(glyphs.length).toBeGreaterThan(0);

    for (const g of glyphs) {
      expect(g.frameId).toBe(vpcRect!.frameId);
      expect(g.groupIds.slice(0, vpcRect!.groupIds.length)).toEqual(
        vpcRect!.groupIds,
      );
    }
    expect(label!.groupIds).toEqual(vpcRect!.groupIds);
    expect(glyphs[0]!.opacity).toBe(vpcRect!.opacity ?? 100);
  });

  it("emits data-flow lines when edges_data_flow is populated", async () => {
    const q = "aws_sqs_queue.jobs";
    const fn = "aws_lambda_function.fn";
    const nodes = {
      [q]: {
        resources: {
          [q]: {
            address: q,
            type: "aws_sqs_queue",
            name: "jobs",
            mode: "managed",
            change: {
              actions: ["create"],
              after: { name: "jobs", arn: "arn:aws:sqs:us-east-1:123:jobs" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      [fn]: {
        resources: {
          [fn]: {
            address: fn,
            type: "aws_lambda_function",
            name: "fn",
            mode: "managed",
            change: { actions: ["create"], after: { function_name: "fn" } },
          },
        },
        edges_new: [q],
        edges_existing: [],
        edges_data_flow: [
          {
            target: q,
            type: "triggers",
            label: "triggers",
            origin: "terraform_resource",
            detail: "aws_lambda_event_source_mapping",
          },
        ],
      },
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {},
        resourceAddresses: [fn, q].sort(),
      },
    } as unknown as TerraformPlanNodesMap;

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);
    const dataFlowLines = elements.filter(
      (el) =>
        el.type === "arrow" &&
        (el as { customData?: { terraformEdgeLayer?: string } }).customData
          ?.terraformEdgeLayer === "dataFlow",
    );
    expect(dataFlowLines.length).toBeGreaterThan(0);
    expect((dataFlowLines[0] as { strokeColor?: string }).strokeColor).toBe(
      "#868e96",
    );
  });

  it.each([
    ["new-only", { edges_new: ["aws_s3_bucket.b"] }, "#69db7c"],
    ["prior-only", { edges_existing: ["aws_s3_bucket.b"] }, "#4dabf7"],
    [
      "existing-over-new",
      { edges_new: ["aws_s3_bucket.b"], edges_existing: ["aws_s3_bucket.b"] },
      "#4dabf7",
    ],
  ] as const)(
    "colors dependency edge by origin (%s)",
    async (_label, edgeProps, expectedStroke) => {
      const a = "aws_s3_bucket.a";
      const b = "aws_s3_bucket.b";
      const nodes = {
        [a]: minimalNode({ [a]: { address: a } }),
        [b]: minimalNode({ [b]: { address: b } }),
        [TERRAFORM_MODULE_TREE_KEY]: {
          path: "root",
          modules: {},
          resourceAddresses: [a, b],
        },
      } as unknown as TerraformPlanNodesMap;

      Object.assign(
        nodes[a] as TerraformPlanGraphNode & Record<string, unknown>,
        edgeProps,
      );

      const { elements } = await buildTerraformElkExcalidrawScene(nodes);
      const depLine = elements.find(
        (el) =>
          el.type === "arrow" &&
          (el as { customData?: { terraformEdgeLayer?: string } }).customData
            ?.terraformEdgeLayer === "dependency",
      );
      expect(depLine).toBeDefined();
      expect((depLine as { strokeColor?: string }).strokeColor).toBe(
        expectedStroke,
      );
    },
  );

  it("draws DOT edges between networking primitives as terraformEdgeLayer networking", async () => {
    const vpc = "aws_vpc.main";
    const igw = "aws_internet_gateway.main";
    const nodes = {
      [vpc]: minimalNode({
        [vpc]: {
          address: vpc,
          type: "aws_vpc",
          name: "main",
          mode: "managed",
        },
      }),
      [igw]: minimalNode({
        [igw]: {
          address: igw,
          type: "aws_internet_gateway",
          name: "main",
          mode: "managed",
        },
      }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {},
        resourceAddresses: [vpc, igw],
      },
    } as unknown as TerraformPlanNodesMap;

    (
      nodes[vpc] as TerraformPlanGraphNode & { edges_new?: string[] }
    ).edges_new = [igw];

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);
    const netLine = elements.find(
      (el) =>
        el.type === "arrow" &&
        (el as { customData?: { terraformEdgeLayer?: string } }).customData
          ?.terraformEdgeLayer === "networking" &&
        (el as { customData?: { relationship?: { type?: string } } }).customData
          ?.relationship?.type === "networking_dependency",
    );
    expect(netLine).toBeDefined();
    expect((netLine as { strokeColor?: string }).strokeColor).toBe("#228be6");
    expect(
      elements.some(
        (el) =>
          el.type === "arrow" &&
          (el as { customData?: { terraformEdgeLayer?: string } }).customData
            ?.terraformEdgeLayer === "dependency",
      ),
    ).toBe(false);
  });

  it("keeps nested module frame membership nearest-parent only", async () => {
    const nodes = {
      "module.network.aws_vpc.main": minimalNode({
        "module.network.aws_vpc.main": {
          address: "module.network.aws_vpc.main",
        },
      }),
      "module.network.module.subnets.aws_subnet.a": minimalNode({
        "module.network.module.subnets.aws_subnet.a": {
          address: "module.network.module.subnets.aws_subnet.a",
        },
      }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {
          "module.network": {
            path: "module.network",
            modules: {
              "module.network.module.subnets": {
                path: "module.network.module.subnets",
                modules: {},
                resourceAddresses: [
                  "module.network.module.subnets.aws_subnet.a",
                ],
              },
            },
            resourceAddresses: ["module.network.aws_vpc.main"],
          },
        },
        resourceAddresses: [],
      },
    } as unknown as TerraformPlanNodesMap;

    (
      nodes["module.network.aws_vpc.main"] as { edges_new?: string[] }
    ).edges_new = ["module.network.module.subnets.aws_subnet.a"];

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);

    const rootFrame = elements.find(
      (e) => e.type === "frame" && e.name === "Root module",
    );
    const networkFrame = elements.find(
      (e) => e.type === "frame" && e.name === "module.network",
    );
    const subnetsFrame = elements.find(
      (e) => e.type === "frame" && e.name === "module.network.module.subnets",
    );
    const vpc = getLabeledContainer(elements, "aws_vpc.main");
    const subnet = getLabeledContainer(elements, "aws_subnet.a");

    expect(rootFrame).toBeDefined();
    expect(networkFrame).toBeDefined();
    expect(subnetsFrame).toBeDefined();
    expect(vpc).toBeDefined();
    expect(subnet).toBeDefined();
    expect(rootFrame!.frameId).toBe(null);
    expect(networkFrame!.frameId).toBe(rootFrame!.id);
    expect(subnetsFrame!.frameId).toBe(networkFrame!.id);
    expect(vpc!.frameId).toBe(networkFrame!.id);
    expect(subnet!.frameId).toBe(subnetsFrame!.id);
  });

  it("keeps sibling module frames from expanding over cross-module lines", async () => {
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
    (
      nodes["module.data.aws_sqs_queue.queue"] as { edges_new?: string[] }
    ).edges_new = ["module.api.aws_cloudwatch_log_group.logs"];

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);

    const apiFrame = elements.find(
      (e) => e.type === "frame" && e.name === "module.api",
    );
    const dataFrame = elements.find(
      (e) => e.type === "frame" && e.name === "module.data",
    );
    const tfEdges = elements.filter(
      (e) =>
        e.type === "arrow" &&
        (e as { customData?: { terraformEdgeLayer?: string } }).customData
          ?.terraformEdgeLayer,
    );

    expect(apiFrame).toBeDefined();
    expect(dataFrame).toBeDefined();
    expect(tfEdges.length).toBe(2);
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
      (
        many[TERRAFORM_MODULE_TREE_KEY] as { resourceAddresses: string[] }
      ).resourceAddresses.push(id);
    }

    const { elements, meta } = await buildTerraformElkExcalidrawScene(many);
    expect(meta.skippedLayout).toBe(true);
    expect(meta.skipReason).toContain("vertex_count");
    expect(elements.length).toBe(0);
  });

  it.each([
    ["create", ["create"], "#ebfbee", "#69db7c"],
    ["update", ["update"], "#fff9db", "#ffd43b"],
    ["delete", ["delete"], "#fff5f5", "#ff8787"],
    ["no-op", ["no-op"], "#e7f5ff", "#4dabf7"],
    ["existing", ["existing"], "#f8f9fa", "#868e96"],
    ["replace", ["delete", "create"], "#fff4e6", "#ffa94d"],
  ])(
    "styles %s resources by Terraform action",
    async (expectedAction, actions, backgroundColor, strokeColor) => {
      const rect = await getTerraformResourceRect("aws_s3_bucket.root", {
        type: "aws_s3_bucket",
        change: { actions },
      });

      expect(rect).toMatchObject({
        backgroundColor,
        strokeColor,
        customData: {
          action: expectedAction,
        },
      });
    },
  );

  it("populates local Terraform resource config from change.after", async () => {
    const details = await getTerraformResourceDetails("aws_s3_bucket.root", {
      type: "aws_s3_bucket",
      mode: "managed",
      name: "root",
      change: {
        actions: ["create"],
        after: {
          bucket: "example-bucket",
          force_destroy: false,
        },
      },
    });

    expect(details).toMatchObject({
      address: "aws_s3_bucket.root",
      type: "aws_s3_bucket",
      name: "root",
      mode: "managed",
      actions: ["create"],
      attributes: [
        expect.objectContaining({
          key: "bucket",
          value: "example-bucket",
          changed: true,
          before: null,
          after: "example-bucket",
        }),
        expect.objectContaining({
          key: "force_destroy",
          value: false,
          changed: true,
          before: null,
          after: false,
        }),
      ],
    });
  });

  it("marks computed before/after differences as changed", async () => {
    const details = await getTerraformResourceDetails("aws_instance.web", {
      type: "aws_instance",
      change: {
        actions: ["update"],
        before: { instance_type: "t3.micro", ami: "ami-1" },
        after: { instance_type: "t3.small", ami: "ami-1" },
      },
    });

    expect(details?.attributes).toEqual([
      expect.objectContaining({
        key: "instance_type",
        value: "t3.small",
        changed: true,
        before: "t3.micro",
        after: "t3.small",
      }),
      expect.objectContaining({
        key: "ami",
        value: "ami-1",
        changed: false,
      }),
    ]);
  });

  it("update with hollow environment shell uses placeholder not empty map", () => {
    const addr =
      "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
    const [details] = buildTerraformResourcePanelDetails(addr, {
      type: "aws_lambda_function",
      address: addr,
      change: {
        actions: ["update"],
        before: {
          environment: [
            { variables: { DATA_BUCKET: "bucket", test: "test1" } },
          ],
        },
        after: { environment: [{}] },
        after_unknown: { environment: [{ variables: true }] },
      },
    });
    const env = details?.attributes?.find((a) => a.key === "environment");
    expect(env).toEqual(
      expect.objectContaining({
        key: "environment",
        value: "Known after apply",
        unknownAfter: true,
        changed: true,
        before: [{ variables: { DATA_BUCKET: "bucket", test: "test1" } }],
        after: "Known after apply",
      }),
    );
  });

  it("update with hollow environment includes intent preview when plan is provided", () => {
    const addr =
      "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
    const [details] = buildTerraformResourcePanelDetails(
      addr,
      {
        type: "aws_lambda_function",
        address: addr,
        change: {
          actions: ["update"],
          before: {
            environment: [
              { variables: { DATA_BUCKET: "bucket", test: "test1" } },
            ],
          },
          after: { environment: [{}] },
          after_unknown: { environment: [{ variables: true }] },
        },
      },
      {
        format_version: "1.2",
        resource_changes: [
          {
            address:
              "module.application_data_bucket.module.bucket.aws_s3_bucket.this[0]",
            type: "aws_s3_bucket",
            change: {
              actions: ["no-op"],
              before: { id: "bucket" },
            },
          },
          {
            address:
              "module.application_job_queue.module.queue.aws_sqs_queue.this[0]",
            type: "aws_sqs_queue",
            change: { actions: ["create"], before: null },
          },
        ],
        configuration: {
          root_module: {
            module_calls: {
              workload_writer_lambda: {
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
      },
    );
    const env = details?.attributes?.find((a) => a.key === "environment");
    const preview = env?.unknownAfterPreview ?? [];
    expect(preview).toHaveLength(1);
    expect(preview[0]).toEqual(
      expect.objectContaining({
        key: "queue_url",
        kind: "new",
        resolvesTo: "module.application_job_queue.queue_url",
      }),
    );
    expect(preview.find((r) => r.key === "DATA_BUCKET")).toBeUndefined();
    expect(preview.find((r) => r.key === "test")).toBeUndefined();
  });

  it("emits unknown-after rows using the placeholder", async () => {
    const details = await getTerraformResourceDetails(
      "aws_lambda_function.fn",
      {
        type: "aws_lambda_function",
        change: {
          actions: ["create"],
          after: { function_name: "fn" },
          after_unknown: {
            arn: true,
            environment: [{ variables: { build_id: true } }],
          },
        },
      },
    );

    expect(details?.attributes?.slice(0, 2)).toEqual([
      expect.objectContaining({
        key: "arn",
        value: "Known after apply",
        unknownAfter: true,
      }),
      expect.objectContaining({
        key: "environment",
        value: "Known after apply",
        unknownAfter: true,
      }),
    ]);
  });

  it("omits empty config values unless changed or unknown-after", async () => {
    const details = await getTerraformResourceDetails("aws_security_group.sg", {
      type: "aws_security_group",
      change: {
        actions: ["update"],
        before: {
          description: "old",
          name: "sg",
          tags: { env: "prod" },
        },
        after: {
          description: "",
          ingress: [],
          egress: {},
          name: "sg",
          tags: {},
        },
        after_unknown: {
          arn: true,
        },
      },
    });

    expect(details?.attributes?.map((attribute: any) => attribute.key)).toEqual(
      ["arn", "description", "tags", "name"],
    );
  });

  it("hides backend-parity fields for aws_iam_role_policy", async () => {
    const details = await getTerraformResourceDetails(
      "aws_iam_role_policy.inline",
      {
        type: "aws_iam_role_policy",
        change: {
          actions: ["create"],
          after: {
            id: "hidden-id",
            name_prefix: "hidden-prefix",
            policy: "{}",
            role: "app-role",
          },
        },
      },
    );

    expect(details?.attributes?.map((attribute: any) => attribute.key)).toEqual(
      ["policy", "role"],
    );
  });

  it("sets terraformExplodeParentKeys from dependency edges (undirected)", async () => {
    const a = "aws_s3_bucket.a";
    const b = "aws_s3_bucket.b";
    const nodes = {
      [a]: minimalNode({ [a]: { address: a, type: "aws_s3_bucket" } }),
      [b]: minimalNode({ [b]: { address: b, type: "aws_s3_bucket" } }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {},
        resourceAddresses: [a, b],
      },
    } as unknown as TerraformPlanNodesMap;
    (nodes[a] as TerraformPlanGraphNode).edges_new = [b];

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);
    const rectA = elements.find(
      (e) =>
        e.type === "rectangle" &&
        (e as { customData?: { terraformVisibilityKey?: string } }).customData
          ?.terraformVisibilityKey === a,
    );
    const rectB = elements.find(
      (e) =>
        e.type === "rectangle" &&
        (e as { customData?: { terraformVisibilityKey?: string } }).customData
          ?.terraformVisibilityKey === b,
    );
    expect(
      (rectA as { customData?: { terraformExplodeParentKeys?: string[] } })
        .customData?.terraformExplodeParentKeys,
    ).toEqual([b]);
    expect(
      (rectB as { customData?: { terraformExplodeParentKeys?: string[] } })
        .customData?.terraformExplodeParentKeys,
    ).toEqual([a]);
  });

  it("extends explode neighbors with data-flow edges when present", async () => {
    const a = "aws_s3_bucket.a";
    const b = "aws_lambda_function.b";
    const c = "aws_sqs_queue.c";
    const nodes = {
      [a]: minimalNode({ [a]: { address: a, type: "aws_s3_bucket" } }),
      [b]: minimalNode({ [b]: { address: b, type: "aws_lambda_function" } }),
      [c]: minimalNode({ [c]: { address: c, type: "aws_sqs_queue" } }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {},
        resourceAddresses: [a, b, c],
      },
    } as unknown as TerraformPlanNodesMap;
    (nodes[a] as TerraformPlanGraphNode).edges_new = [b];
    Object.assign(
      nodes[b] as TerraformPlanGraphNode,
      {
        edges_data_flow: [{ target: c, type: "invoke", label: "q" }],
      } as Record<string, unknown>,
    );

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);
    const rectB = elements.find(
      (e) =>
        e.type === "rectangle" &&
        (e as { customData?: { terraformVisibilityKey?: string } }).customData
          ?.terraformVisibilityKey === b,
    );
    const parents =
      (rectB as { customData?: { terraformExplodeParentKeys?: string[] } })
        .customData?.terraformExplodeParentKeys ?? [];
    expect(parents.sort()).toEqual([a, c].sort());
  });

  it("shows managed no-op non-primary resources by default", async () => {
    const address = "aws_iam_role.dummy";
    const { elements } = await buildTerraformElkExcalidrawScene(
      oneResourceNodes(address, {
        address,
        type: "aws_iam_role",
        change: { actions: ["no-op"] },
      }),
    );
    const rect = elements.find(
      (e) =>
        e.type === "rectangle" &&
        (e as { customData?: { terraformVisibilityKey?: string } }).customData
          ?.terraformVisibilityKey === address,
    );
    expect(rect?.isDeleted).toBe(false);
    expect(
      (rect as { customData?: { terraformInitiallyVisible?: boolean } })
        .customData?.terraformInitiallyVisible,
    ).toBe(true);
    const label = elements.find(
      (e) =>
        e.type === "text" &&
        (e as { customData?: { terraformVisibilityKey?: string } }).customData
          ?.terraformVisibilityKey === address,
    );
    expect(label?.isDeleted).toBe(false);
    expect((label as { containerId?: string | null })?.containerId).toBe(null);
    const labelParents =
      (label as { customData?: { terraformExplodeParentKeys?: string[] } })
        .customData?.terraformExplodeParentKeys ?? [];
    expect(labelParents).toEqual([]);
  });

  it("shows managed non-primary resources and labels by default", async () => {
    const fixtures = [
      ["aws_iam_role_policy.created", ["create"], false],
      ["aws_iam_role_policy.updated", ["update"], false],
      ["aws_iam_role_policy.deleted", ["delete"], false],
      ["aws_iam_role_policy.replaced", ["delete", "create"], false],
      ["aws_iam_role_policy.noop", ["no-op"], false],
      ["aws_iam_role_policy.existing", ["existing"], false],
      ["aws_iam_role_policy.read", ["read"], false],
      ["aws_iam_role_policy.external", ["external"], false],
    ] as const;

    for (const [address, actions, expectedDeleted] of fixtures) {
      const { elements } = await buildTerraformElkExcalidrawScene(
        oneResourceNodes(address, {
          address,
          type: "aws_iam_role_policy",
          change: { actions, after: { policy: "{}" } },
        }),
      );
      const rect = elements.find(
        (e) =>
          e.type === "rectangle" &&
          (e as { customData?: { terraformVisibilityKey?: string } }).customData
            ?.terraformVisibilityKey === address,
      );
      const label = elements.find(
        (e) =>
          e.type === "text" &&
          (e as { customData?: { terraformVisibilityKey?: string } }).customData
            ?.terraformVisibilityKey === address,
      );

      expect(rect?.isDeleted).toBe(expectedDeleted);
      expect(label?.isDeleted).toBe(expectedDeleted);
      expect(
        (rect as { customData?: { terraformInitiallyVisible?: boolean } })
          .customData?.terraformInitiallyVisible,
      ).toBe(!expectedDeleted);
    }
  });

  it("restores changed non-primary resources when collapsing to default visibility", async () => {
    const address = "aws_iam_role_policy.updated";
    const { elements } = await buildTerraformElkExcalidrawScene(
      oneResourceNodes(address, {
        address,
        type: "aws_iam_role_policy",
        change: { actions: ["update"], after: { policy: "{}" } },
      }),
    );
    const hidden = elements.map((element) =>
      element.customData?.terraformVisibilityKey === address
        ? { ...element, isDeleted: true }
        : element,
    );

    const collapsed = collapseAllTerraformExplode(hidden);
    const rect = collapsed.find(
      (e) =>
        e.type === "rectangle" &&
        (e as { customData?: { terraformVisibilityKey?: string } }).customData
          ?.terraformVisibilityKey === address,
    );
    const label = getTerraformResourceTitleLabel(collapsed, address);

    expect(rect?.isDeleted).toBe(false);
    expect(label?.isDeleted).toBe(false);
  });

  it("supports ELK box and rectpacking module packing modes", async () => {
    const nodes = {
      "aws_s3_bucket.root": minimalNode({
        "aws_s3_bucket.root": { address: "aws_s3_bucket.root" },
      }),
      "module.network.aws_vpc.main": minimalNode({
        "module.network.aws_vpc.main": {
          address: "module.network.aws_vpc.main",
        },
      }),
      [TERRAFORM_MODULE_TREE_KEY]: {
        path: "root",
        modules: {
          "module.network": {
            path: "module.network",
            modules: {},
            resourceAddresses: ["module.network.aws_vpc.main"],
          },
        },
        resourceAddresses: ["aws_s3_bucket.root"],
      },
    } as unknown as TerraformPlanNodesMap;

    for (const mode of ["box", "rectpacking"] as const) {
      const { elements, meta } = await buildTerraformElkExcalidrawScene(
        nodes,
        undefined,
        { mode },
      );
      expect(meta.modulePacking?.mode).toBe(mode);
      expect(elements.filter((e) => e.type === "frame").length).toBeGreaterThan(
        1,
      );

      const rootBucket = getLabeledContainer(elements, "aws_s3_bucket.root");
      const nestedVpc = getLabeledContainer(elements, "aws_vpc.main");
      const networkFrame = elements.find(
        (e) => e.type === "frame" && e.name === "module.network",
      );
      expect(rootBucket).toBeDefined();
      expect(nestedVpc).toBeDefined();
      expect(networkFrame).toBeDefined();
      if (rootBucket && nestedVpc && networkFrame) {
        expect(rootBucket.y).toBeGreaterThanOrEqual(
          networkFrame.y + networkFrame.height,
        );
      }
    }
  });
});
