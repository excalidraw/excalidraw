import { describe, expect, it } from "vitest";

import {
  collectSgRuleSecurityGroupIdRefsFromPlanConfiguration,
  getSgRuleSecurityGroupIdRefIndex,
} from "./terraformTopologySgRulePlanConfig";

describe("terraformTopologySgRulePlanConfig", () => {
  const planWithIngressRule = {
    configuration: {
      root_module: {
        resources: [
          {
            type: "aws_vpc_security_group_ingress_rule",
            address: "aws_vpc_security_group_ingress_rule.ssh",
            expressions: {
              security_group_id: {
                references: ["aws_security_group.web"],
              },
            },
          },
        ],
      },
    },
  };

  it("getSgRuleSecurityGroupIdRefIndex collects SG id expression refs by normalized address", () => {
    const idx = getSgRuleSecurityGroupIdRefIndex(planWithIngressRule);
    expect(idx).not.toBeNull();
    expect(
      idx!.get("aws_vpc_security_group_ingress_rule.ssh"),
    ).toEqual(["aws_security_group.web"]);
  });

  it("collectSgRuleSecurityGroupIdRefsFromPlanConfiguration returns refs for a rule address", () => {
    expect(
      collectSgRuleSecurityGroupIdRefsFromPlanConfiguration(
        planWithIngressRule,
        "aws_vpc_security_group_ingress_rule.ssh",
      ),
    ).toEqual(["aws_security_group.web"]);
  });

  it("returns null / empty when configuration is missing", () => {
    expect(getSgRuleSecurityGroupIdRefIndex({})).toBeNull();
    expect(
      collectSgRuleSecurityGroupIdRefsFromPlanConfiguration(
        {},
        "aws_vpc_security_group_ingress_rule.ssh",
      ),
    ).toBeNull();
  });
});
