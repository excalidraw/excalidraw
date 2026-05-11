import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { TerraformTopologyModel } from "./terraformTopologyExtract";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";
import type {
  TopologyPlacementZone,
  TopologyRegionalPrimaryBucket,
} from "./terraformTopologyPlacement";

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
function assertTopologyFramesContainChildren(elements: readonly ExcalidrawElement[]) {
  const eps = 4;
  const frames = elements.filter(
    (e) =>
      e.type === "frame" &&
      (e.customData as { terraformTopologyRole?: string } | undefined)
        ?.terraformTopologyRole,
  );

  for (const frame of frames) {
    const kids = elements.filter(
      (e) => e.frameId === frame.id && !e.isDeleted,
    );
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
    expect(
      fb.minX,
      `frame ${frame.id} left vs children`,
    ).toBeLessThanOrEqual(minX + eps);
    expect(
      fb.minY,
      `frame ${frame.id} top vs children`,
    ).toBeLessThanOrEqual(minY + eps);
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
        e.type === "line" &&
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
    expect(rects.length).toBeGreaterThan(0);
    expect(
      rects.some((r) => zoneFrames.some((zf) => zf.id === r.frameId)),
    ).toBe(true);

    assertTopologyFramesContainChildren(elements);
  });

  it("places Lambda IAM satellites left of center and SG column right, with rules under SG", async () => {
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
          (e.customData as { nodePath?: string } | undefined)?.nodePath === path,
      );

    const lambda = rectByPath("aws_lambda_function.fn");
    const role = rectByPath("aws_iam_role.fn_role");
    const sg = rectByPath("aws_security_group.app");
    const rule = rectByPath("aws_vpc_security_group_ingress_rule.ssh");
    expect(lambda && role && sg && rule).toBeTruthy();

    const lambdaMid = lambda!.x + (lambda!.width ?? 0) / 2;
    const roleMid = role!.x + (role!.width ?? 0) / 2;
    const sgMid = sg!.x + (sg!.width ?? 0) / 2;
    expect(roleMid).toBeLessThan(lambdaMid);
    expect(sgMid).toBeGreaterThan(lambdaMid);

    const roleRight = role!.x + (role!.width ?? 0);
    expect(sg!.x - roleRight).toBeGreaterThanOrEqual(6);

    expect(rule!.y).toBeGreaterThanOrEqual(sg!.y + (sg!.height ?? 0) - 2);

    const rels = elements
      .filter(
        (e) =>
          e.type === "line" &&
          (e.customData as { terraformEdgeLayer?: string } | undefined)
            ?.terraformEdgeLayer === "dataFlow",
      )
      .map((e) => e.customData?.relationship as Record<string, unknown> | undefined);

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

  it("places regional primaries in Regional services frame when region has no VPCs", async () => {
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

    const regionalFrames = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "regionalServices",
    );
    expect(regionalFrames.length).toBe(1);

    const rects = elements.filter(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformVisibilityRole?: string } | undefined)
          ?.terraformVisibilityRole === "resource",
    );
    expect(rects.length).toBe(1);
    expect(rects[0]!.frameId).toBe(regionalFrames[0]!.id);

    assertTopologyFramesContainChildren(elements);
  });

  it("lays out Regional services beside VPC grid in the same region", async () => {
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
    ).toBe(true);
    expect(
      elements.some(
        (e) =>
          e.type === "frame" &&
          (e.customData as { terraformTopologyRole?: string } | undefined)
            ?.terraformTopologyRole === "subnetZone",
      ),
    ).toBe(true);

    assertTopologyFramesContainChildren(elements);
  });
});
