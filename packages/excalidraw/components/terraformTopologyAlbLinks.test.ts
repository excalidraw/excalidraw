import { describe, expect, it } from "vitest";

import { namespacePlanForStack } from "./terraformImportMerge";
import { prefixStackAddress } from "./terraformStackAddress";
import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import {
  buildAlbListenerTargetCluster,
  collectAlbClusterSatelliteAddressesForTopologyList,
  filterTopologyAddressesExcludingAlbSatellites,
  resolveAlbCompanionParentLbAddressFromPlan,
  resolveListenerParentLbAddressFromPlan,
  resolveLoadBalancerArnToLbPath,
  resolveTargetGroupParentLbAddressFromPlan,
} from "./terraformTopologyAlbLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

const lbArn =
  "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/app/main/abc";
const tgArn =
  "arn:aws:elasticloadbalancing:us-east-1:111111111111:targetgroup/tg/xyz";

function sampleAlbNodes(): TerraformPlanNodesMap {
  return {
    "aws_lb.main": {
      resources: {
        "aws_lb.main": {
          address: "aws_lb.main",
          mode: "managed",
          type: "aws_lb",
          change: {
            actions: ["create"],
            after: { arn: lbArn },
          },
        },
      },
    },
    "aws_lb_listener.http": {
      resources: {
        "aws_lb_listener.http": {
          address: "aws_lb_listener.http",
          mode: "managed",
          type: "aws_lb_listener",
          change: {
            actions: ["create"],
            after: {
              load_balancer_arn: lbArn,
              default_action: [
                {
                  type: "forward",
                  target_group_arn: tgArn,
                },
              ],
            },
          },
        },
      },
    },
    "aws_lb_target_group.app": {
      resources: {
        "aws_lb_target_group.app": {
          address: "aws_lb_target_group.app",
          mode: "managed",
          type: "aws_lb_target_group",
          change: {
            actions: ["create"],
            after: { arn: tgArn },
          },
        },
      },
    },
    "aws_lb_target_group_attachment.a": {
      resources: {
        "aws_lb_target_group_attachment.a": {
          address: "aws_lb_target_group_attachment.a",
          mode: "managed",
          type: "aws_lb_target_group_attachment",
          change: {
            actions: ["create"],
            after: { target_group_arn: tgArn },
          },
        },
      },
    },
  };
}

function lbWithSgOnlyNodes(): TerraformPlanNodesMap {
  return {
    "aws_lb.main": {
      resources: {
        "aws_lb.main": {
          address: "aws_lb.main",
          mode: "managed",
          type: "aws_lb",
          change: {
            actions: ["create"],
            after: {
              arn: lbArn,
              security_groups: ["sg-only"],
            },
          },
        },
      },
    },
    "aws_security_group.lb": {
      resources: {
        "aws_security_group.lb": {
          address: "aws_security_group.lb",
          mode: "managed",
          type: "aws_security_group",
          change: {
            actions: ["create"],
            after: { id: "sg-only", vpc_id: "vpc-1" },
          },
        },
      },
    },
  };
}

