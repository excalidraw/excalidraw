import { describe, expect, it } from "vitest";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import {
  namespacePlanDotBundles,
  mergePlanJsons,
} from "./terraformImportMerge";
import { enrichTopologyPlacementsWithManagedResources } from "./terraformTopologyPlacementEnrich";
import {
  extractPrimaryTopologyZones,
  extractSupplementarySubnetZones,
  extractVpcFlowLogBundles,
  mergePrimaryTopologyZonesByTier,
  mergeSupplementarySubnetZonesByTier,
  mergeSupplementarySubnetZonesSharedRouteTable,
} from "./terraformTopologyPlacement";

import { asTerraformTopologyPlan } from "./terraformTopologyExtract";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("staging VPC flow log placement", () => {
  it("keeps flow log module out of intra subnet zones", () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const plan = asTerraformTopologyPlan(merged.plan);
    const rawPrimary = extractPrimaryTopologyZones(plan);
    const primaryZones = mergePrimaryTopologyZonesByTier(
      rawPrimary.map((z) => ({
        ...z,
        topologyZoneSource: "primary" as const,
      })),
      plan,
    );
    const supplementaryZones = extractSupplementarySubnetZones(
      plan,
      primaryZones,
    ).map((z) => ({
      ...z,
      topologyZoneSource: "supplementary" as const,
    }));
    const zones = mergeSupplementarySubnetZonesByTier(
      mergeSupplementarySubnetZonesSharedRouteTable(
        [...primaryZones, ...supplementaryZones].sort((a, b) => {
          if (a.accountId !== b.accountId) {
            return a.accountId.localeCompare(b.accountId);
          }
          if (a.region !== b.region) {
            return a.region.localeCompare(b.region);
          }
          if (a.vpcId !== b.vpcId) {
            return a.vpcId.localeCompare(b.vpcId);
          }
          return a.subnetSignature.localeCompare(b.subnetSignature);
        }),
        plan,
      ),
      plan,
    );
    const flowBuckets = extractVpcFlowLogBundles(plan);
    const flowAddrs = new Set(flowBuckets.flatMap((b) => b.addresses));
    const planFlowAddrs = (plan.resource_changes ?? [])
      .map((rc) => rc.address)
      .filter(
        (a): a is string =>
          typeof a === "string" && a.includes("vpc_flow_logs"),
      );
    expect(planFlowAddrs.every((a) => flowAddrs.has(a))).toBe(true);

    const enrichPreplaced = new Set<string>();
    for (const z of zones) {
      for (const a of z.addresses) {
        enrichPreplaced.add(a);
      }
    }
    for (const b of flowBuckets) {
      for (const a of b.addresses) {
        enrichPreplaced.add(a);
      }
    }
    const nodes: TerraformPlanNodesMap = {};
    for (const rc of plan.resource_changes ?? []) {
      if (rc.address) {
        nodes[rc.address] = {
          resources: { [rc.address]: rc },
        } as TerraformPlanNodesMap[string];
      }
    }
    enrichTopologyPlacementsWithManagedResources(plan, zones, [], {
      nodes,
      plan,
      preplacedAddresses: enrichPreplaced,
    });

    const flowInIntraZone = zones
      .filter((z) => z.subnetIds.some((sid) => /intra/i.test(sid)))
      .flatMap((z) => z.addresses)
      .filter((a) => a.includes("vpc_flow_logs"));
    expect(flowInIntraZone).toEqual([]);
  });
});
