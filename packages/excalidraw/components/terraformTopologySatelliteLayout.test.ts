import { describe, expect, it } from "vitest";

import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import {
  groupIamStackIntoRoleStacks,
  remapScopedSatelliteEdges,
  terraformSatelliteLayoutElementId,
  terraformSatelliteSgRuleLayoutElementId,
} from "./terraformTopologySatelliteLayout";
import { buildLoadBalancerSgCluster } from "./terraformTopologySgLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformTopologySatelliteLayout", () => {
  it("groupIamStackIntoRoleStacks splits execution and task roles", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_iam_role.exec": {
        resources: {
          "aws_iam_role.exec": {
            address: "aws_iam_role.exec",
            mode: "managed",
            type: "aws_iam_role",
            change: { actions: ["create"], after: { name: "exec" } },
          },
        },
      },
      "aws_iam_role_policy_attachment.exec": {
        resources: {
          "aws_iam_role_policy_attachment.exec": {
            address: "aws_iam_role_policy_attachment.exec",
            mode: "managed",
            type: "aws_iam_role_policy_attachment",
            change: { actions: ["create"], after: { role: "exec" } },
          },
        },
      },
      "aws_iam_role.task": {
        resources: {
          "aws_iam_role.task": {
            address: "aws_iam_role.task",
            mode: "managed",
            type: "aws_iam_role",
            change: { actions: ["create"], after: { name: "task" } },
          },
        },
      },
    };
    const stacks = groupIamStackIntoRoleStacks(nodes, [
      "aws_iam_role.exec",
      "aws_iam_role_policy_attachment.exec",
      "aws_iam_role.task",
    ]);
    expect(stacks).toHaveLength(2);
    expect(stacks[0]).toEqual([
      "aws_iam_role.exec",
      "aws_iam_role_policy_attachment.exec",
    ]);
    expect(stacks[1]).toEqual(["aws_iam_role.task"]);
  });

  it("remapScopedSatelliteEdges uses scoped layout ids", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_security_group.app": {
        resources: {
          "aws_security_group.app": {
            address: "aws_security_group.app",
            mode: "managed",
            type: "aws_security_group",
            change: { actions: ["create"], after: { id: "sg-1" } },
          },
        },
      },
      "aws_security_group_rule.ingress": {
        resources: {
          "aws_security_group_rule.ingress": {
            address: "aws_security_group_rule.ingress",
            mode: "managed",
            type: "aws_security_group_rule",
            change: { actions: ["create"], after: {} },
          },
        },
      },
    };
    const parent = "aws_lb.api";
    const edges = remapScopedSatelliteEdges(
      [
        {
          source: parent,
          target: "aws_security_group.app",
          type: "security_group",
          label: "sg",
        },
        {
          source: "aws_security_group.app",
          target: "aws_security_group_rule.ingress",
          type: "sg_rule",
          label: "rule",
        },
      ],
      parent,
      nodes,
    );
    const sgLayout = terraformSatelliteLayoutElementId(
      parent,
      "aws_security_group.app",
    );
    const ruleLayout = terraformSatelliteSgRuleLayoutElementId(
      parent,
      "aws_security_group_rule.ingress",
    );
    expect(edges[0]?.target).toBe(sgLayout);
    expect(edges[1]?.source).toBe(sgLayout);
    expect(edges[1]?.target).toBe(ruleLayout);
  });

  it("two LB primaries get distinct scoped SG layout ids for the same SG", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_lb.a": {
        resources: {
          "aws_lb.a": {
            address: "aws_lb.a",
            mode: "managed",
            type: "aws_lb",
            change: {
              actions: ["create"],
              after: { security_groups: ["aws_security_group.shared"] },
            },
          },
        },
      },
      "aws_lb.b": {
        resources: {
          "aws_lb.b": {
            address: "aws_lb.b",
            mode: "managed",
            type: "aws_lb",
            change: {
              actions: ["create"],
              after: { security_groups: ["aws_security_group.shared"] },
            },
          },
        },
      },
      "aws_security_group.shared": {
        resources: {
          "aws_security_group.shared": {
            address: "aws_security_group.shared",
            mode: "managed",
            type: "aws_security_group",
            change: { actions: ["create"], after: { id: "sg-shared" } },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const idA = terraformSatelliteLayoutElementId(
      "aws_lb.a",
      "aws_security_group.shared",
    );
    const idB = terraformSatelliteLayoutElementId(
      "aws_lb.b",
      "aws_security_group.shared",
    );
    expect(idA).not.toBe(idB);
    expect(
      buildLoadBalancerSgCluster(nodes, "aws_lb.a", arnIndex).cluster?.groups,
    ).toHaveLength(1);
    expect(
      buildLoadBalancerSgCluster(nodes, "aws_lb.b", arnIndex).cluster?.groups,
    ).toHaveLength(1);
  });
});
