/**
 * Single-pass AWS plan indexes shared across placement extract, enrich, and layout.
 */
import {
  buildRouteTablePlanIndexes,
  type RouteTablePlanIndexes,
} from "./terraformTopologyPlacement";
import {
  buildSecurityGroupToVpcMapFromPlan,
  buildSubnetOwnerHintsFromPlan,
  buildSubnetToVpcMapFromPlan,
} from "./terraformTopologyExtract";

import type { TerraformSubnetOwnerHint } from "./terraformTopologyExtract";

export type AwsLayoutPlan = {
  resource_changes?: Array<{
    address?: string;
    mode?: string;
    type?: string;
    [key: string]: unknown;
  }>;
};

export type AwsLayoutContext = {
  plan: AwsLayoutPlan;
  changeByAddress: Map<string, AwsLayoutPlan["resource_changes"] extends
    | (infer R)[]
    | undefined
    ? R
    : never>;
  subnetToVpc: Map<string, string>;
  securityGroupToVpc: Map<string, string>;
  subnetOwners: Map<string, TerraformSubnetOwnerHint>;
  routeTableIndexes: RouteTablePlanIndexes | null;
};

export function buildAwsLayoutContext(plan: AwsLayoutPlan): AwsLayoutContext {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const changeByAddress = new Map<
    string,
    NonNullable<AwsLayoutPlan["resource_changes"]>[number]
  >();
  for (const rc of changes) {
    if (rc && typeof rc === "object" && typeof rc.address === "string") {
      changeByAddress.set(rc.address, rc);
    }
  }
  return {
    plan,
    changeByAddress,
    subnetToVpc: buildSubnetToVpcMapFromPlan(plan),
    securityGroupToVpc: buildSecurityGroupToVpcMapFromPlan(plan),
    subnetOwners: buildSubnetOwnerHintsFromPlan(plan),
    routeTableIndexes:
      changes.length > 0
        ? buildRouteTablePlanIndexes(
            plan as Parameters<typeof buildRouteTablePlanIndexes>[0],
          )
        : null,
  };
}
