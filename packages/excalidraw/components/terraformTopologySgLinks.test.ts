import { describe, expect, it } from "vitest";

import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import {
  buildDatastorePrimarySgCluster,
  buildLambdaSgCluster,
  buildLoadBalancerSgCluster,
  buildPrimarySgCluster,
  buildSecurityGroupIdToPathIndex,
  collectDatastoreVpcSecurityGroupRefs,
  collectLambdaVpcSecurityGroupRefs,
  collectSecurityGroupRulesForSg,
  stripLastTerraformModuleSegment,
} from "./terraformTopologySgLinks";
import { collectTopologySatelliteAddressesFromRegistry } from "./terraformTopologySatelliteRegistry";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformTopologySgLinks", () => {
  it("stripLastTerraformModuleSegment peels one module level", () => {
    expect(
      stripLastTerraformModuleSegment(
        "module.workload_reader_lambda.module.lambda",
      ),
    ).toBe("module.workload_reader_lambda");
    expect(
      stripLastTerraformModuleSegment("module.workload_reader_lambda"),
    ).toBe("");
    expect(stripLastTerraformModuleSegment("")).toBe("");
  });

  it("collects vpc_config security_group_ids from a Lambda", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: {
                vpc_config: [
                  {
                    subnet_ids: ["subnet-a"],
                    security_group_ids: ["sg-aaa", "sg-bbb"],
                  },
                ],
              },
            },
          },
        },
      },
    };
    expect(
      collectLambdaVpcSecurityGroupRefs(nodes, "aws_lambda_function.fn"),
    ).toEqual(["sg-aaa", "sg-bbb"]);
  });

  it("maps sg id to aws_security_group path and collects VPC ingress/egress rules", () => {
    const sgArn =
      "arn:aws:ec2:us-east-1:111111111111:security-group/sg-0deadbeef0";
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: {
                vpc_config: [
                  {
                    subnet_ids: ["subnet-x"],
                    security_group_ids: ["sg-0deadbeef0"],
                  },
                ],
              },
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
              after: {
                id: "sg-0deadbeef0",
                arn: sgArn,
                vpc_id: "vpc-1",
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
              after: { security_group_id: "sg-0deadbeef0" },
            },
          },
        },
      },
      "aws_vpc_security_group_egress_rule.all": {
        resources: {
          "aws_vpc_security_group_egress_rule.all": {
            address: "aws_vpc_security_group_egress_rule.all",
            mode: "managed",
            type: "aws_vpc_security_group_egress_rule",
            change: {
              after: { security_group_id: "sg-0deadbeef0" },
            },
          },
        },
      },
    };

    const idIndex = buildSecurityGroupIdToPathIndex(nodes);
    expect(idIndex.get("sg-0deadbeef0")).toBe("aws_security_group.app");

    const arnIndex = buildArnIndexForTopology(nodes);
    const rules = collectSecurityGroupRulesForSg(
      nodes,
      "aws_security_group.app",
      arnIndex,
      idIndex,
    );
    expect(rules).toEqual([
      "aws_vpc_security_group_egress_rule.all",
      "aws_vpc_security_group_ingress_rule.ssh",
    ]);

    const { cluster, edges } = buildLambdaSgCluster(
      nodes,
      "aws_lambda_function.fn",
      arnIndex,
    );
    expect(cluster?.groups).toHaveLength(1);
    expect(cluster?.groups[0]?.sgPath).toBe("aws_security_group.app");
    expect(cluster?.groups[0]?.rules).toEqual(rules);

    expect(
      edges.some(
        (e) =>
          e.type === "security_group" && e.target === "aws_security_group.app",
      ),
    ).toBe(true);
    expect(edges.filter((e) => e.type === "sg_rule").length).toBe(2);
  });

  it("buildLoadBalancerSgCluster links aws_lb security_groups to aws_security_group", () => {
    const lbArn =
      "arn:aws:elasticloadbalancing:us-east-1:111111111111:loadbalancer/app/x/abc";
    const nodes: TerraformPlanNodesMap = {
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
                security_groups: ["sg-lb2"],
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
              after: { id: "sg-lb2", vpc_id: "vpc-1" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster, edges } = buildLoadBalancerSgCluster(
      nodes,
      "aws_lb.main",
      arnIndex,
    );
    expect(cluster?.groups).toHaveLength(1);
    expect(cluster?.groups[0]?.sgPath).toBe("aws_security_group.lb");
    expect(
      edges.some(
        (e) =>
          e.source === "aws_lb.main" &&
          e.target === "aws_security_group.lb" &&
          e.type === "security_group",
      ),
    ).toBe(true);
  });

  it("resolves Lambda SG ref via security group ARN index", () => {
    const sgArn =
      "arn:aws:ec2:eu-west-1:222222222222:security-group/sg-0abc123";
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: {
                vpc_config: [
                  { subnet_ids: ["s1"], security_group_ids: [sgArn] },
                ],
              },
            },
          },
        },
      },
      "aws_security_group.main": {
        resources: {
          "aws_security_group.main": {
            address: "aws_security_group.main",
            mode: "managed",
            type: "aws_security_group",
            change: {
              after: { id: "sg-0abc123", arn: sgArn },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildLambdaSgCluster(
      nodes,
      "aws_lambda_function.fn",
      arnIndex,
    );
    expect(cluster?.groups[0]?.sgPath).toBe("aws_security_group.main");
  });

  it("collects security_group_ids from Terraform plan nested expression shapes", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: {
                vpc_config: [
                  {
                    subnet_ids: ["subnet-1"],
                    security_group_ids: [
                      { references: ["aws_security_group.lambda"] },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    };
    expect(
      collectLambdaVpcSecurityGroupRefs(nodes, "aws_lambda_function.fn"),
    ).toEqual(["aws_security_group.lambda"]);
  });

  it("resolves module-relative aws_security_group.* refs on Lambdas in child modules", () => {
    const nodes: TerraformPlanNodesMap = {
      "module.app.aws_lambda_function.reader": {
        resources: {
          "module.app.aws_lambda_function.reader": {
            address: "module.app.aws_lambda_function.reader",
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: {
                vpc_config: [
                  {
                    subnet_ids: ["subnet-a"],
                    security_group_ids: ["aws_security_group.reader_sg"],
                  },
                ],
              },
            },
          },
        },
      },
      "module.app.aws_security_group.reader_sg": {
        resources: {
          "module.app.aws_security_group.reader_sg": {
            address: "module.app.aws_security_group.reader_sg",
            mode: "managed",
            type: "aws_security_group",
            change: {
              after: { id: "sg-reader01", vpc_id: "vpc-1" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildLambdaSgCluster(
      nodes,
      "module.app.aws_lambda_function.reader",
      arnIndex,
    );
    expect(cluster?.groups[0]?.sgPath).toBe(
      "module.app.aws_security_group.reader_sg",
    );
  });

  it("infers sibling aws_security_group when create plan omits security_group_ids", () => {
    const lambdaAddr =
      "module.workload_reader_lambda.module.lambda.aws_lambda_function.this[0]";
    const sgAddr =
      "module.workload_reader_lambda.module.security_group[0].aws_security_group.this_name_prefix[0]";
    const nodes: TerraformPlanNodesMap = {
      [lambdaAddr]: {
        resources: {
          [lambdaAddr]: {
            address: lambdaAddr,
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["create"],
              before: null,
              after: {
                vpc_config: [
                  {
                    subnet_ids: [
                      "subnet-053dd576128a8aa57",
                      "subnet-0a342e3606f8ce4e8",
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      [sgAddr]: {
        resources: {
          [sgAddr]: {
            address: sgAddr,
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["create"],
              before: null,
              after: { description: "Security group for Lambda in VPC" },
            },
          },
        },
      },
    };

    expect(collectLambdaVpcSecurityGroupRefs(nodes, lambdaAddr)).toEqual([
      sgAddr,
    ]);

    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster, edges } = buildLambdaSgCluster(
      nodes,
      lambdaAddr,
      arnIndex,
    );
    expect(cluster?.groups).toHaveLength(1);
    expect(cluster?.groups[0]?.sgPath).toBe(sgAddr);
    expect(
      edges.some((e) => e.source === lambdaAddr && e.target === sgAddr),
    ).toBe(true);
  });

  it("skips ancestor inference when plan configuration is present but yields no resolvable SG refs", () => {
    const lambdaAddr =
      "module.workload_reader_lambda.module.lambda.aws_lambda_function.this[0]";
    const sgAddr =
      "module.workload_reader_lambda.module.security_group[0].aws_security_group.this_name_prefix[0]";
    const decoyAddr =
      "module.workload_reader_lambda.module.other.aws_security_group.unused[0]";
    const nodes: TerraformPlanNodesMap = {
      [lambdaAddr]: {
        resources: {
          [lambdaAddr]: {
            address: lambdaAddr,
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["create"],
              before: null,
              after: {
                vpc_config: [
                  {
                    subnet_ids: [
                      "subnet-053dd576128a8aa57",
                      "subnet-0a342e3606f8ce4e8",
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      [sgAddr]: {
        resources: {
          [sgAddr]: {
            address: sgAddr,
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["create"],
              before: null,
              after: { description: "Lambda SG" },
            },
          },
        },
      },
      [decoyAddr]: {
        resources: {
          [decoyAddr]: {
            address: decoyAddr,
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["create"],
              before: null,
              after: { description: "Other" },
            },
          },
        },
      },
    };
    const plan = {
      configuration: {
        root_module: {
          module_calls: {
            workload_reader_lambda: {
              module: {
                module_calls: {
                  lambda: {
                    expressions: {
                      vpc_security_group_ids: { references: ["local.use_vpc"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(collectLambdaVpcSecurityGroupRefs(nodes, lambdaAddr, plan)).toEqual(
      [],
    );
  });

  it("uses plan configuration references instead of inferring when security_group_ids are omitted", () => {
    const lambdaAddr =
      "module.workload_reader_lambda.module.lambda.aws_lambda_function.this[0]";
    const sgAddr =
      "module.workload_reader_lambda.module.security_group[0].aws_security_group.this_name_prefix[0]";
    const decoyAddr =
      "module.workload_reader_lambda.module.other.aws_security_group.unused[0]";
    const nodes: TerraformPlanNodesMap = {
      [lambdaAddr]: {
        resources: {
          [lambdaAddr]: {
            address: lambdaAddr,
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              actions: ["create"],
              before: null,
              after: {
                vpc_config: [
                  {
                    subnet_ids: [
                      "subnet-053dd576128a8aa57",
                      "subnet-0a342e3606f8ce4e8",
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      [sgAddr]: {
        resources: {
          [sgAddr]: {
            address: sgAddr,
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["create"],
              before: null,
              after: { description: "Lambda SG" },
            },
          },
        },
      },
      [decoyAddr]: {
        resources: {
          [decoyAddr]: {
            address: decoyAddr,
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["create"],
              before: null,
              after: { description: "Other" },
            },
          },
        },
      },
    };
    const plan = {
      configuration: {
        root_module: {
          module_calls: {
            workload_reader_lambda: {
              module: {
                module_calls: {
                  lambda: {
                    expressions: {
                      vpc_security_group_ids: {
                        references: [
                          "module.security_group[0].security_group_id",
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(collectLambdaVpcSecurityGroupRefs(nodes, lambdaAddr, plan)).toEqual([
      sgAddr,
    ]);
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildLambdaSgCluster(nodes, lambdaAddr, arnIndex, plan);
    expect(cluster?.groups).toHaveLength(1);
    expect(cluster?.groups[0]?.sgPath).toBe(sgAddr);
  });

  it("links SG rules on create when security_group_id is known-after-apply (sole SG in same module)", () => {
    const sgPath = "module.stack.aws_security_group.this[0]";
    const rulePath = "module.stack.aws_security_group_rule.egress[0]";
    const nodes: TerraformPlanNodesMap = {
      [sgPath]: {
        resources: {
          [sgPath]: {
            address: sgPath,
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["create"],
              before: null,
              after: { description: "Lambda SG" },
            },
          },
        },
      },
      [rulePath]: {
        resources: {
          [rulePath]: {
            address: rulePath,
            mode: "managed",
            type: "aws_security_group_rule",
            change: {
              actions: ["create"],
              before: null,
              after: {
                cidr_blocks: ["0.0.0.0/0"],
                type: "egress",
                from_port: 443,
                to_port: 443,
                protocol: "tcp",
              },
              after_unknown: { security_group_id: true },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const idIndex = buildSecurityGroupIdToPathIndex(nodes);
    expect(
      collectSecurityGroupRulesForSg(
        nodes,
        sgPath,
        arnIndex,
        idIndex,
        undefined,
      ),
    ).toEqual([rulePath]);
  });

  it("resolves rule security_group_id with .id suffix to the SG resource path", () => {
    const sgPath = "module.app.aws_security_group.main[0]";
    const rulePath = "module.app.aws_vpc_security_group_egress_rule.out[0]";
    const nodes: TerraformPlanNodesMap = {
      [sgPath]: {
        resources: {
          [sgPath]: {
            address: sgPath,
            mode: "managed",
            type: "aws_security_group",
            change: { after: { id: "sg-resolvedsuffix" } },
          },
        },
      },
      [rulePath]: {
        resources: {
          [rulePath]: {
            address: rulePath,
            mode: "managed",
            type: "aws_vpc_security_group_egress_rule",
            change: {
              after: { security_group_id: "aws_security_group.main[0].id" },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const idIndex = buildSecurityGroupIdToPathIndex(nodes);
    expect(
      collectSecurityGroupRulesForSg(nodes, sgPath, arnIndex, idIndex),
    ).toEqual([rulePath]);
  });

  it("links rules via plan configuration security_group_id.references when change omits id", () => {
    const sgPath = "module.m.aws_security_group.this[0]";
    const rulePath = "module.m.aws_security_group_rule.egress[0]";
    const nodes: TerraformPlanNodesMap = {
      [sgPath]: {
        resources: {
          [sgPath]: {
            address: sgPath,
            mode: "managed",
            type: "aws_security_group",
            change: { actions: ["create"], after: {} },
          },
        },
      },
      [rulePath]: {
        resources: {
          [rulePath]: {
            address: rulePath,
            mode: "managed",
            type: "aws_security_group_rule",
            change: {
              actions: ["create"],
              after: {
                type: "egress",
                protocol: "tcp",
                from_port: 443,
                to_port: 443,
              },
              after_unknown: { security_group_id: true },
            },
          },
        },
      },
    };
    const plan = {
      configuration: {
        root_module: {
          module_calls: {
            m: {
              module: {
                resources: [
                  {
                    address: "aws_security_group_rule.egress[0]",
                    mode: "managed",
                    type: "aws_security_group_rule",
                    name: "egress",
                    expressions: {
                      security_group_id: {
                        references: [
                          "aws_security_group.this[0].id",
                          "aws_security_group.this[0]",
                        ],
                      },
                    },
                    schema_version: 2,
                  },
                ],
              },
            },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const idIndex = buildSecurityGroupIdToPathIndex(nodes);
    expect(
      collectSecurityGroupRulesForSg(nodes, sgPath, arnIndex, idIndex, plan),
    ).toEqual([rulePath]);
  });

  it("buildDatastorePrimarySgCluster attaches module SG and rules under aws_rds_cluster", () => {
    const clusterPath = "module.api7_aurora.aws_rds_cluster.this";
    const sgPath =
      "module.api7_aurora.module.security_group.aws_security_group.this_name_prefix[0]";
    const egressPath =
      "module.api7_aurora.module.security_group.aws_security_group_rule.egress_rules[0]";
    const ingressPath =
      "module.api7_aurora.module.security_group.aws_security_group_rule.ingress_with_cidr_blocks[0]";
    const nodes: TerraformPlanNodesMap = {
      [clusterPath]: {
        resources: {
          [clusterPath]: {
            address: clusterPath,
            mode: "managed",
            type: "aws_rds_cluster",
            change: {
              actions: ["create"],
              after: {
                vpc_security_group_ids: ["sg-aurora"],
              },
            },
          },
        },
      },
      [sgPath]: {
        resources: {
          [sgPath]: {
            address: sgPath,
            mode: "managed",
            type: "aws_security_group",
            change: {
              actions: ["create"],
              after: { id: "sg-aurora" },
            },
          },
        },
      },
      [egressPath]: {
        resources: {
          [egressPath]: {
            address: egressPath,
            mode: "managed",
            type: "aws_security_group_rule",
            change: { actions: ["create"], after: { type: "egress" } },
          },
        },
      },
      [ingressPath]: {
        resources: {
          [ingressPath]: {
            address: ingressPath,
            mode: "managed",
            type: "aws_security_group_rule",
            change: { actions: ["create"], after: { type: "ingress" } },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    expect(collectDatastoreVpcSecurityGroupRefs(nodes, clusterPath)).toEqual([
      "sg-aurora",
    ]);
    const { cluster, edges } = buildDatastorePrimarySgCluster(
      nodes,
      clusterPath,
      arnIndex,
    );
    expect(cluster?.groups).toHaveLength(1);
    expect(cluster!.groups[0]!.sgPath).toBe(sgPath);
    expect(cluster!.groups[0]!.rules.sort()).toEqual(
      [egressPath, ingressPath].sort(),
    );
    expect(
      edges.some((e) => e.source === clusterPath && e.target === sgPath),
    ).toBe(true);
    const { cluster: viaPrimary } = buildPrimarySgCluster(
      nodes,
      clusterPath,
      arnIndex,
    );
    expect(viaPrimary?.groups[0]?.sgPath).toBe(sgPath);
    const consumed = collectTopologySatelliteAddressesFromRegistry(
      nodes,
      arnIndex,
      [clusterPath],
    );
    expect(consumed.has(sgPath)).toBe(true);
    expect(consumed.has(egressPath)).toBe(true);
    expect(consumed.has(ingressPath)).toBe(true);
  });

  it("infers module security group when vpc_security_group_ids is empty on create", () => {
    const instancePath = "module.api2_rds.aws_db_instance.this";
    const sgPath =
      "module.api2_rds.module.security_group.aws_security_group.this_name_prefix[0]";
    const nodes: TerraformPlanNodesMap = {
      [instancePath]: {
        resources: {
          [instancePath]: {
            address: instancePath,
            mode: "managed",
            type: "aws_db_instance",
            change: {
              actions: ["create"],
              after: { vpc_security_group_ids: [] },
            },
          },
        },
      },
      [sgPath]: {
        resources: {
          [sgPath]: {
            address: sgPath,
            mode: "managed",
            type: "aws_security_group",
            change: { actions: ["create"], after: {} },
          },
        },
      },
    };
    const arnIndex = buildArnIndexForTopology(nodes);
    const { cluster } = buildDatastorePrimarySgCluster(
      nodes,
      instancePath,
      arnIndex,
    );
    expect(cluster?.groups[0]?.sgPath).toBe(sgPath);
  });
});
