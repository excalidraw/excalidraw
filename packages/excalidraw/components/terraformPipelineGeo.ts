/**
 * Geographic placement paths for pipeline layout atoms.
 */

import {
  buildTopologySubnetNameMap,
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
  topologySubnetTierFromZone,
  type TopologyPlacementZone,
  type TopologySubnetTier,
} from "./terraformTopologyPlacement";
import { enrichTopologyPlacementsWithManagedResources } from "./terraformTopologyPlacementEnrich";
import { isPrimaryVisibleResourceType } from "./terraformPrimaryVisibility";
import { getTopologyResourceType } from "./terraformTopologySatelliteResolve";

import type { PipelineAtomGraph } from "./terraformPipelineAtoms";
import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export type PipelineGeoTier = TopologySubnetTier | "regional";

export type PipelineGeoPath = {
  accountId: string;
  region: string;
  vpcId: string | null;
  tier: PipelineGeoTier;
  subnetSignature: string;
};

export type PipelineAtomGeoMap = Map<string, PipelineGeoPath>;

const REGIONAL_BUCKET_KEY = "\0";

function zoneKey(z: TopologyPlacementZone): string {
  return `${z.accountId}\0${z.region}\0${z.vpcId}\0${z.subnetSignature}`;
}

function regionalKey(accountId: string, region: string): string {
  return `${accountId}${REGIONAL_BUCKET_KEY}${region}`;
}

function buildPlacementLookups(
  plan: unknown,
  nodes: TerraformPlanNodesMap,
  atomPrimaries: readonly string[],
) {
  const primaryZones = extractPrimaryTopologyZones(
    plan as Parameters<typeof extractPrimaryTopologyZones>[0],
  );
  const regionalBuckets = extractRegionalTopologyPrimaries(
    plan as Parameters<typeof extractRegionalTopologyPrimaries>[0],
  );

  const zones = [...primaryZones];
  enrichTopologyPlacementsWithManagedResources(
    plan as Parameters<typeof enrichTopologyPlacementsWithManagedResources>[0],
    zones,
    regionalBuckets,
    { nodes, plan, preplacedAddresses: new Set<string>() },
  );

  const addressToZone = new Map<string, TopologyPlacementZone>();
  for (const z of zones) {
    for (const addr of z.addresses) {
      addressToZone.set(addr, z);
    }
  }

  const addressToRegional = new Map<
    string,
    { accountId: string; region: string }
  >();
  for (const b of regionalBuckets) {
    for (const addr of b.addresses) {
      addressToRegional.set(addr, {
        accountId: b.accountId,
        region: b.region,
      });
    }
  }

  return { addressToZone, addressToRegional, subnetNameById: buildTopologySubnetNameMap(plan) };
}

export function buildPipelineAtomGeoMap(
  atomGraph: PipelineAtomGraph,
  nodes: TerraformPlanNodesMap,
  plan: unknown,
): PipelineAtomGeoMap {
  const primaries = [...atomGraph.atoms.keys()];
  const { addressToZone, addressToRegional, subnetNameById } =
    buildPlacementLookups(plan, nodes, primaries);

  const out: PipelineAtomGeoMap = new Map();

  for (const primaryAddress of primaries) {
    const zone = addressToZone.get(primaryAddress);
    if (zone) {
      const tier = topologySubnetTierFromZone(zone, subnetNameById);
      out.set(primaryAddress, {
        accountId: zone.accountId,
        region: zone.region,
        vpcId: zone.vpcId,
        tier,
        subnetSignature: zone.subnetSignature,
      });
      continue;
    }

    const regional = addressToRegional.get(primaryAddress);
    if (regional) {
      out.set(primaryAddress, {
        accountId: regional.accountId,
        region: regional.region,
        vpcId: null,
        tier: "regional",
        subnetSignature: "",
      });
      continue;
    }

    const node = nodes[primaryAddress] as TerraformPlanGraphNode | undefined;
    const t = getTopologyResourceType(primaryAddress, node);
    if (t && isPrimaryVisibleResourceType(t)) {
      out.set(primaryAddress, {
        accountId: "unknown-account",
        region: "unknown-region",
        vpcId: null,
        tier: "regional",
        subnetSignature: "",
      });
    }
  }

  return out;
}

export function pipelineGeoInstanceKey(geo: PipelineGeoPath, instanceId: number): string {
  return [
    geo.accountId,
    geo.region,
    geo.vpcId ?? "regional",
    geo.tier,
    geo.subnetSignature,
    String(instanceId),
  ].join("|");
}

export function pipelineGeoPrefixKey(geo: PipelineGeoPath, instanceId: number): string {
  return `${geo.accountId}|${geo.region}|${geo.vpcId ?? "regional"}|${instanceId}`;
}

export function samePipelineGeoPlacement(a: PipelineGeoPath, b: PipelineGeoPath): boolean {
  return (
    a.accountId === b.accountId &&
    a.region === b.region &&
    a.vpcId === b.vpcId &&
    a.tier === b.tier &&
    a.subnetSignature === b.subnetSignature
  );
}

export function pipelineGeoTierLabel(tier: PipelineGeoTier): string {
  switch (tier) {
    case "public":
      return "Public";
    case "private":
      return "Private";
    case "intra":
      return "Intra";
    case "vpcOnly":
      return "VPC";
    case "other":
      return "Subnet";
    case "regional":
      return "Regional";
    default:
      return String(tier);
  }
}
