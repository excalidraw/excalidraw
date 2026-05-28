import { describe, expect, it } from "vitest";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import {
  namespacePlanDotBundles,
  mergePlanJsons,
} from "./terraformImportMerge";
import { extractRegionalTopologyPrimaries } from "./terraformTopologyPlacement";
import {
  buildTransitGatewayCompanionCluster,
  transitGatewayCompanionSatellitePaths,
} from "./terraformTopologyTransitGatewayLinks";

import {
  asTerraformTopologyPlan,
  type ResourceChange,
} from "./terraformTopologyExtract";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("staging transit gateway placement", () => {
  it("groups east/west TGW attachments as regional satellites", () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const plan = asTerraformTopologyPlan(merged.plan);
    const regional = extractRegionalTopologyPrimaries(plan);
    const tgwAddrs = (plan.resource_changes ?? [])
      .filter(
        (rc: ResourceChange): rc is ResourceChange & { address: string } =>
          rc.type === "aws_ec2_transit_gateway" &&
          typeof rc.address === "string",
      )
      .map((rc) => rc.address);
    expect(tgwAddrs.length).toBeGreaterThanOrEqual(2);

    const nodes: TerraformPlanNodesMap = {};
    for (const rc of plan.resource_changes ?? []) {
      if (rc.address) {
        nodes[rc.address] = {
          resources: { [rc.address]: rc },
        } as TerraformPlanNodesMap[string];
      }
    }

    for (const tgwAddr of tgwAddrs) {
      expect(regional.some((b) => b.addresses.includes(tgwAddr))).toBe(true);
      const { cluster } = buildTransitGatewayCompanionCluster(
        nodes,
        tgwAddr,
        plan.resource_changes,
      );
      expect(cluster).toBeTruthy();
      const satellites = transitGatewayCompanionSatellitePaths(cluster!);
      expect(satellites.length).toBeGreaterThan(0);
      for (const sat of satellites) {
        expect(regional.some((b) => b.addresses.includes(sat))).toBe(true);
      }
    }
  });
});