describe("terraformTopologyAlbLinks", () => {
  it("resolveLoadBalancerArnToLbPath resolves LB ARN to aws_lb node", () => {
    const nodes = sampleAlbNodes();
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(resolveLoadBalancerArnToLbPath(nodes, lbArn, arnIndex)).toBe(
      "aws_lb.main",
    );
  });

  it("buildAlbListenerTargetCluster orders listener, target group, attachment", () => {
    const nodes = sampleAlbNodes();
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster, edges } = buildAlbListenerTargetCluster(
      nodes,
      "aws_lb.main",
      arnIndex,
    );
    expect(cluster).not.toBeNull();
    expect(cluster!.stack).toEqual([
      "aws_lb_listener.http",
      "aws_lb_target_group.app",
      "aws_lb_target_group_attachment.a",
    ]);
    expect(
      edges.some(
        (e) =>
          e.source === "aws_lb.main" &&
          e.target === "aws_lb_listener.http" &&
          e.type === "alb_listener",
      ),
    ).toBe(true);
    expect(
      edges.some(
        (e) =>
          e.source === "aws_lb_listener.http" &&
          e.target === "aws_lb_target_group.app" &&
          e.type === "alb_forward",
      ),
    ).toBe(true);
    expect(
      edges.some(
        (e) =>
          e.source === "aws_lb_target_group.app" &&
          e.target === "aws_lb_target_group_attachment.a" &&
          e.type === "alb_attachment",
      ),
    ).toBe(true);
  });

  it("filterTopologyAddressesExcludingAlbSatellites drops ALB satellites from grid list", () => {
    const nodes = sampleAlbNodes();
    const arnIndex = buildArnIndexForTopology(nodes);
    const all = Object.keys(nodes).sort((a, b) => a.localeCompare(b));
    const filtered = filterTopologyAddressesExcludingAlbSatellites(
      nodes,
      arnIndex,
      all,
    );
    expect(filtered).toEqual(["aws_lb.main"]);
  });

  it("collectAlbClusterSatelliteAddressesForTopologyList includes LB SG when no listeners", () => {
    const nodes = lbWithSgOnlyNodes();
    const arnIndex = buildArnIndexForTopology(nodes);
    const consumed = collectAlbClusterSatelliteAddressesForTopologyList(
      nodes,
      arnIndex,
      ["aws_lb.main"],
    );
    expect([...consumed].sort()).toEqual(["aws_security_group.lb"]);
    const filtered = filterTopologyAddressesExcludingAlbSatellites(
      nodes,
      arnIndex,
      Object.keys(nodes),
    );
    expect(filtered.sort()).toEqual(["aws_lb.main"]);
  });

  it("returns null cluster for non-LB address", () => {
    const nodes = sampleAlbNodes();
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildAlbListenerTargetCluster(
      nodes,
      "aws_lb_target_group.app",
      arnIndex,
    );
    expect(cluster).toBeNull();
  });

  describe("plan resolvers", () => {
    const planChanges = () => [
      {
        address: "aws_lb.ecs",
        mode: "managed",
        type: "aws_lb",
        change: {
          actions: ["create"],
          after: {
            arn: lbArn,
            subnets: ["subnet-public-a"],
            vpc_id: "vpc-east",
          },
        },
      },
      {
        address: "aws_lb_listener.http",
        mode: "managed",
        type: "aws_lb_listener",
        change: {
          actions: ["create"],
          after: {
            load_balancer_arn: lbArn,
            port: 80,
            protocol: "HTTP",
            default_action: {
              type: "forward",
              target_group_arn: tgArn,
            },
          },
        },
      },
      {
        address: "aws_lb_target_group.ecs",
        mode: "managed",
        type: "aws_lb_target_group",
        change: {
          actions: ["create"],
          after: { arn: tgArn, port: 8080, vpc_id: "vpc-east" },
        },
      },
      {
        address: "aws_lb_target_group_attachment.ecs",
        mode: "managed",
        type: "aws_lb_target_group_attachment",
        change: {
          actions: ["create"],
          after: { target_group_arn: tgArn },
        },
      },
    ];

    it("resolveListenerParentLbAddressFromPlan matches LB ARN", () => {
      const changes = planChanges();
      expect(resolveListenerParentLbAddressFromPlan(changes[1]!, changes)).toBe(
        "aws_lb.ecs",
      );
    });

    it("resolveTargetGroupParentLbAddressFromPlan finds LB via listener forward", () => {
      const changes = planChanges();
      expect(
        resolveTargetGroupParentLbAddressFromPlan(changes[2]!, changes),
      ).toBe("aws_lb.ecs");
    });

    it("resolveAlbCompanionParentLbAddressFromPlan resolves attachment via target group", () => {
      const changes = planChanges();
      expect(
        resolveAlbCompanionParentLbAddressFromPlan(changes[3]!, changes),
      ).toBe("aws_lb.ecs");
    });

    it("resolveListenerParentLbAddressFromPlan matches unqualified ref to stack-qualified LB", () => {
      const stackId = "10-east-ecs-edge";
      const lbAddr = prefixStackAddress(stackId, "aws_lb.ecs");
      const listenerAddr = prefixStackAddress(stackId, "aws_lb_listener.http");
      const changes = [
        {
          address: lbAddr,
          mode: "managed",
          type: "aws_lb",
          change: {
            actions: ["create"],
            after: { arn: lbArn, subnets: ["subnet-public-a"] },
          },
        },
        {
          address: listenerAddr,
          mode: "managed",
          type: "aws_lb_listener",
          change: {
            actions: ["create"],
            after: {
              load_balancer_arn: "aws_lb.ecs",
              default_action: { target_group_arn: tgArn },
            },
          },
        },
      ];
      expect(resolveListenerParentLbAddressFromPlan(changes[1]!, changes)).toBe(
        lbAddr,
      );
    });
  });

  it("buildAlbListenerTargetCluster links stack-qualified staging addresses", () => {
    const stackId = "10-east-ecs-edge";
    const plan = namespacePlanForStack(
      {
        resource_changes: [
          {
            address: "aws_lb.ecs",
            mode: "managed",
            type: "aws_lb",
            change: {
              actions: ["create"],
              after: { arn: lbArn, subnets: ["subnet-public-a"] },
            },
          },
          {
            address: "aws_lb_listener.http",
            mode: "managed",
            type: "aws_lb_listener",
            change: {
              actions: ["create"],
              after: {
                load_balancer_arn: lbArn,
                default_action: {
                  type: "forward",
                  target_group_arn: tgArn,
                },
              },
            },
          },
          {
            address: "aws_lb_target_group.ecs",
            mode: "managed",
            type: "aws_lb_target_group",
            change: {
              actions: ["create"],
              after: { arn: tgArn },
            },
          },
        ],
      },
      stackId,
    ) as { resource_changes: Array<{ address: string }> };

    const nodes: TerraformPlanNodesMap = {};
    for (const rc of plan.resource_changes) {
      nodes[rc.address] = {
        resources: {
          [rc.address]: rc as never,
        },
      };
    }

    const lbAddr = prefixStackAddress(stackId, "aws_lb.ecs");
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildAlbListenerTargetCluster(nodes, lbAddr, arnIndex);
    expect(cluster).not.toBeNull();
    expect(cluster!.stack).toEqual(
      expect.arrayContaining([
        prefixStackAddress(stackId, "aws_lb_listener.http"),
        prefixStackAddress(stackId, "aws_lb_target_group.ecs"),
      ]),
    );
  });
});
