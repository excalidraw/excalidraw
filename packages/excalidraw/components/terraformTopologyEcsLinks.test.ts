import { describe, expect, it } from "vitest";

import {
  buildArnIndexForTopology,
  buildEcsServiceIamCluster,
} from "./terraformTopologyIamLinks";
import {
  buildEcsClusterCompanionCluster,
  buildEcsEc2CapacityChainsForService,
  buildEcsEc2CapacityCompanionCluster,
  buildEcsServiceCompanionCluster,
  collectLogGroupPathsForTaskDefinition,
  ecsServiceCompanionLogGroupPaths,
  isEc2BackedEcsService,
  isEcsCompanionConsumedAsSatellite,
} from "./terraformTopologyEcsLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

/** Staging `private_api_ecs` EC2 path shape (single CP chain). */
function stagingEc2ModuleNodes(): TerraformPlanNodesMap {
  return {
    "module.private_api.aws_ecs_service.api": {
      resources: {
        "module.private_api.aws_ecs_service.api": {
          address: "module.private_api.aws_ecs_service.api",
          mode: "managed",
          type: "aws_ecs_service",
          change: {
            actions: ["create"],
            after: {
              cluster: "module.private_api.aws_ecs_cluster.api.id",
              task_definition: "module.private_api.aws_ecs_task_definition.api.arn",
              launch_type: null,
              capacity_provider_strategy: [
                {
                  capacity_provider:
                    "module.private_api.aws_ecs_capacity_provider.ec2[0].name",
                  weight: 1,
                },
              ],
            },
          },
        },
      },
    },
    "module.private_api.aws_ecs_cluster.api": {
      resources: {
        "module.private_api.aws_ecs_cluster.api": {
          address: "module.private_api.aws_ecs_cluster.api",
          mode: "managed",
          type: "aws_ecs_cluster",
          change: {
            actions: ["create"],
            after: { name: "staging-api-2", id: "arn:aws:ecs:us-east-1:1:cluster/staging-api-2" },
          },
        },
      },
    },
    "module.private_api.aws_ecs_cluster_capacity_providers.api": {
      resources: {
        "module.private_api.aws_ecs_cluster_capacity_providers.api": {
          address: "module.private_api.aws_ecs_cluster_capacity_providers.api",
          mode: "managed",
          type: "aws_ecs_cluster_capacity_providers",
          change: {
            actions: ["create"],
            after: {
              cluster_name: "staging-api-2",
              capacity_providers: ["staging-api-2-ec2"],
            },
          },
        },
      },
    },
    "module.private_api.aws_ecs_capacity_provider.ec2": {
      resources: {
        "module.private_api.aws_ecs_capacity_provider.ec2[0]": {
          address: "module.private_api.aws_ecs_capacity_provider.ec2[0]",
          mode: "managed",
          type: "aws_ecs_capacity_provider",
          change: {
            actions: ["create"],
            after: {
              name: "staging-api-2-ec2",
              auto_scaling_group_provider: {
                auto_scaling_group_arn:
                  "module.private_api.aws_autoscaling_group.ecs[0].arn",
              },
            },
          },
        },
      },
    },
    "module.private_api.aws_autoscaling_group.ecs": {
      resources: {
        "module.private_api.aws_autoscaling_group.ecs[0]": {
          address: "module.private_api.aws_autoscaling_group.ecs[0]",
          mode: "managed",
          type: "aws_autoscaling_group",
          change: {
            actions: ["create"],
            after: {
              arn: "arn:aws:autoscaling:us-east-1:1:autoScalingGroup:uuid:autoScalingGroupName/staging-api-2",
              launch_template: [
                {
                  id: "module.private_api.aws_launch_template.ecs[0].id",
                  version: "$Latest",
                },
              ],
            },
          },
        },
      },
    },
    "module.private_api.aws_launch_template.ecs": {
      resources: {
        "module.private_api.aws_launch_template.ecs[0]": {
          address: "module.private_api.aws_launch_template.ecs[0]",
          mode: "managed",
          type: "aws_launch_template",
          change: {
            actions: ["create"],
            after: {
              iam_instance_profile: {
                name: "module.private_api.aws_iam_instance_profile.ecs_instance[0].name",
              },
            },
          },
        },
      },
    },
    "module.private_api.aws_iam_instance_profile.ecs_instance": {
      resources: {
        "module.private_api.aws_iam_instance_profile.ecs_instance[0]": {
          address: "module.private_api.aws_iam_instance_profile.ecs_instance[0]",
          mode: "managed",
          type: "aws_iam_instance_profile",
          change: {
            actions: ["create"],
            after: {
              name: "staging-api-2-ec2",
              role: "staging-api-2-ec2",
            },
          },
        },
      },
    },
    "module.private_api.aws_iam_role.ecs_instance": {
      resources: {
        "module.private_api.aws_iam_role.ecs_instance[0]": {
          address: "module.private_api.aws_iam_role.ecs_instance[0]",
          mode: "managed",
          type: "aws_iam_role",
          change: {
            actions: ["create"],
            after: {
              name: "staging-api-2-ec2",
              arn: "arn:aws:iam::1:role/staging-api-2-ec2",
            },
          },
        },
      },
    },
    "module.private_api.aws_ecs_task_definition.api": {
      resources: {
        "module.private_api.aws_ecs_task_definition.api": {
          address: "module.private_api.aws_ecs_task_definition.api",
          mode: "managed",
          type: "aws_ecs_task_definition",
          change: {
            actions: ["create"],
            after: {
              requires_compatibilities: ["EC2"],
              execution_role_arn: "arn:aws:iam::1:role/exec",
              task_role_arn: "arn:aws:iam::1:role/task",
            },
          },
        },
      },
    },
  };
}

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

  it("resolves staging-shaped single EC2 capacity chain", () => {
    const nodes = stagingEc2ModuleNodes();
    const service = "module.private_api.aws_ecs_service.api";
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(isEc2BackedEcsService(nodes, service, arnIndex)).toBe(true);

    const chains = buildEcsEc2CapacityChainsForService(nodes, service, arnIndex);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.capacityProvider).toBe(
      "module.private_api.aws_ecs_capacity_provider.ec2",
    );
    expect(chains[0]?.autoscalingGroup).toBe(
      "module.private_api.aws_autoscaling_group.ecs",
    );
    expect(chains[0]?.launchTemplate).toBe(
      "module.private_api.aws_launch_template.ecs",
    );
    expect(chains[0]?.instanceProfile).toBe(
      "module.private_api.aws_iam_instance_profile.ecs_instance",
    );

    const { cluster: ec2Cluster } = buildEcsEc2CapacityCompanionCluster(
      nodes,
      service,
      arnIndex,
    );
    expect(ec2Cluster?.chains).toHaveLength(1);

    const { cluster: clusterBand } = buildEcsClusterCompanionCluster(
      nodes,
      service,
    );
    expect(clusterBand?.clusterPath).toBe("module.private_api.aws_ecs_cluster.api");
    expect(clusterBand?.clusterCapacityProvidersPath).toBe(
      "module.private_api.aws_ecs_cluster_capacity_providers.api",
    );
  });

  it("resolves two capacity provider strategy entries as two chains", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_ecs_service.app": {
        resources: {
          "aws_ecs_service.app": {
            address: "aws_ecs_service.app",
            mode: "managed",
            type: "aws_ecs_service",
            change: {
              actions: ["create"],
              after: {
                capacity_provider_strategy: [
                  {
                    capacity_provider: "aws_ecs_capacity_provider.a.name",
                    weight: 1,
                  },
                  {
                    capacity_provider: "aws_ecs_capacity_provider.b.name",
                    weight: 2,
                  },
                ],
              },
            },
          },
        },
      },
      "aws_ecs_capacity_provider.a": {
        resources: {
          "aws_ecs_capacity_provider.a": {
            address: "aws_ecs_capacity_provider.a",
            mode: "managed",
            type: "aws_ecs_capacity_provider",
            change: {
              actions: ["create"],
              after: {
                name: "cp-a",
                auto_scaling_group_provider: {
                  auto_scaling_group_arn: "aws_autoscaling_group.a.arn",
                },
              },
            },
          },
        },
      },
      "aws_ecs_capacity_provider.b": {
        resources: {
          "aws_ecs_capacity_provider.b": {
            address: "aws_ecs_capacity_provider.b",
            mode: "managed",
            type: "aws_ecs_capacity_provider",
            change: {
              actions: ["create"],
              after: {
                name: "cp-b",
                auto_scaling_group_provider: {
                  auto_scaling_group_arn: "aws_autoscaling_group.b.arn",
                },
              },
            },
          },
        },
      },
      "aws_autoscaling_group.a": {
        resources: {
          "aws_autoscaling_group.a": {
            address: "aws_autoscaling_group.a",
            mode: "managed",
            type: "aws_autoscaling_group",
            change: {
              actions: ["create"],
              after: { arn: "arn:asg:a" },
            },
          },
        },
      },
      "aws_autoscaling_group.b": {
        resources: {
          "aws_autoscaling_group.b": {
            address: "aws_autoscaling_group.b",
            mode: "managed",
            type: "aws_autoscaling_group",
            change: {
              actions: ["create"],
              after: { arn: "arn:asg:b" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const chains = buildEcsEc2CapacityChainsForService(
      nodes,
      "aws_ecs_service.app",
      arnIndex,
    );
    expect(chains).toHaveLength(2);
    expect(chains.map((c) => c.capacityProvider).sort()).toEqual([
      "aws_ecs_capacity_provider.a",
      "aws_ecs_capacity_provider.b",
    ]);
  });

  it("consumes cluster and EC2 chain resources as satellites", () => {
    const nodes = stagingEc2ModuleNodes();
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(
      isEcsCompanionConsumedAsSatellite(
        nodes,
        arnIndex,
        "module.private_api.aws_ecs_cluster.api",
      ),
    ).toBe(true);
    expect(
      isEcsCompanionConsumedAsSatellite(
        nodes,
        arnIndex,
        "module.private_api.aws_autoscaling_group.ecs",
      ),
    ).toBe(true);
  });

  it("IAM stack under ECS includes host instance role from EC2 chain", () => {
    const nodes = stagingEc2ModuleNodes();
    const service = "module.private_api.aws_ecs_service.api";
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildEcsServiceIamCluster(nodes, service, arnIndex);
    expect(cluster?.stack).toContain(
      "module.private_api.aws_iam_role.ecs_instance",
    );
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
                launch_type: "FARGATE",
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
