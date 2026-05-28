import { describe, expect, it } from "vitest";

import {
  buildArnIndexForTopology,
  buildEcsServiceIamCluster,
} from "./terraformTopologyIamLinks";
import {
  buildEcsServiceCompanionCluster,
  collectLogGroupPathsForTaskDefinition,
  ecsServiceCompanionLogGroupPaths,
} from "./terraformTopologyEcsLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformTopologyEcsLinks", () => {
  it("stacks task definition and log group under aws_ecs_service", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_ecs_service.producer": {
        resources: {
          "aws_ecs_service.producer": {
            address: "aws_ecs_service.producer",
            mode: "managed",
            type: "aws_ecs_service",
            change: {
              actions: ["create"],
              after: {
                task_definition: "aws_ecs_task_definition.producer",
              },
            },
          },
        },
      },
      "aws_ecs_task_definition.producer": {
        resources: {
          "aws_ecs_task_definition.producer": {
            address: "aws_ecs_task_definition.producer",
            mode: "managed",
            type: "aws_ecs_task_definition",
            change: {
              actions: ["create"],
              after: {
                container_definitions: JSON.stringify([
                  {
                    name: "producer",
                    logConfiguration: {
                      logDriver: "awslogs",
                      options: {
                        "awslogs-group": "aws_cloudwatch_log_group.ecs.name",
                      },
                    },
                  },
                ]),
              },
            },
          },
        },
      },
      "aws_cloudwatch_log_group.ecs": {
        resources: {
          "aws_cloudwatch_log_group.ecs": {
            address: "aws_cloudwatch_log_group.ecs",
            mode: "managed",
            type: "aws_cloudwatch_log_group",
            change: {
              actions: ["create"],
              after: { name: "/aws/ecs/staging/producer" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const logGroups = ecsServiceCompanionLogGroupPaths(
      nodes,
      "aws_ecs_service.producer",
      arnIndex,
    );
    expect(logGroups).toContain("aws_cloudwatch_log_group.ecs");
    expect(
      collectLogGroupPathsForTaskDefinition(
        nodes,
        "aws_ecs_task_definition.producer",
      ),
    ).toContain("aws_cloudwatch_log_group.ecs");

    const { cluster } = buildEcsServiceCompanionCluster(
      nodes,
      "aws_ecs_service.producer",
      arnIndex,
    );
    expect(cluster?.stack).toEqual([
      "aws_ecs_task_definition.producer",
      "aws_cloudwatch_log_group.ecs",
    ]);
  });

  it("IAM stack under ECS includes policy attachment on execution role", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_ecs_service.producer": {
        resources: {
          "aws_ecs_service.producer": {
            address: "aws_ecs_service.producer",
            mode: "managed",
            type: "aws_ecs_service",
            change: {
              actions: ["create"],
              after: {
                task_definition: "aws_ecs_task_definition.producer",
              },
            },
          },
        },
      },
      "aws_ecs_task_definition.producer": {
        resources: {
          "aws_ecs_task_definition.producer": {
            address: "aws_ecs_task_definition.producer",
            mode: "managed",
            type: "aws_ecs_task_definition",
            change: {
              actions: ["create"],
              after: {
                execution_role_arn:
                  "arn:aws:iam::111111111111:role/staging-ecs-task-execution",
              },
            },
          },
        },
      },
      "aws_iam_role.ecs_task_execution": {
        resources: {
          "aws_iam_role.ecs_task_execution": {
            address: "aws_iam_role.ecs_task_execution",
            mode: "managed",
            type: "aws_iam_role",
            change: {
              actions: ["create"],
              after: {
                name: "staging-ecs-task-execution",
                arn: "arn:aws:iam::111111111111:role/staging-ecs-task-execution",
              },
            },
          },
        },
      },
      "aws_iam_role_policy_attachment.ecs_task_execution_managed": {
        resources: {
          "aws_iam_role_policy_attachment.ecs_task_execution_managed": {
            address:
              "aws_iam_role_policy_attachment.ecs_task_execution_managed",
            mode: "managed",
            type: "aws_iam_role_policy_attachment",
            change: {
              actions: ["create"],
              after: {
                role: "staging-ecs-task-execution",
                policy_arn:
                  "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
              },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildEcsServiceIamCluster(
      nodes,
      "aws_ecs_service.producer",
      arnIndex,
    );
    expect(cluster?.stack).toEqual([
      "aws_iam_role.ecs_task_execution",
      "aws_iam_role_policy_attachment.ecs_task_execution_managed",
    ]);
  });
});
