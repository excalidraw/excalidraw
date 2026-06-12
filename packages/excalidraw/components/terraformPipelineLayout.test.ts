import { describe, expect, it } from "vitest";

import {
  buildTerraformCompoundPipelineExcalidrawScene,
  buildTerraformPipelineExcalidrawScene,
} from "./terraformPipelineLayout";
import { collectAncillaryAddresses } from "./terraformPipelineLayoutAncillary";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
import {
  buildEnrichedTopologyPlacements,
  topologyAddressPlacementMap,
} from "./terraformTopologyPlacementBuild";

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
  provider_name: "registry.terraform.io/hashicorp/aws",
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

  it("resolves IGW, NAT, and SSM account/region/VPC in placement map", () => {
    const igw = rc("aws_internet_gateway.this", "aws_internet_gateway", {
      vpc_id: "vpc-aaa",
      region: "us-east-1",
    });
    const nat = rc("aws_nat_gateway.this", "aws_nat_gateway", {
      subnet_id: "subnet-public-a",
      region: "us-east-1",
    });
    const subnetPublic = rc("aws_subnet.public_a", "aws_subnet", {
      id: "subnet-public-a",
      vpc_id: "vpc-aaa",
      region: "us-east-1",
    });
    const ssm = rc(
      "module.api.aws_ssm_parameter.api_name",
      "aws_ssm_parameter",
      {
        region: "us-east-1",
      },
    );
    const lambda = rc(
      "module.api.module.lambda.aws_lambda_function.this[0]",
      "aws_lambda_function",
      {
        vpc_id: "vpc-aaa",
        subnet_ids: ["subnet-private-a"],
        region: "us-east-1",
      },
    );
    const subnetPrivate = rc("aws_subnet.private_a", "aws_subnet", {
      id: "subnet-private-a",
      vpc_id: "vpc-aaa",
      region: "us-east-1",
    });
    const vpc = rc("aws_vpc.main", "aws_vpc", {
      id: "vpc-aaa",
      region: "us-east-1",
    });
    const plan = {
      configuration: {
        provider_config: {
          aws: {
            name: "aws",
            expressions: {
              region: { constant_value: "us-east-1" },
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
        vpc,
        subnetPublic,
        subnetPrivate,
        igw,
        nat,
        ssm,
        lambda,
      ],
    };
    const nodes = {
      "aws_internet_gateway.this": nodeFromRc(igw),
      "aws_nat_gateway.this": nodeFromRc(nat),
      "module.api.aws_ssm_parameter.api_name": nodeFromRc(ssm),
      "module.api.module.lambda.aws_lambda_function.this[0]":
        nodeFromRc(lambda),
    } as unknown as TerraformPlanNodesMap;

    const enriched = buildEnrichedTopologyPlacements(plan, nodes);
    const map = topologyAddressPlacementMap(enriched, plan);

    expect(map.get("aws_internet_gateway.this")).toMatchObject({
      providerFamily: "aws",
      accountId: "111111111111",
      region: "us-east-1",
      vpcId: "vpc-aaa",
    });
    expect(map.get("aws_nat_gateway.this")).toMatchObject({
      providerFamily: "aws",
      accountId: "111111111111",
      region: "us-east-1",
      vpcId: "vpc-aaa",
    });
    expect(map.get("module.api.aws_ssm_parameter.api_name")).toMatchObject({
      providerFamily: "aws",
      accountId: "111111111111",
      region: "us-east-1",
      vpcId: null,
    });
  });

  it("sets pipelineVariant classic in meta", async () => {
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

    const scene = await buildTerraformPipelineExcalidrawScene(nodes, {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket"),
        rc("aws_sqs_queue.b", "aws_sqs_queue"),
      ],
    });

    expect(scene.meta.pipelineVariant).toBe("classic");
  });
});

