import { describe, expect, it } from "vitest";

import {
  buildLambdaSgPlanConfigIndexesForTests,
  collectLambdaVpcSecurityGroupRefsFromPlanConfiguration,
  hasTerraformPlanConfiguration,
  lastModuleCallSegmentFromPrefix,
  moduleCallSegmentsFromPrefix,
} from "./terraformTopologyLambdaSgPlanConfig";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformTopologyLambdaSgPlanConfig", () => {
  it("hasTerraformPlanConfiguration detects configuration.root_module", () => {
    expect(hasTerraformPlanConfiguration({})).toBe(false);
    expect(hasTerraformPlanConfiguration({ configuration: {} })).toBe(false);
    expect(
      hasTerraformPlanConfiguration({
        configuration: { root_module: { module_calls: {} } },
      }),
    ).toBe(true);
  });

  it("moduleCallSegmentsFromPrefix splits nested module path", () => {
    expect(moduleCallSegmentsFromPrefix("module.a.module.b")).toEqual([
      "a",
      "b",
    ]);
    expect(moduleCallSegmentsFromPrefix("module.a")).toEqual(["a"]);
  });

  it("lastModuleCallSegmentFromPrefix returns innermost module name", () => {
    expect(
      lastModuleCallSegmentFromPrefix(
        "module.workload_reader_lambda.module.lambda",
      ),
    ).toBe("lambda");
    expect(
      lastModuleCallSegmentFromPrefix("module.workload_reader_lambda"),
    ).toBe("workload_reader_lambda");
  });

  it("resolves vpc_security_group_ids.references to aws_security_group node paths", () => {
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
              after: {
                vpc_config: [{ subnet_ids: ["subnet-1"] }],
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
            change: { after: { id: "sg-target" } },
          },
        },
      },
      [decoyAddr]: {
        resources: {
          [decoyAddr]: {
            address: decoyAddr,
            mode: "managed",
            type: "aws_security_group",
            change: { after: { id: "sg-decoy" } },
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
                          "local.use_vpc",
                          "module.security_group[0].security_group_id",
                          "module.security_group[0]",
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

    expect(
      collectLambdaVpcSecurityGroupRefsFromPlanConfiguration(
        plan,
        lambdaAddr,
        nodes,
      ),
    ).toEqual([sgAddr]);
  });

  it("returns empty list when references are only locals (no SG resolution)", () => {
    const lambdaAddr = "module.stack.module.lambda.aws_lambda_function.this[0]";
    const sgAddr = "module.stack.module.sg.aws_security_group.this[0]";
    const nodes: TerraformPlanNodesMap = {
      [lambdaAddr]: {
        resources: {
          [lambdaAddr]: {
            address: lambdaAddr,
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: { vpc_config: [{ subnet_ids: ["s1"] }] },
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
            change: { after: { id: "sg-x" } },
          },
        },
      },
    };
    const plan = {
      configuration: {
        root_module: {
          module_calls: {
            stack: {
              module: {
                module_calls: {
                  lambda: {
                    expressions: {
                      vpc_security_group_ids: { references: ["local.only"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(
      collectLambdaVpcSecurityGroupRefsFromPlanConfiguration(
        plan,
        lambdaAddr,
        nodes,
      ),
    ).toEqual([]);
  });

  it("collects SG refs from root aws_lambda_function expressions (vpc_config.security_group_ids)", () => {
    const lambdaAddr = "aws_lambda_function.api[0]";
    const sgAddr = "aws_security_group.lambda_sg";
    const nodes: TerraformPlanNodesMap = {
      [lambdaAddr]: {
        resources: {
          [lambdaAddr]: {
            address: lambdaAddr,
            mode: "managed",
            type: "aws_lambda_function",
            change: {
              after: { vpc_config: [{ subnet_ids: ["s1"] }] },
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
            change: { after: { id: "sg-root" } },
          },
        },
      },
    };
    const plan = {
      configuration: {
        root_module: {
          resources: [
            {
              address: "aws_lambda_function.api[0]",
              mode: "managed",
              type: "aws_lambda_function",
              name: "api",
              expressions: {
                vpc_config: [
                  {
                    subnet_ids: { references: ["aws_subnet.main"] },
                    security_group_ids: {
                      references: ["aws_security_group.lambda_sg"],
                    },
                  },
                ],
              },
              schema_version: 0,
            },
          ],
        },
      },
    };
    expect(
      collectLambdaVpcSecurityGroupRefsFromPlanConfiguration(
        plan,
        lambdaAddr,
        nodes,
      ),
    ).toEqual([sgAddr]);
  });

  it("indexes module_calls vpc_security_group_ids under child module prefix", () => {
    const plan = {
      configuration: {
        root_module: {
          module_calls: {
            stack: {
              module: {
                module_calls: {
                  lambda: {
                    expressions: {
                      vpc_security_group_ids: {
                        references: ["module.sg.aws_security_group.this"],
                      },
                    },
                    module: {},
                  },
                },
              },
            },
          },
        },
      },
    };
    const idx = buildLambdaSgPlanConfigIndexesForTests(plan);
    expect(idx?.moduleCallVpcSgRefs.get("module.stack.module.lambda")).toEqual([
      "module.sg.aws_security_group.this",
    ]);
  });
});
