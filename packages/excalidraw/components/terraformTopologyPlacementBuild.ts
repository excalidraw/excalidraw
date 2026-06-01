import {
  computeNatGatewayZonePlacements,
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
  extractSupplementarySubnetZones,
  extractVpcDefaultPlumbingBuckets,
  mergePrimaryTopologyZonesByTier,
  mergeSupplementarySubnetZonesByTier,
  mergeSupplementarySubnetZonesSharedRouteTable,
  natZonePlacementsKey,
  reconcileTopologyPlacementZonesAfterEnrich,
  topologySubnetTierFromZone,
  buildTopologySubnetNameMap,
  type TopologyNatZonePlacements,
  type TopologyPlacementZone,
  type TopologyRegionalPrimaryBucket,
  type TopologyVpcDefaultPlumbingBucket,
} from "./terraformTopologyPlacement";
import { enrichTopologyPlacementsWithManagedResources } from "./terraformTopologyPlacementEnrich";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

type AwsPlan = Parameters<typeof extractPrimaryTopologyZones>[0];

export type TopologyAddressPlacement = {
  providerFamily: string;
  accountId: string;
  region: string;
  vpcId: string | null;
  subnetSignature?: string;
  subnetIds?: string[];
  subnetTier?: string;
};

export type EnrichedTopologyPlacements = {
  zones: TopologyPlacementZone[];
  regionalBuckets: TopologyRegionalPrimaryBucket[];
  vpcDefaultPlumbingBuckets: TopologyVpcDefaultPlumbingBucket[];
  natZonePlacements: TopologyNatZonePlacements;
};

function sortTopologyPlacementZones(
  a: TopologyPlacementZone,
  b: TopologyPlacementZone,
): number {
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
}

