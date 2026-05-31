import { describe, expect, it } from "vitest";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import graphlibDot from "@dagrejs/graphlib-dot";

import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import {
  filterPlanByProviderFamily,
  type TerraformResourceChangeLike,
} from "./terraformProviderClassification";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";
import {
  buildTopologySubnetNameMap,
  extractPrimaryTopologyZones,
  mergePrimaryTopologyZonesByTier,
  topologySubnetTierFromZone,
} from "./terraformTopologyPlacement";
import { enrichTopologyPlacementsWithManagedResources } from "./terraformTopologyPlacementEnrich";

function expandedAwsPlan() {
  const sources = getTerraformImportPresetSourcesFromDb(
    "staging-multi-state-expanded",
  );
  expect(sources).not.toBeNull();
  const ns = namespacePlanDotBundles(sources!.planDotBundles);
  const merged = mergePlanJsons(
    ns.bundles.map((b) => b.plan),
    ns.bundles.map((b) => b.label),
  );
  const awsPlan = filterPlanByProviderFamily(
    merged.plan as { resource_changes?: TerraformResourceChangeLike[] },
    "aws",
  );
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
    adjacency: {},
    priorStatePlans: merged.sourcePlans,
    stackIds: ns.stackIds,
  });
  const primaryZones = extractPrimaryTopologyZones(awsPlan);
  const subnetNameById = buildTopologySubnetNameMap(awsPlan);
  const zones = mergePrimaryTopologyZonesByTier(
    primaryZones.map((z) => ({
      ...z,
      topologyZoneSource: "primary" as const,
    })),
    awsPlan,
  );
  const regional: Parameters<
    typeof enrichTopologyPlacementsWithManagedResources
  >[2] = [];
  enrichTopologyPlacementsWithManagedResources(awsPlan, zones, regional, {
    nodes,
    plan: awsPlan,
    preplacedAddresses: new Set(),
  });
  return { awsPlan, zones, regional, subnetNameById };
}

function zoneForAddress(
  zones: ReturnType<typeof extractPrimaryTopologyZones>,
  addressPart: string,
) {
  return zones.find((z) => z.addresses.some((a) => a.includes(addressPart)));
}

describe("staging-multi-state-expanded topology subnet placement", () => {
  it("places ECS, Lambda, and RDS/Aurora in VPC zones with correct tiers", () => {
    const { zones, regional, subnetNameById } = expandedAwsPlan();

    const producerZone = zoneForAddress(zones, "aws_ecs_service.producer");
    expect(producerZone).toBeDefined();
    expect(regional.some((b) => b.addresses.some((a) => a.includes("producer")))).toBe(
      false,
    );
    expect(topologySubnetTierFromZone(producerZone!, subnetNameById)).toBe(
      "private",
    );
    expect(producerZone!.subnetIds.length).toBeGreaterThan(0);

    const lambdaZone = zoneForAddress(
      zones,
      "module.consumer_lambda.module.lambda.aws_lambda_function",
    );
    expect(lambdaZone).toBeDefined();
    expect(
      regional.some((b) =>
        b.addresses.some((a) => a.includes("consumer_lambda")),
      ),
    ).toBe(false);

    const rdsZone = zoneForAddress(zones, "module.api2_rds.aws_db_instance");
    expect(rdsZone).toBeDefined();
    expect(rdsZone!.subnetIds.length).toBeGreaterThan(0);

    const auroraZone = zoneForAddress(zones, "module.api3_aurora.aws_rds_cluster");
    expect(auroraZone).toBeDefined();
    expect(auroraZone!.subnetIds.length).toBeGreaterThan(0);
  }, 120_000);

  it("semantic layout: ECS producer is under a private subnetZone frame", async () => {
    const { zones } = expandedAwsPlan();
    const producerZone = zoneForAddress(zones, "aws_ecs_service.producer");
    expect(producerZone?.subnetIds.length).toBeGreaterThan(0);

    const sources = getTerraformImportPresetSourcesFromDb(
      "staging-multi-state-expanded",
    );
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: sources!.planDotBundles,
        states: [],
        stateLabels: [],
        tfdTexts: sources!.tfdTexts,
        tfdLabels: sources!.tfdLabels,
      },
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    const elements = (await res.json()).elements as Array<{
      id: string;
      type?: string;
      frameId?: string | null;
      name?: string | null;
      customData?: {
        terraformTopologyRole?: string;
        terraformSubnetIds?: string[];
        nodePath?: string;
        terraformVisibilityRole?: string;
      };
    }>;
    const byId = new Map(elements.map((e) => [e.id, e]));

    const producer = elements.find(
      (e) =>
        e.type === "rectangle" &&
        e.customData?.terraformVisibilityRole === "resource" &&
        e.customData?.nodePath?.includes("aws_ecs_service.producer"),
    );
    expect(producer).toBeDefined();

    let current: string | null | undefined = producer!.frameId;
    const seen = new Set<string>();
    let subnetZone: (typeof elements)[number] | undefined;
    while (current && !seen.has(current)) {
      seen.add(current);
      const el = byId.get(current);
      if (el?.type === "frame" && el.customData?.terraformTopologyRole === "subnetZone") {
        subnetZone = el;
        break;
      }
      current = el?.frameId;
    }
    expect(subnetZone).toBeDefined();
    expect(subnetZone!.name).toMatch(/private/i);
    expect(
      subnetZone!.customData?.terraformSubnetIds?.some((id) =>
        producerZone!.subnetIds.includes(id),
      ),
    ).toBe(true);
  }, 180_000);
});
