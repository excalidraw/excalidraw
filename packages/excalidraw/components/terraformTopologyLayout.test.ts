import { describe, expect, it } from "vitest";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";

import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";

import { tfComfortPx } from "./terraformLayoutComfort";

import type { TerraformTopologyModel } from "./terraformTopologyExtract";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

import type {
  TopologyPlacementZone,
  TopologyRegionalPrimaryBucket,
  TopologyRouteTableBottomPlacements,
  TopologyVpcEndpointBucket,
} from "./terraformTopologyPlacement";

const px = tfComfortPx;

/** Matches compact egress / route-table tile half-height in terraformTopologyLayout. */
const TOPOLOGY_EDGE_TILE_HALF_H = Math.ceil(px(56) / 2);

function isTopologyFrame(
  element: ExcalidrawElement,
  role?: string,
): element is ExcalidrawFrameElement {
  if (element.type !== "frame") {
    return false;
  }
  const topologyRole = (
    element.customData as { terraformTopologyRole?: string } | undefined
  )?.terraformTopologyRole;
  return role ? topologyRole === role : !!topologyRole;
}

function axisBounds(el: ExcalidrawElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const w = el.width ?? 0;
  const h = el.height ?? 0;
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + w,
    maxY: el.y + h,
  };
}

/** Topology frames must visually contain direct child frames (Excalidraw contract when x/y + explicit w/h set). */
function assertTopologyFramesContainChildren(
  elements: readonly ExcalidrawElement[],
) {
  const eps = 4;
  const frames = elements.filter((e) => isTopologyFrame(e));

  for (const frame of frames) {
    const kids = elements.filter((e) => e.frameId === frame.id && !e.isDeleted);
    if (kids.length === 0) {
      continue;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of kids) {
      const b = axisBounds(c);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const fb = axisBounds(frame);
    expect(fb.minX, `frame ${frame.id} left vs children`).toBeLessThanOrEqual(
      minX + eps,
    );
    expect(fb.minY, `frame ${frame.id} top vs children`).toBeLessThanOrEqual(
      minY + eps,
    );
    expect(
      fb.maxX,
      `frame ${frame.id} right vs children`,
    ).toBeGreaterThanOrEqual(maxX - eps);
    expect(
      fb.maxY,
      `frame ${frame.id} bottom vs children`,
    ).toBeGreaterThanOrEqual(maxY - eps);
  }
}

describe("buildTerraformTopologyExcalidrawScene", () => {
  it("parent frames contain direct children after conversion", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                          ["subnet-b", { subnetId: "subnet-b" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      [],
      [],
      {},
    );
    expect(meta.layoutEngine).toBe("topology");
    expect(meta.regionalPrimaryCount).toBe(0);
    expect(meta.vpcEndpointCount).toBe(0);
    expect(meta.routeTableCount).toBe(0);
    expect(meta.dependencyEdgeCount).toBe(0);
    expect(elements.length).toBeGreaterThan(0);
    assertTopologyFramesContainChildren(elements);
  });

  it("places primary resource rectangles inside subnet zone frames", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                          ["subnet-b", { subnetId: "subnet-b" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-a|subnet-b",
        subnetIds: ["subnet-a", "subnet-b"],
        addresses: ["aws_lambda_function.fn"],
      },
    ];

    const roleArn = "arn:aws:iam::111111111111:role/tf-topo-test-role";
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["update"],
              after: { role: roleArn },
            },
          },
        },
      },
      "aws_iam_role.fn_role": {
        resources: {
          "aws_iam_role.fn_role": {
            address: "aws_iam_role.fn_role",
            mode: "managed",
            type: "aws_iam_role",
            name: "fn_role",
            change: {
              actions: ["no-op"],
              after: { arn: roleArn, name: "fn_role" },
            },
          },
        },
      },
      "aws_iam_role_policy.logs": {
        resources: {
          "aws_iam_role_policy.logs": {
            address: "aws_iam_role_policy.logs",
            mode: "managed",
            type: "aws_iam_role_policy",
            change: {
              actions: ["no-op"],
              after: { role: "fn_role", name: "logs" },
            },
          },
        },
      },
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      nodes,
    );

    expect(meta.primaryResourceCount).toBe(1);
    expect(meta.regionalPrimaryCount).toBe(0);

    const dataFlowEdges = elements.filter(
      (e) =>
        e.type === "arrow" &&
        (e.customData as { terraformEdgeLayer?: string } | undefined)
          ?.terraformEdgeLayer === "dataFlow",
    );
    expect(dataFlowEdges.length).toBeGreaterThan(0);
    const rel = dataFlowEdges[0]!.customData?.relationship as {
      source?: string;
      target?: string;
    };
    expect(rel?.source).toBe("aws_lambda_function.fn");
    expect(rel?.target).toBe("aws_iam_role.fn_role");

    const zoneFrames = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "subnetZone",
    );
    expect(zoneFrames.length).toBeGreaterThan(0);

    const rects = elements.filter(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformVisibilityRole?: string } | undefined)
          ?.terraformVisibilityRole === "resource",
    );
    const primaryClusterFrames = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "primaryCluster",
    );
    expect(primaryClusterFrames.length).toBeGreaterThan(0);
    const zoneFrameIds = new Set(zoneFrames.map((z) => z.id));
    for (const cf of primaryClusterFrames) {
      expect(zoneFrameIds.has(cf.frameId ?? "")).toBe(true);
    }
    const clusterIds = new Set(primaryClusterFrames.map((c) => c.id));
    for (const r of rects) {
      const topoRole = (
        r.customData as { terraformTopologyRole?: string } | undefined
      )?.terraformTopologyRole;
      if (
        topoRole === "vpcRouteTable" ||
        topoRole === "subnetZoneRouteTable" ||
        topoRole === "vpcEgressEndpoint"
      ) {
        continue;
      }
      expect(r.frameId && clusterIds.has(r.frameId)).toBe(true);
    }

    assertTopologyFramesContainChildren(elements);
  });

  it("emits dependency edges between placed primaries using merged edges_new", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                          ["subnet-b", { subnetId: "subnet-b" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-a|subnet-b",
        subnetIds: ["subnet-a", "subnet-b"],
        addresses: ["aws_s3_bucket.a", "aws_s3_bucket.b"],
      },
    ];

    const nodes: TerraformPlanNodesMap = {
      "aws_s3_bucket.a": {
        resources: {
          "aws_s3_bucket.a": {
            address: "aws_s3_bucket.a",
            mode: "managed",
            type: "aws_s3_bucket",
            change: { actions: ["no-op"] },
          },
        },
        edges_new: ["aws_s3_bucket.b"],
        edges_existing: [],
      },
      "aws_s3_bucket.b": {
        resources: {
          "aws_s3_bucket.b": {
            address: "aws_s3_bucket.b",
            mode: "managed",
            type: "aws_s3_bucket",
            change: { actions: ["no-op"] },
          },
        },
        edges_new: [],
        edges_existing: [],
      },
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      nodes,
    );

    expect(meta.dependencyEdgeCount).toBe(1);
    expect(meta.primaryResourceCount).toBe(2);

    const dependencyLines = elements.filter(
      (e) =>
        e.type === "arrow" &&
        (e.customData as { terraformEdgeLayer?: string } | undefined)
          ?.terraformEdgeLayer === "dependency",
    );
    expect(dependencyLines.length).toBeGreaterThanOrEqual(1);
    const rel = dependencyLines[0]!.customData?.relationship as {
      source?: string;
      target?: string;
    };
    expect(rel?.source).toBe("aws_s3_bucket.a");
    expect(rel?.target).toBe("aws_s3_bucket.b");

    const sourceRect = elements.find(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformVisibilityKey?: string } | undefined)
          ?.terraformVisibilityKey === rel?.source,
    );
    const targetRect = elements.find(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformVisibilityKey?: string } | undefined)
          ?.terraformVisibilityKey === rel?.target,
    );
    const edge = dependencyLines[0] as ExcalidrawArrowElement;
    expect(sourceRect).toBeDefined();
    expect(targetRect).toBeDefined();
    expect(edge.startBinding?.elementId).toBe(sourceRect!.id);
    expect(edge.endBinding?.elementId).toBe(targetRect!.id);
  });

  it("renders aws_vpc_endpoint egress tiles on VPC body bottom with meta count", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                          ["subnet-b", { subnetId: "subnet-b" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-a|subnet-b",
        subnetIds: ["subnet-a", "subnet-b"],
        addresses: ["aws_lambda_function.fn"],
      },
    ];

    const vpcEndpointBuckets: TopologyVpcEndpointBucket[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        addresses: ['aws_vpc_endpoint.ep["logs"]', 'aws_vpc_endpoint.ep["s3"]'],
      },
    ];

    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: { actions: ["no-op"], after: {} },
          },
        },
      },
      'aws_vpc_endpoint.ep["logs"]': {
        resources: {
          'aws_vpc_endpoint.ep["logs"]': {
            address: 'aws_vpc_endpoint.ep["logs"]',
            mode: "managed",
            type: "aws_vpc_endpoint",
            change: {
              actions: ["no-op"],
              after: {
                arn: "arn:aws:ec2:us-east-1:111111111111:vpc-endpoint/vpce-logs",
                vpc_id: "vpc-test",
                service_name: "com.amazonaws.us-east-1.logs",
              },
            },
          },
        },
      },
      'aws_vpc_endpoint.ep["s3"]': {
        resources: {
          'aws_vpc_endpoint.ep["s3"]': {
            address: 'aws_vpc_endpoint.ep["s3"]',
            mode: "managed",
            type: "aws_vpc_endpoint",
            change: {
              actions: ["no-op"],
              after: {
                arn: "arn:aws:ec2:us-east-1:111111111111:vpc-endpoint/vpce-s3",
                vpc_id: "vpc-test",
                service_name: "com.amazonaws.us-east-1.s3",
              },
            },
          },
        },
      },
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      nodes,
      undefined,
      vpcEndpointBuckets,
    );

    expect(meta.vpcEndpointCount).toBe(2);

    const egressRects = elements.filter(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "vpcEgressEndpoint",
    );
    expect(egressRects.length).toBe(2);
    for (const r of egressRects) {
      expect((r as { strokeStyle?: string }).strokeStyle).toBe("dashed");
    }

    const vpcFrames = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "vpc",
    );
    const vpc = vpcFrames.find(
      (f) =>
        (f.customData as { terraformTopologyPath?: string[] } | undefined)
          ?.terraformTopologyPath?.[2] === "vpc-test",
    );
    expect(vpc).toBeDefined();
    const vpcEl = vpc!;
    const vpcBodyBottom =
      vpcEl.y + (vpcEl.height ?? 0) - TOPOLOGY_EDGE_TILE_HALF_H;
    const eps = 6;
    for (const r of egressRects) {
      const h = r.height ?? 0;
      const midY = r.y + h / 2;
      expect(
        Math.abs(midY - vpcBodyBottom),
        "egress tile vertical center on VPC body bottom line",
      ).toBeLessThanOrEqual(eps);
      expect(r.frameId).toBe(vpcEl.id);
    }

    assertTopologyFramesContainChildren(elements);
  });

  it("uses VPC and subnet names from plan tags for topology frame labels", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-123",
                      {
                        vpcId: "vpc-123",
                        subnets: new Map([
                          ["subnet-aaa", { subnetId: "subnet-aaa" }],
                          ["subnet-bbb", { subnetId: "subnet-bbb" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-123",
        subnetSignature: "subnet-aaa|subnet-bbb",
        subnetIds: ["subnet-aaa", "subnet-bbb"],
        addresses: [],
      },
    ];
    const plan = {
      resource_changes: [
        {
          type: "aws_vpc",
          change: { after: { id: "vpc-123", tags: { Name: "workload-vpc" } } },
        },
        {
          type: "aws_subnet",
          change: { after: { id: "subnet-aaa", tags: { Name: "public-a" } } },
        },
        {
          type: "aws_subnet",
          change: { after: { id: "subnet-bbb", tags: { Name: "public-b" } } },
        },
      ],
    };

    const { elements } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      {},
      plan,
    );

    const vpcFrame = elements.find((e) => isTopologyFrame(e, "vpc"));
    const subnetFrame = elements.find((e) => isTopologyFrame(e, "subnetZone"));

    expect(vpcFrame?.name).toBe("VPC: workload-vpc");
    expect(subnetFrame?.name).toBe("Subnets: public-a, public-b");
  });

  it("orders VPC-only, public, intra, and private zones from left to right", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-123",
                      {
                        vpcId: "vpc-123",
                        subnets: new Map([
                          ["subnet-pub-a", { subnetId: "subnet-pub-a" }],
                          ["subnet-intra-a", { subnetId: "subnet-intra-a" }],
                          ["subnet-priv-a", { subnetId: "subnet-priv-a" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-123",
        subnetSignature: "subnet-priv-a",
        subnetIds: ["subnet-priv-a"],
        addresses: [],
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-123",
        subnetSignature: "",
        subnetIds: [],
        addresses: [],
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-123",
        subnetSignature: "subnet-intra-a",
        subnetIds: ["subnet-intra-a"],
        addresses: [],
      },
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-123",
        subnetSignature: "subnet-pub-a",
        subnetIds: ["subnet-pub-a"],
        addresses: [],
      },
    ];
    const plan = {
      resource_changes: [
        {
          type: "aws_subnet",
          change: {
            after: { id: "subnet-pub-a", tags: { Name: "app-public-a" } },
          },
        },
        {
          type: "aws_subnet",
          change: {
            after: { id: "subnet-intra-a", tags: { Name: "app-intra-a" } },
          },
        },
        {
          type: "aws_subnet",
          change: {
            after: { id: "subnet-priv-a", tags: { Name: "app-private-a" } },
          },
        },
      ],
    };

    const { elements } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      {},
      plan,
    );
    const subnetFrames = elements
      .filter((e) => isTopologyFrame(e, "subnetZone"))
      .sort((a, b) => a.x - b.x);

    expect(subnetFrames.map((f) => f.name)).toEqual([
      "VPC-only placement",
      "Subnets: app-public-a",
      "Subnets: app-intra-a",
      "Subnets: app-private-a",
    ]);
  });

  it("places IGW on the VPC left edge and NAT/EIP on the right edge", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-public", { subnetId: "subnet-public" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };
    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-public",
        subnetIds: ["subnet-public"],
        addresses: [],
      },
    ];
    const nodes: TerraformPlanNodesMap = {
      "aws_internet_gateway.igw": {
        resources: {
          "aws_internet_gateway.igw": {
            address: "aws_internet_gateway.igw",
            mode: "managed",
            type: "aws_internet_gateway",
            change: { actions: ["no-op"], after: { vpc_id: "vpc-test" } },
          },
        },
      },
      "aws_nat_gateway.nat": {
        resources: {
          "aws_nat_gateway.nat": {
            address: "aws_nat_gateway.nat",
            mode: "managed",
            type: "aws_nat_gateway",
            change: {
              actions: ["no-op"],
              after: { subnet_id: "subnet-public" },
            },
          },
        },
      },
      "aws_eip.nat": {
        resources: {
          "aws_eip.nat": {
            address: "aws_eip.nat",
            mode: "managed",
            type: "aws_eip",
            change: { actions: ["no-op"], after: { id: "eipalloc-1" } },
          },
        },
      },
    };
    const defaultBuckets = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        addresses: [
          "aws_internet_gateway.igw",
          "aws_nat_gateway.nat",
          "aws_eip.nat",
        ],
      },
    ];

    const { elements } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      nodes,
      undefined,
      [],
      { zoneBottom: [], vpcBottom: [] },
      defaultBuckets,
    );

    const byPath = (path: string) =>
      elements.find(
        (e) =>
          e.type === "rectangle" &&
          (e.customData as { nodePath?: string } | undefined)?.nodePath ===
            path,
      );
    const vpc = elements.find(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "vpc",
    )!;
    const igw = byPath("aws_internet_gateway.igw")!;
    const nat = byPath("aws_nat_gateway.nat")!;
    const eip = byPath("aws_eip.nat")!;

    expect(igw.x).toBe(vpc.x);
    expect(nat.x + (nat.width ?? 0)).toBe(vpc.x + (vpc.width ?? 0));
    expect(eip.x + (eip.width ?? 0)).toBe(vpc.x + (vpc.width ?? 0));
    expect(igw.frameId).toBe(vpc.id);
    expect(nat.frameId).toBe(vpc.id);
    expect(eip.frameId).toBe(vpc.id);
    assertTopologyFramesContainChildren(elements);
  });

  it("places unassociated route table tiles on the VPC body bottom edge", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                          ["subnet-b", { subnetId: "subnet-b" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-a|subnet-b",
        subnetIds: ["subnet-a", "subnet-b"],
        addresses: ["aws_lambda_function.fn"],
      },
    ];

    const routeTableBottomPlacements: TopologyRouteTableBottomPlacements = {
      zoneBottom: [],
      vpcBottom: [
        {
          accountId: "111111111111",
          region: "us-east-1",
          vpcId: "vpc-test",
          addresses: ["module.vpc.aws_route_table.main"],
        },
      ],
    };

    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: { actions: ["no-op"], after: {} },
          },
        },
      },
      "module.vpc.aws_route_table.main": {
        resources: {
          "module.vpc.aws_route_table.main": {
            address: "module.vpc.aws_route_table.main",
            mode: "managed",
            type: "aws_route_table",
            change: {
              actions: ["no-op"],
              after: {
                arn: "arn:aws:ec2:us-east-1:111111111111:route-table/rtb-1",
                vpc_id: "vpc-test",
                id: "rtb-1",
                tags: { Name: "main" },
              },
            },
          },
        },
      },
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      nodes,
      undefined,
      [],
      routeTableBottomPlacements,
    );

    expect(meta.routeTableCount).toBe(1);

    const rtRects = elements.filter(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "vpcRouteTable",
    );
    expect(rtRects.length).toBe(1);

    const vpcFrames = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "vpc",
    );
    const vpc = vpcFrames.find(
      (f) =>
        (f.customData as { terraformTopologyPath?: string[] } | undefined)
          ?.terraformTopologyPath?.[2] === "vpc-test",
    )!;
    expect(vpc).toBeDefined();
    const vpcEl = vpc!;
    const vpcBodyBottom =
      vpcEl.y + (vpcEl.height ?? 0) - TOPOLOGY_EDGE_TILE_HALF_H;
    const eps = 6;
    const rt = rtRects[0]!;
    const h = rt.height ?? 0;
    const midY = rt.y + h / 2;
    expect(
      Math.abs(midY - vpcBodyBottom),
      "route table tile vertical center on VPC body bottom line",
    ).toBeLessThanOrEqual(eps);
    expect(rt.frameId).toBe(vpcEl.id);

    assertTopologyFramesContainChildren(elements);
  });

  it("places Lambda IAM stack (tier-1 role, tier-2 policies) and SG column with tier-2 rules", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                          ["subnet-b", { subnetId: "subnet-b" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-a|subnet-b",
        subnetIds: ["subnet-a", "subnet-b"],
        addresses: ["aws_lambda_function.fn"],
      },
    ];

    const roleArn = "arn:aws:iam::111111111111:role/tf-topo-test-role";
    const sgArn =
      "arn:aws:ec2:us-east-1:111111111111:security-group/sg-0layouttest";
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["update"],
              after: {
                role: roleArn,
                vpc_config: [
                  {
                    subnet_ids: ["subnet-a", "subnet-b"],
                    security_group_ids: ["sg-0layouttest"],
                  },
                ],
              },
            },
          },
        },
      },
      "aws_iam_role.fn_role": {
        resources: {
          "aws_iam_role.fn_role": {
            address: "aws_iam_role.fn_role",
            mode: "managed",
            type: "aws_iam_role",
            name: "fn_role",
            change: {
              actions: ["no-op"],
              after: { arn: roleArn, name: "fn_role" },
            },
          },
        },
      },
      "aws_iam_role_policy.logs": {
        resources: {
          "aws_iam_role_policy.logs": {
            address: "aws_iam_role_policy.logs",
            mode: "managed",
            type: "aws_iam_role_policy",
            change: {
              actions: ["no-op"],
              after: { role: "fn_role", name: "logs" },
            },
          },
        },
      },
      "aws_security_group.app": {
        resources: {
          "aws_security_group.app": {
            address: "aws_security_group.app",
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["no-op"],
              after: {
                id: "sg-0layouttest",
                arn: sgArn,
                vpc_id: "vpc-test",
              },
            },
          },
        },
      },
      "aws_vpc_security_group_ingress_rule.ssh": {
        resources: {
          "aws_vpc_security_group_ingress_rule.ssh": {
            address: "aws_vpc_security_group_ingress_rule.ssh",
            mode: "managed",
            type: "aws_vpc_security_group_ingress_rule",
            change: {
              actions: ["no-op"],
              after: { security_group_id: "sg-0layouttest" },
            },
          },
        },
      },
    };

    const { elements } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      nodes,
    );

    const rectByPath = (path: string) =>
      elements.find(
        (e) =>
          e.type === "rectangle" &&
          (e.customData as { nodePath?: string } | undefined)?.nodePath ===
            path,
      );

    const lambda = rectByPath("aws_lambda_function.fn");
    const role = rectByPath("aws_iam_role.fn_role");
    const policy = rectByPath("aws_iam_role_policy.logs");
    const sg = rectByPath("aws_security_group.app");
    const rule = rectByPath("aws_vpc_security_group_ingress_rule.ssh");
    expect(lambda && role && policy && sg && rule).toBeTruthy();

    const clusterId = lambda!.frameId;
    expect(clusterId).toBeTruthy();
    expect(role!.frameId).toBe(clusterId);
    expect(policy!.frameId).toBe(clusterId);
    expect(sg!.frameId).toBe(clusterId);
    expect(rule!.frameId).toBe(clusterId);
    const clusterFrame = elements.find(
      (e) => e.type === "frame" && e.id === clusterId,
    );
    expect(
      (
        clusterFrame?.customData as
          | { terraformTopologyRole?: string }
          | undefined
      )?.terraformTopologyRole,
    ).toBe("primaryCluster");

    expect(lambda!.width).toBe(px(200));
    expect(lambda!.height).toBe(px(88));

    expect(role!.x).toBe(lambda!.x);
    expect(role!.width).toBe(px(176));
    expect(role!.height).toBe(px(52));

    expect(policy!.width).toBe(px(154));
    expect(policy!.height).toBeLessThanOrEqual(role!.height ?? 0);
    expect(policy!.y).toBeGreaterThanOrEqual(role!.y + (role!.height ?? 0) - 2);

    const lambdaMid = lambda!.x + (lambda!.width ?? 0) / 2;
    const sgMid = sg!.x + (sg!.width ?? 0) / 2;
    expect(sgMid).toBeGreaterThan(lambdaMid);

    const roleRight = role!.x + (role!.width ?? 0);
    expect(sg!.x - roleRight).toBe(px(8));

    expect(sg!.width).toBe(px(176));
    expect(sg!.height).toBe(px(52));

    expect(rule!.width).toBe(px(154));
    expect(rule!.height).toBeLessThanOrEqual(sg!.height ?? 0);
    expect(rule!.y).toBeGreaterThanOrEqual(sg!.y + (sg!.height ?? 0) - 2);

    const rels = elements
      .filter(
        (e) =>
          e.type === "arrow" &&
          (e.customData as { terraformEdgeLayer?: string } | undefined)
            ?.terraformEdgeLayer === "dataFlow",
      )
      .map(
        (e) =>
          e.customData?.relationship as Record<string, unknown> | undefined,
      );

    expect(
      rels.some(
        (r) =>
          r?.origin === "topology_sg" &&
          r?.type === "security_group" &&
          r?.source === "aws_lambda_function.fn" &&
          r?.target === "aws_security_group.app",
      ),
    ).toBe(true);
    expect(
      rels.some(
        (r) =>
          r?.origin === "topology_sg" &&
          r?.type === "sg_rule" &&
          r?.source === "aws_security_group.app" &&
          r?.target === "aws_vpc_security_group_ingress_rule.ssh",
      ),
    ).toBe(true);

    assertTopologyFramesContainChildren(elements);
  });

  it("places Lambda CloudWatch alarms above-left and log groups above-right", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-a",
        subnetIds: ["subnet-a"],
        addresses: ["aws_lambda_function.fn"],
      },
    ];

    const roleArn = "arn:aws:iam::111111111111:role/tf-topo-test-role";
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["update"],
              after: {
                function_name: "test-reader",
                role: roleArn,
              },
            },
          },
        },
      },
      "aws_cloudwatch_metric_alarm.errors": {
        resources: {
          "aws_cloudwatch_metric_alarm.errors": {
            address: "aws_cloudwatch_metric_alarm.errors",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            change: {
              actions: ["no-op"],
              after: {
                namespace: "AWS/Lambda",
                metric_name: "Errors",
                dimensions: { FunctionName: "test-reader" },
              },
            },
          },
        },
      },
      "aws_cloudwatch_log_group.lambda": {
        resources: {
          "aws_cloudwatch_log_group.lambda": {
            address: "aws_cloudwatch_log_group.lambda",
            mode: "managed",
            type: "aws_cloudwatch_log_group",
            change: {
              actions: ["no-op"],
              after: { name: "/aws/lambda/test-reader" },
            },
          },
        },
      },
      "aws_iam_role.fn_role": {
        resources: {
          "aws_iam_role.fn_role": {
            address: "aws_iam_role.fn_role",
            mode: "managed",
            type: "aws_iam_role",
            name: "fn_role",
            change: {
              actions: ["no-op"],
              after: { arn: roleArn, name: "fn_role" },
            },
          },
        },
      },
      "aws_iam_role_policy.logs": {
        resources: {
          "aws_iam_role_policy.logs": {
            address: "aws_iam_role_policy.logs",
            mode: "managed",
            type: "aws_iam_role_policy",
            change: {
              actions: ["no-op"],
              after: { role: "fn_role", name: "logs" },
            },
          },
        },
      },
    };

    const { elements } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      [],
      nodes,
    );

    const rectByPath = (path: string) =>
      elements.find(
        (e) =>
          e.type === "rectangle" &&
          (e.customData as { nodePath?: string } | undefined)?.nodePath ===
            path,
      );

    const lambda = rectByPath("aws_lambda_function.fn");
    const alarm = rectByPath("aws_cloudwatch_metric_alarm.errors");
    const logGroup = rectByPath("aws_cloudwatch_log_group.lambda");
    const role = rectByPath("aws_iam_role.fn_role");
    expect(lambda && alarm && logGroup && role).toBeTruthy();

    const lambdaMid = lambda!.x + (lambda!.width ?? 0) / 2;
    const alarmMid = alarm!.x + (alarm!.width ?? 0) / 2;
    const logGroupMid = logGroup!.x + (logGroup!.width ?? 0) / 2;
    expect(alarmMid).toBeLessThan(lambdaMid);
    expect(logGroupMid).toBeGreaterThan(lambdaMid);
    expect(alarm!.y + (alarm!.height ?? 0)).toBeLessThanOrEqual(lambda!.y);
    expect(logGroup!.y + (logGroup!.height ?? 0)).toBeLessThanOrEqual(
      lambda!.y,
    );
    expect(role!.y).toBeGreaterThanOrEqual(lambda!.y + (lambda!.height ?? 0));

    const rels = elements
      .filter(
        (e) =>
          e.type === "arrow" &&
          (e.customData as { terraformEdgeLayer?: string } | undefined)
            ?.terraformEdgeLayer === "dataFlow",
      )
      .map(
        (e) =>
          e.customData?.relationship as Record<string, unknown> | undefined,
      );

    expect(
      rels.some(
        (r) =>
          r?.origin === "topology_cloudwatch" &&
          r?.type === "cloudwatch_alarm" &&
          r?.source === "aws_cloudwatch_metric_alarm.errors" &&
          r?.target === "aws_lambda_function.fn",
      ),
    ).toBe(true);
    expect(
      rels.some(
        (r) =>
          r?.origin === "topology_cloudwatch" &&
          r?.type === "cloudwatch_log_group" &&
          r?.source === "aws_cloudwatch_log_group.lambda" &&
          r?.target === "aws_lambda_function.fn",
      ),
    ).toBe(true);

    assertTopologyFramesContainChildren(elements);
  });

  it("places CloudWatch alarms above non-Lambda resources", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map(),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const regionalBuckets: TopologyRegionalPrimaryBucket[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        addresses: ["aws_s3_bucket.data"],
      },
    ];

    const nodes: TerraformPlanNodesMap = {
      "aws_s3_bucket.data": {
        resources: {
          "aws_s3_bucket.data": {
            address: "aws_s3_bucket.data",
            mode: "managed",
            type: "aws_s3_bucket",
            change: {
              actions: ["no-op"],
              after: {
                bucket: "ts-test-lambda-data",
                id: "ts-test-lambda-data",
              },
            },
          },
        },
      },
      "aws_cloudwatch_metric_alarm.bucket_size": {
        resources: {
          "aws_cloudwatch_metric_alarm.bucket_size": {
            address: "aws_cloudwatch_metric_alarm.bucket_size",
            mode: "managed",
            type: "aws_cloudwatch_metric_alarm",
            change: {
              actions: ["no-op"],
              after: {
                namespace: "AWS/S3",
                dimensions: {
                  BucketName: "ts-test-lambda-data",
                  StorageType: "StandardStorage",
                },
              },
            },
          },
        },
      },
    };

    const { elements } = await buildTerraformTopologyExcalidrawScene(
      model,
      [],
      regionalBuckets,
      nodes,
    );

    const rectByPath = (path: string) =>
      elements.find(
        (e) =>
          e.type === "rectangle" &&
          (e.customData as { nodePath?: string } | undefined)?.nodePath ===
            path,
      );

    const bucket = rectByPath("aws_s3_bucket.data");
    const alarm = rectByPath("aws_cloudwatch_metric_alarm.bucket_size");
    expect(bucket && alarm).toBeTruthy();
    expect(alarm!.y + (alarm!.height ?? 0)).toBeLessThanOrEqual(bucket!.y);

    const rels = elements
      .filter(
        (e) =>
          e.type === "arrow" &&
          (e.customData as { terraformEdgeLayer?: string } | undefined)
            ?.terraformEdgeLayer === "dataFlow",
      )
      .map(
        (e) =>
          e.customData?.relationship as Record<string, unknown> | undefined,
      );

    expect(
      rels.some(
        (r) =>
          r?.origin === "topology_cloudwatch" &&
          r?.type === "cloudwatch_alarm" &&
          r?.source === "aws_cloudwatch_metric_alarm.bucket_size" &&
          r?.target === "aws_s3_bucket.data",
      ),
    ).toBe(true);

    assertTopologyFramesContainChildren(elements);
  });

  it("places regional primaries directly under region frame when region has no VPCs", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map(),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const regionalBuckets: TopologyRegionalPrimaryBucket[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        addresses: ["aws_s3_bucket.data"],
      },
    ];

    const nodes: TerraformPlanNodesMap = {
      "aws_s3_bucket.data": {
        resources: {
          "aws_s3_bucket.data": {
            address: "aws_s3_bucket.data",
            mode: "managed",
            type: "aws_s3_bucket",
          },
        },
      },
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      [],
      regionalBuckets,
      nodes,
    );

    expect(meta.regionalPrimaryCount).toBe(1);
    expect(meta.primaryResourceCount).toBe(1);

    expect(
      elements.filter(
        (e) =>
          e.type === "frame" &&
          (e.customData as { terraformTopologyRole?: string } | undefined)
            ?.terraformTopologyRole === "regionalServices",
      ).length,
    ).toBe(0);

    const regionFrames = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "region",
    );
    expect(regionFrames.length).toBe(1);

    const rects = elements.filter(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformVisibilityRole?: string } | undefined)
          ?.terraformVisibilityRole === "resource",
    );
    expect(rects.length).toBe(1);

    const primaryClusterFrames = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "primaryCluster",
    );
    expect(primaryClusterFrames.length).toBe(1);
    expect(rects[0]!.frameId).toBe(primaryClusterFrames[0]!.id);
    expect(primaryClusterFrames[0]!.frameId).toBe(regionFrames[0]!.id);

    assertTopologyFramesContainChildren(elements);
  });

  it("places aws_kms_key_policy satellites under a regional KMS key with topology_kms edges", async () => {
    const keyId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const keyArn = `arn:aws:kms:us-east-1:111111111111:key/${keyId}`;

    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map(),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const regionalBuckets: TopologyRegionalPrimaryBucket[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        addresses: ["aws_kms_key.main"],
      },
    ];

    const nodes: TerraformPlanNodesMap = {
      "aws_kms_key.main": {
        resources: {
          "aws_kms_key.main": {
            address: "aws_kms_key.main",
            mode: "managed",
            type: "aws_kms_key",
            change: {
              after: { id: keyId, arn: keyArn },
            },
          },
        },
      },
      "aws_kms_key_policy.main": {
        resources: {
          "aws_kms_key_policy.main": {
            address: "aws_kms_key_policy.main",
            mode: "managed",
            type: "aws_kms_key_policy",
            change: {
              after: { key_id: keyId, policy: "{}" },
            },
          },
        },
      },
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      [],
      regionalBuckets,
      nodes,
    );

    expect(meta.regionalPrimaryCount).toBe(1);
    expect(meta.primaryResourceCount).toBe(1);

    const rectByPath = (path: string) =>
      elements.find(
        (e) =>
          e.type === "rectangle" &&
          (e.customData as { nodePath?: string } | undefined)?.nodePath ===
            path,
      );

    const keyRect = rectByPath("aws_kms_key.main");
    const policyRect = rectByPath("aws_kms_key_policy.main");
    expect(keyRect && policyRect).toBeTruthy();
    expect(policyRect!.y).toBeGreaterThanOrEqual(keyRect!.y);
    expect(keyRect!.frameId).toBe(policyRect!.frameId);
    const kmsCluster = elements.find(
      (e) => e.type === "frame" && e.id === keyRect!.frameId,
    );
    expect(
      (kmsCluster?.customData as { terraformTopologyRole?: string } | undefined)
        ?.terraformTopologyRole,
    ).toBe("primaryCluster");

    const kmsEdge = elements
      .filter(
        (e) =>
          e.type === "arrow" &&
          (e.customData as { terraformEdgeLayer?: string } | undefined)
            ?.terraformEdgeLayer === "dataFlow",
      )
      .map(
        (e) =>
          e.customData?.relationship as Record<string, unknown> | undefined,
      )
      .find(
        (r) =>
          r?.origin === "topology_kms" &&
          r?.type === "kms_key_policy" &&
          r?.source === "aws_kms_key.main" &&
          r?.target === "aws_kms_key_policy.main",
      );
    expect(kmsEdge).toBeTruthy();

    assertTopologyFramesContainChildren(elements);
  });

  it("lays out regional primaries below the VPC grid in the same region", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const zones: TopologyPlacementZone[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: "vpc-test",
        subnetSignature: "subnet-a",
        subnetIds: ["subnet-a"],
        addresses: ["aws_lambda_function.fn"],
      },
    ];

    const regionalBuckets: TopologyRegionalPrimaryBucket[] = [
      {
        accountId: "111111111111",
        region: "us-east-1",
        addresses: ["aws_sqs_queue.jobs"],
      },
    ];

    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
          },
        },
      },
      "aws_sqs_queue.jobs": {
        resources: {
          "aws_sqs_queue.jobs": {
            address: "aws_sqs_queue.jobs",
            mode: "managed",
            type: "aws_sqs_queue",
          },
        },
      },
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(
      model,
      zones,
      regionalBuckets,
      nodes,
    );

    expect(meta.primaryResourceCount).toBe(2);
    expect(meta.regionalPrimaryCount).toBe(1);

    expect(
      elements.some(
        (e) =>
          e.type === "frame" &&
          (e.customData as { terraformTopologyRole?: string } | undefined)
            ?.terraformTopologyRole === "regionalServices",
      ),
    ).toBe(false);
    expect(
      elements.some(
        (e) =>
          e.type === "frame" &&
          (e.customData as { terraformTopologyRole?: string } | undefined)
            ?.terraformTopologyRole === "subnetZone",
      ),
    ).toBe(true);

    const vpcFrame = elements.find(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "vpc",
    );
    const regionalRect = elements.find(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { nodePath?: string } | undefined)?.nodePath ===
          "aws_sqs_queue.jobs",
    );
    expect(vpcFrame).toBeTruthy();
    expect(regionalRect).toBeTruthy();
    expect(regionalRect!.y).toBeGreaterThan(
      vpcFrame!.y + (vpcFrame!.height ?? 0),
    );

    assertTopologyFramesContainChildren(elements);
  });
});