export function buildMergedTopologyZones(
  plan: AwsPlan,
): TopologyPlacementZone[] {
  const primaryZones = mergePrimaryTopologyZonesByTier(
    extractPrimaryTopologyZones(plan).map((z) => ({
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
  return mergeSupplementarySubnetZonesByTier(
    mergeSupplementarySubnetZonesSharedRouteTable(
      [...primaryZones, ...supplementaryZones].sort(sortTopologyPlacementZones),
      plan,
    ),
    plan,
  );
}

export function buildVpcDefaultPlumbingWithNat(
  plan: AwsPlan,
  zones: readonly TopologyPlacementZone[],
): Pick<
  EnrichedTopologyPlacements,
  "vpcDefaultPlumbingBuckets" | "natZonePlacements"
> {
  const rawVpcDefaultPlumbingBuckets = extractVpcDefaultPlumbingBuckets(plan);
  const natZonePlacements = computeNatGatewayZonePlacements(plan, zones);
  const vpcDefaultPlumbingBuckets =
    natZonePlacements.consumedAddresses.size === 0
      ? rawVpcDefaultPlumbingBuckets
      : rawVpcDefaultPlumbingBuckets
          .map((b) => ({
            ...b,
            addresses: b.addresses.filter(
              (a) => !natZonePlacements.consumedAddresses.has(a),
            ),
          }))
          .filter((b) => b.addresses.length > 0);
  return { vpcDefaultPlumbingBuckets, natZonePlacements };
}

export function collectTopologyPreplacedAddresses(
  sources: ReadonlyArray<{ addresses: readonly string[] }>,
): Set<string> {
  const out = new Set<string>();
  for (const source of sources) {
    for (const address of source.addresses) {
      out.add(address);
    }
  }
  return out;
}

function baseEnrichPreplaced(state: EnrichedTopologyPlacements): Set<string> {
  const preplaced = collectTopologyPreplacedAddresses([
    ...state.zones,
    ...state.regionalBuckets,
    ...state.vpcDefaultPlumbingBuckets,
  ]);
  for (const address of state.natZonePlacements.consumedAddresses) {
    preplaced.add(address);
  }
  return preplaced;
}

export function enrichAndReconcileTopologyPlacements(
  state: EnrichedTopologyPlacements,
  plan: AwsPlan,
  nodes: TerraformPlanNodesMap,
  additionalPreplacedAddresses?: Iterable<string>,
): void {
  const preplaced = baseEnrichPreplaced(state);
  if (additionalPreplacedAddresses) {
    for (const address of additionalPreplacedAddresses) {
      preplaced.add(address);
    }
  }
  enrichTopologyPlacementsWithManagedResources(
    plan,
    state.zones,
    state.regionalBuckets,
    {
      nodes,
      plan,
      preplacedAddresses: preplaced,
    },
  );
  reconcileTopologyPlacementZonesAfterEnrich(state.zones, plan);
}

export function buildTopologyPlacementFoundation(
  plan: AwsPlan,
): EnrichedTopologyPlacements {
  const zones = buildMergedTopologyZones(plan);
  const regionalBuckets = extractRegionalTopologyPrimaries(plan);
  const { vpcDefaultPlumbingBuckets, natZonePlacements } =
    buildVpcDefaultPlumbingWithNat(plan, zones);
  return {
    zones,
    regionalBuckets,
    vpcDefaultPlumbingBuckets,
    natZonePlacements,
  };
}

export function buildEnrichedTopologyPlacements(
  plan: AwsPlan,
  nodes: TerraformPlanNodesMap,
  options?: {
    additionalPreplacedAddresses?: Iterable<string>;
  },
): EnrichedTopologyPlacements {
  const state = buildTopologyPlacementFoundation(plan);
  enrichAndReconcileTopologyPlacements(
    state,
    plan,
    nodes,
    options?.additionalPreplacedAddresses,
  );
  return state;
}

function zoneByNatPlacementKey(
  zones: readonly TopologyPlacementZone[],
): Map<string, TopologyPlacementZone> {
  const out = new Map<string, TopologyPlacementZone>();
  for (const zone of zones) {
    out.set(
      natZonePlacementsKey(
        zone.accountId,
        zone.region,
        zone.vpcId,
        zone.subnetSignature,
      ),
      zone,
    );
  }
  return out;
}

function setPlacementFromZone(
  out: Map<string, TopologyAddressPlacement>,
  zone: TopologyPlacementZone,
  address: string,
  subnetNames: ReturnType<typeof buildTopologySubnetNameMap>,
): void {
  if (out.has(address)) {
    return;
  }
  out.set(address, {
    providerFamily: "aws",
    accountId: zone.accountId,
    region: zone.region,
    vpcId: zone.vpcId,
    subnetSignature: zone.subnetSignature,
    subnetIds: zone.subnetIds,
    subnetTier: topologySubnetTierFromZone(zone, subnetNames),
  });
}

export function topologyAddressPlacementMap(
  enriched: EnrichedTopologyPlacements,
  plan: AwsPlan,
): Map<string, TopologyAddressPlacement> {
  const out = new Map<string, TopologyAddressPlacement>();
  const subnetNames = buildTopologySubnetNameMap(plan);
  const zonesByNatKey = zoneByNatPlacementKey(enriched.zones);

  for (const zone of enriched.zones) {
    for (const address of zone.addresses) {
      setPlacementFromZone(out, zone, address, subnetNames);
    }
  }

  for (const bucket of enriched.regionalBuckets) {
    for (const address of bucket.addresses) {
      if (out.has(address)) {
        continue;
      }
      out.set(address, {
        providerFamily: "aws",
        accountId: bucket.accountId,
        region: bucket.region,
        vpcId: null,
      });
    }
  }

  for (const bucket of enriched.vpcDefaultPlumbingBuckets) {
    for (const address of bucket.addresses) {
      if (out.has(address)) {
        continue;
      }
      out.set(address, {
        providerFamily: "aws",
        accountId: bucket.accountId,
        region: bucket.region,
        vpcId: bucket.vpcId,
      });
    }
  }

  for (const [zoneKey, clusters] of enriched.natZonePlacements.byZone) {
    const zone = zonesByNatKey.get(zoneKey);
    if (!zone) {
      continue;
    }
    for (const cluster of clusters) {
      setPlacementFromZone(out, zone, cluster.natAddress, subnetNames);
      for (const eipAddress of cluster.eipAddresses) {
        setPlacementFromZone(out, zone, eipAddress, subnetNames);
      }
    }
  }

  return out;
}