describe("buildTerraformCompoundPipelineExcalidrawScene", () => {
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

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(nodes, {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket"),
        rc("aws_sqs_queue.b", "aws_sqs_queue"),
        rc("aws_dynamodb_table.c", "aws_dynamodb_table"),
      ],
    });

    expect(scene.meta.pipelineVariant).toBe("compound");
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

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(nodes, {
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

    const scene = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      { resource_changes: [lb, listener, tg] },
      { compact: false },
    );

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

describe("classic vs compound pipeline parity", () => {
  const frameRoleChain = (elements: any[], startFrameId: string | null) => {
    const byId = new Map(elements.map((el) => [el.id, el]));
    const roles: string[] = [];
    let frameId = startFrameId;
    while (frameId) {
      const frame = byId.get(frameId);
      if (!frame || frame.type !== "frame") {
        break;
      }
      const role = frame.customData?.terraformTopologyRole;
      if (role) {
        roles.push(role);
      }
      frameId = frame.frameId ?? null;
    }
    return roles;
  };

  const assertParity = async (
    nodes: TerraformPlanNodesMap,
    plan: unknown,
    clusterIds: string[],
    options?: { compact?: boolean },
  ) => {
    const classic = await buildTerraformPipelineExcalidrawScene(
      nodes,
      plan,
      options,
    );
    const compound = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
      options,
    );

    for (const clusterId of clusterIds) {
      const classicEl = classic.elements.find(
        (e: any) => e.customData?.nodePath === clusterId,
      );
      const compoundEl = compound.elements.find(
        (e: any) => e.customData?.nodePath === clusterId,
      );
      expect(classicEl).toBeTruthy();
      expect(compoundEl).toBeTruthy();
      if (!classicEl || !compoundEl) {
        return;
      }
      expect(frameRoleChain(compound.elements, compoundEl.frameId)).toEqual(
        frameRoleChain(classic.elements, classicEl.frameId),
      );
    }

    for (let i = 1; i < clusterIds.length; i++) {
      const prev = compound.elements.find(
        (e: any) => e.customData?.nodePath === clusterIds[i - 1],
      );
      const cur = compound.elements.find(
        (e: any) => e.customData?.nodePath === clusterIds[i],
      );
      if (prev && cur) {
        expect(prev.x).toBeLessThanOrEqual(cur.x);
      }
    }
  };

  it("matches coordinates and roleChain on fan-out fixture", async () => {
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

    const plan = {
      resource_changes: [
        rc("aws_s3_bucket.a", "aws_s3_bucket"),
        rc("aws_sqs_queue.b", "aws_sqs_queue"),
        rc("aws_dynamodb_table.c", "aws_dynamodb_table"),
      ],
    };

    await assertParity(nodes, plan, [
      "aws_s3_bucket.a",
      "aws_sqs_queue.b",
      "aws_dynamodb_table.c",
    ]);
  });

  it("matches coordinates and roleChain on VPC subnet fixture", async () => {
    const nodes = {
      "aws_lambda_function.a": node(
        "aws_lambda_function.a",
        "aws_lambda_function",
      ),
      "aws_s3_bucket.b": node("aws_s3_bucket.b", "aws_s3_bucket"),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_s3_bucket.b",
          target: "aws_lambda_function.a",
          sequence: 0,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap;

    const plan = {
      resource_changes: [
        rc("aws_s3_bucket.b", "aws_s3_bucket", { region: "us-east-1" }),
        rc("aws_lambda_function.a", "aws_lambda_function", {
          region: "us-east-1",
          vpc_id: "vpc-aaa",
          subnet_ids: ["subnet-private-a"],
        }),
      ],
    };

    await assertParity(nodes, plan, [
      "aws_s3_bucket.b",
      "aws_lambda_function.a",
    ]);
  });
});

describe("pipeline ancillary resources", () => {
  const ancillaryNodes = () =>
    ({
      "aws_s3_bucket.a": node("aws_s3_bucket.a", "aws_s3_bucket"),
      "aws_sqs_queue.b": node("aws_sqs_queue.b", "aws_sqs_queue"),
      "aws_lambda_function.orphan_vpc": node(
        "aws_lambda_function.orphan_vpc",
        "aws_lambda_function",
      ),
      "aws_sns_topic.orphan_regional": node(
        "aws_sns_topic.orphan_regional",
        "aws_sns_topic",
      ),
      "aws_dynamodb_table.orphan_other_region": node(
        "aws_dynamodb_table.orphan_other_region",
        "aws_dynamodb_table",
      ),
      [DECLARED_DATAFLOW_ORDERED_KEY]: [
        {
          source: "aws_s3_bucket.a",
          target: "aws_sqs_queue.b",
          sequence: 0,
          origin: "tfd",
        },
      ],
    } as unknown as TerraformPlanNodesMap);

  const ancillaryPlan = () => ({
    configuration: {
      provider_config: {
        aws: {
          name: "aws",
          expressions: {
            region: { constant_value: "us-east-1" },
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
      rc("aws_vpc.main", "aws_vpc", { id: "vpc-aaa", region: "us-east-1" }),
      rc("aws_subnet.private_a", "aws_subnet", {
        id: "subnet-private-a",
        vpc_id: "vpc-aaa",
        region: "us-east-1",
      }),
      rc("aws_s3_bucket.a", "aws_s3_bucket", { region: "us-east-1" }),
      rc("aws_sqs_queue.b", "aws_sqs_queue", { region: "us-east-1" }),
      rc("aws_lambda_function.orphan_vpc", "aws_lambda_function", {
        region: "us-east-1",
        vpc_id: "vpc-aaa",
        subnet_ids: ["subnet-private-a"],
      }),
      rc("aws_sns_topic.orphan_regional", "aws_sns_topic", {
        region: "us-east-1",
      }),
      rc("aws_dynamodb_table.orphan_other_region", "aws_dynamodb_table", {
        region: "eu-west-1",
      }),
    ],
  });

  const frameById = (elements: any[]) =>
    new Map(
      elements.filter((el) => el.type === "frame").map((el) => [el.id, el]),
    );

  const parentRoleChainOf = (elements: any[], nodePath: string): string[] => {
    const card = elements.find((e: any) => e.customData?.nodePath === nodePath);
    expect(card).toBeTruthy();
    const frames = frameById(elements);
    const roles: string[] = [];
    let frameId = card.frameId;
    while (frameId) {
      const frame = frames.get(frameId);
      if (!frame) {
        break;
      }
      roles.push(frame.customData?.terraformTopologyRole ?? "?");
      frameId = frame.frameId ?? null;
    }
    return roles;
  };

  it("omits non-TFD resources by default", async () => {
    const scene = await buildTerraformPipelineExcalidrawScene(
      ancillaryNodes(),
      ancillaryPlan(),
    );
    expect(
      scene.elements.some(
        (e: any) => e.customData?.nodePath === "aws_sns_topic.orphan_regional",
      ),
    ).toBe(false);
    expect(
      scene.elements.some(
        (e: any) => e.customData?.terraformPipelineAncillary === true,
      ),
    ).toBe(false);
    expect(scene.meta.pipelineIncludeAncillary).toBeUndefined();
  });

  it("places ancillary resources in Unconnected strips nested in their hulls", async () => {
    const scene = await buildTerraformPipelineExcalidrawScene(
      ancillaryNodes(),
      ancillaryPlan(),
      { includeAncillary: true },
    );

    expect(scene.meta.pipelineIncludeAncillary).toBe(true);
    expect(scene.meta.pipelineAncillaryApplied).toBe(true);
    expect(scene.meta.pipelineAncillaryCount).toBe(3);
    expect(scene.meta.pipelineAncillaryStripCount).toBe(3);
    // TFD topology untouched.
    expect(scene.meta.pipelineClusterCount).toBe(2);
    expect(scene.meta.pipelineColumnCount).toBe(2);

    // Every ancillary card sits inside an ancillaryStrip frame, nested in the
    // correct hull (vpc strip for the VPC-placed orphan, region otherwise).
    expect(
      parentRoleChainOf(scene.elements, "aws_lambda_function.orphan_vpc"),
    ).toEqual([
      "primaryCluster",
      "ancillaryStrip",
      "vpc",
      "region",
      "account",
      "provider",
    ]);
    expect(
      parentRoleChainOf(scene.elements, "aws_sns_topic.orphan_regional"),
    ).toEqual([
      "primaryCluster",
      "ancillaryStrip",
      "region",
      "account",
      "provider",
    ]);
    // Orphan in a region with no TFD lanes still gets a fresh region hull.
    expect(
      parentRoleChainOf(
        scene.elements,
        "aws_dynamodb_table.orphan_other_region",
      ),
    ).toEqual([
      "primaryCluster",
      "ancillaryStrip",
      "region",
      "account",
      "provider",
    ]);

    const strips = scene.elements.filter(
      (e: any) => e.customData?.terraformTopologyRole === "ancillaryStrip",
    );
    expect(strips).toHaveLength(3);
    for (const strip of strips as any[]) {
      expect(strip.name).toBe("Unconnected");
      expect(strip.customData?.terraformPipelineAncillary).toBe(true);
    }

    // Strips never overlap clusters that are not their own children.
    const clusterFrames = scene.elements.filter(
      (e: any) =>
        e.type === "frame" &&
        e.customData?.terraformTopologyRole === "primaryCluster",
    );
    for (const strip of strips as any[]) {
      for (const frame of clusterFrames as any[]) {
        if (frame.frameId === strip.id) {
          continue;
        }
        const disjoint =
          frame.x + frame.width <= strip.x ||
          strip.x + strip.width <= frame.x ||
          frame.y + frame.height <= strip.y ||
          strip.y + strip.height <= frame.y;
        expect(disjoint).toBe(true);
      }
    }
  });

  it("stamps compound metadata on strips so they drag with their hull", async () => {
    const scene = await buildTerraformCompoundPipelineExcalidrawScene(
      ancillaryNodes(),
      ancillaryPlan(),
      { includeAncillary: true },
    );

    expect(scene.meta.pipelineAncillaryCount).toBe(3);
    const strips = scene.elements.filter(
      (e: any) => e.customData?.terraformTopologyRole === "ancillaryStrip",
    );
    expect(strips).toHaveLength(3);
    for (const strip of strips as any[]) {
      expect(strip.customData?.terraformCompoundLayout).toBe(true);
      expect(typeof strip.customData?.terraformCompoundParentKey).toBe(
        "string",
      );
    }
  });

  it("collectAncillaryAddresses excludes satellites of drawn primaries", () => {
    const nodes = {
      "aws_lb.cluster": node("aws_lb.cluster", "aws_lb"),
      "aws_sqs_queue.dlq": node("aws_sqs_queue.dlq", "aws_sqs_queue"),
      "aws_sns_topic.alarm": node("aws_sns_topic.alarm", "aws_sns_topic"),
      "aws_lambda_function.kept": node(
        "aws_lambda_function.kept",
        "aws_lambda_function",
      ),
      "aws_iam_role.excluded_type": node(
        "aws_iam_role.excluded_type",
        "aws_iam_role",
      ),
    } as unknown as TerraformPlanNodesMap;
    const clusterIds = new Set(["aws_lb.cluster"]);
    const satelliteOwners = new Map([
      // satellite of a TFD cluster -> excluded
      ["aws_sqs_queue.dlq", "aws_lb.cluster"],
      // satellite of another ancillary candidate -> excluded (rides along)
      ["aws_sns_topic.alarm", "aws_lambda_function.kept"],
      // satellite of a non-drawn owner -> kept as its own card
      ["aws_lambda_function.kept", "aws_iam_role.excluded_type"],
    ]);

    expect(
      collectAncillaryAddresses(nodes, clusterIds, satelliteOwners),
    ).toEqual(["aws_lambda_function.kept"]);
  });
});
