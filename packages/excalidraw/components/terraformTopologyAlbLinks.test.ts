import { describe, expect, it } from "vitest";

import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import {
  buildAlbListenerTargetCluster,
  filterTopologyAddressesExcludingAlbSatellites,
  resolveLoadBalancerArnToLbPath,
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

describe("terraformTopologyAlbLinks", () => {
  it("resolveLoadBalancerArnToLbPath resolves LB ARN to aws_lb node", () => {
    const nodes = sampleAlbNodes();
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(
      resolveLoadBalancerArnToLbPath(nodes, lbArn, arnIndex),
    ).toBe("aws_lb.main");
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
});
