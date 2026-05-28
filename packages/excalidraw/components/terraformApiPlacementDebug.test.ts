import { describe, expect, it } from "vitest";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import {
  namespacePlanDotBundles,
  mergePlanJsons,
} from "./terraformImportMerge";
import {
  buildTopologySubnetNameMap,
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
  mergePrimaryTopologyZonesByTier,
  topologySubnetTierFromZone,
} from "./terraformTopologyPlacement";
import {
  isPrivateVpcEndpointBoundRestApi,
  resolveVpcPlacementFromPrivateRestApi,
} from "./terraformTopologyApiGatewayLinks";
import {
  asTerraformTopologyPlan,
  buildSubnetToVpcMapFromPlan,
  pickResourceValuesForTopologyPlacement,
  type ResourceChange,
} from "./terraformTopologyExtract";

describe("staging private API VPC placement", () => {
  it("places module.api REST APIs in VPC zones via execute-api VPCE", () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const plan = asTerraformTopologyPlan(merged.plan);
    const subnetToVpc = buildSubnetToVpcMapFromPlan(plan);
    const zones = mergePrimaryTopologyZonesByTier(
      extractPrimaryTopologyZones(plan).map((z) => ({
        ...z,
        topologyZoneSource: "primary" as const,
      })),
      plan,
    );
    const regional = extractRegionalTopologyPrimaries(plan);
    const subnetNameById = buildTopologySubnetNameMap(plan);

    const apiRcs = (plan.resource_changes ?? []).filter(
      (rc: ResourceChange) =>
        rc.type === "aws_api_gateway_rest_api" &&
        typeof rc.address === "string" &&
        rc.address.includes("module.api.aws_api_gateway_rest_api.private"),
    );
    expect(apiRcs.length).toBeGreaterThanOrEqual(5);

    for (const rc of apiRcs) {
      const values = pickResourceValuesForTopologyPlacement(rc);
      expect(values).toBeTruthy();
      expect(isPrivateVpcEndpointBoundRestApi(values!)).toBe(true);
      const vpce = resolveVpcPlacementFromPrivateRestApi(
        plan,
        values!,
        subnetToVpc,
      );
      expect(vpce).toBeTruthy();
      const addr = rc.address as string;
      expect(zones.some((z) => z.addresses.includes(addr))).toBe(true);
      expect(regional.some((b) => b.addresses.includes(addr))).toBe(false);

      const stackPrefix = addr.split("::")[0]!;
      const lambdaAddr = (plan.resource_changes ?? []).find(
        (r: ResourceChange) =>
          r.type === "aws_lambda_function" &&
          typeof r.address === "string" &&
          r.address.startsWith(`${stackPrefix}::module.api.`),
      )?.address;
      expect(lambdaAddr).toBeDefined();
      const apiZone = zones.find((z) => z.addresses.includes(addr));
      const lambdaZone = zones.find((z) => z.addresses.includes(lambdaAddr!));
      expect(apiZone).toBeDefined();
      expect(lambdaZone).toBeDefined();
      expect(apiZone).not.toBe(lambdaZone);
      expect(topologySubnetTierFromZone(apiZone!, subnetNameById)).toBe(
        "intra",
      );
      expect(topologySubnetTierFromZone(lambdaZone!, subnetNameById)).toBe(
        "private",
      );
    }
  });
});
