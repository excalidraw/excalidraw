/**
 * Second-pass placement for managed resources missing from primary/regional extractors.
 * Skips anything already placed or rendered as a primary satellite.
 */
import {
  isPrimaryVisibleResourceType,
  isTopologyPlacementResourceType,
} from "./terraformPrimaryVisibility";
import {
  parseStackAddress,
  stripStackPrefixForModuleParsing,
} from "./terraformStackAddress";
import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import { collectTopologySatelliteAddressesFromRegistry } from "./terraformTopologySatelliteRegistry";

import "./terraformTopologySatelliteRegistry";
import {
  buildSecurityGroupToVpcMapFromPlan,
  buildSubnetOwnerHintsFromPlan,
  buildSubnetToVpcMapFromPlan,
  isAwsTerraformResourceChange,
  mergeTerraformTopologyAccountRegionFromSameRegionSubnets,
  mergeTerraformTopologyAccountRegionFromSubnets,
  mergeWithDefaultAwsProviderAccountRegion,
  pickResourceValuesForTopologyPlacement,
  resolveTerraformTopologyAccountRegion,
  shouldEmitTopologyPlacement,
  type ResourceChange,
  type TerraformPlanProviderContext,
} from "./terraformTopologyExtract";
import {
  applySubnetInferenceFromSecurityGroups,
  collectPlacementSubnetIds,
  resolveTopologyVpcId,
  topologyZoneMapKey,
  flowLogModuleBundlePrefixForAddress,
  type TopologyPlacementZone,
  type TopologyRegionalPrimaryBucket,
} from "./terraformTopologyPlacement";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

const REGIONAL_BUCKET_KEY_SEP = "\0";

/** Types represented by VPC/subnet frames, not regional resource tiles. */
const REGIONAL_PLACEMENT_EXCLUDED_TYPES = new Set(["aws_subnet", "aws_vpc"]);

/** Account/region tiles only — never inherit VPC zones from sibling modules. */
const REGIONAL_ONLY_TOPOLOGY_TYPES = new Set(["aws_ssm_parameter"]);

export type TopologyPlacementBucket = {
  addresses: readonly string[];
};

export type EnrichTopologyPlacementsOptions = {
  nodes: TerraformPlanNodesMap;
  plan?: unknown;
  /** Addresses already laid out elsewhere (other buckets, route tables, etc.). */
  preplacedAddresses?: Iterable<string>;
};

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function bucketMapKey(accountId: string, region: string): string {
  return `${accountId}${REGIONAL_BUCKET_KEY_SEP}${region}`;
}

function zoneMapKey(
  accountId: string,
  region: string,
  vpcId: string,
  subnetSignature: string,
): string {
  return topologyZoneMapKey(accountId, region, vpcId, subnetSignature);
}

function modulePlacementKeysForAddress(address: string): string[] {
  const stackId = parseStackAddress(address)?.stackId;
  const bare = stripStackPrefixForModuleParsing(address);
  const parts = bare.split(".");
  const keys: string[] = [];
  for (let i = 0; i < parts.length - 1; ) {
    if (parts[i] !== "module" || !parts[i + 1]) {
      break;
    }
    const prefix = parts.slice(0, i + 2).join(".");
    keys.push(
      stackId ? `${stackId}${REGIONAL_BUCKET_KEY_SEP}${prefix}` : prefix,
    );
    i += 2;
  }
  return keys;
}

type TopologyModuleInheritanceIndex = {
  moduleKeyToZoneKey: Map<string, string>;
};

function buildTopologyModuleInheritanceIndex(
  zones: readonly TopologyPlacementZone[],
  changeByAddress: ReadonlyMap<string, ResourceChange>,
): TopologyModuleInheritanceIndex {
  const moduleKeyToZoneKey = new Map<string, string>();
  for (const zone of zones) {
    let eligible = false;
    for (const addr of zone.addresses) {
      const rc = changeByAddress.get(addr);
      if (rc?.type && rc.type !== "aws_subnet") {
        eligible = true;
        break;
      }
    }
    if (!eligible) {
      continue;
    }
    const zoneKey = zoneMapKey(
      zone.accountId,
      zone.region,
      zone.vpcId,
      zone.subnetSignature,
    );
    for (const placedAddr of zone.addresses) {
      for (const moduleKey of modulePlacementKeysForAddress(placedAddr)) {
        if (!moduleKeyToZoneKey.has(moduleKey)) {
          moduleKeyToZoneKey.set(moduleKey, zoneKey);
        }
      }
    }
  }
  return { moduleKeyToZoneKey };
}

function findInheritedZoneKey(
  address: string,
  inheritanceIndex: TopologyModuleInheritanceIndex,
): string | null {
  if (flowLogModuleBundlePrefixForAddress(address)) {
    return null;
  }
  for (const moduleKey of modulePlacementKeysForAddress(address)) {
    const zoneKey = inheritanceIndex.moduleKeyToZoneKey.get(moduleKey);
    if (zoneKey) {
      return zoneKey;
    }
  }
  return null;
}

function noteZoneAddressForModuleInheritance(
  zone: TopologyPlacementZone,
  address: string,
  changeByAddress: ReadonlyMap<string, ResourceChange>,
  eligibleZoneKeys: Set<string>,
  inheritanceIndex: TopologyModuleInheritanceIndex,
): void {
  const zoneKey = zoneMapKey(
    zone.accountId,
    zone.region,
    zone.vpcId,
    zone.subnetSignature,
  );
  const rc = changeByAddress.get(address);
  if (rc?.type && rc.type !== "aws_subnet") {
    eligibleZoneKeys.add(zoneKey);
  }
  if (!eligibleZoneKeys.has(zoneKey)) {
    return;
  }
  for (const moduleKey of modulePlacementKeysForAddress(address)) {
    if (!inheritanceIndex.moduleKeyToZoneKey.has(moduleKey)) {
      inheritanceIndex.moduleKeyToZoneKey.set(moduleKey, zoneKey);
    }
  }
}

function appendPlacementAddress(
  addresses: string[],
  seen: Set<string>,
  address: string,
): void {
  if (seen.has(address)) {
    return;
  }
  seen.add(address);
  addresses.push(address);
}

/** Addresses rendered as satellites under primaries in zone/regional strips. */
export function collectTopologySatelliteAddressesForPrimaries(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  primaryAddresses: readonly string[],
  plan?: unknown,
): Set<string> {
  return collectTopologySatelliteAddressesFromRegistry(
    nodes,
    arnIndex,
    primaryAddresses,
    plan,
  );
}

function collectPrimaryAnchorAddresses(
  zones: readonly TopologyPlacementZone[],
  regionalBuckets: readonly TopologyRegionalPrimaryBucket[],
  nodes: TerraformPlanNodesMap,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const consider = (addr: string) => {
    if (seen.has(addr)) {
      return;
    }
    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(node);
    const type = typeof pr?.type === "string" ? pr.type : "";
    if (!type || !isPrimaryVisibleResourceType(type)) {
      return;
    }
    seen.add(addr);
    out.push(addr);
  };
  for (const zone of zones) {
    for (const addr of zone.addresses) {
      consider(addr);
    }
  }
  for (const bucket of regionalBuckets) {
    for (const addr of bucket.addresses) {
      consider(addr);
    }
  }
  return out;
}

function resolveVpcZoneKeyForManagedResource(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  rc: ResourceChange,
  subnetToVpc: Map<string, string>,
  securityGroupToVpc: Map<string, string>,
  subnetOwners: ReturnType<typeof buildSubnetOwnerHintsFromPlan>,
): string | null {
  const values = pickResourceValuesForTopologyPlacement(rc);
  if (!values) {
    return null;
  }
  const t = rc.type ?? "";
  const subnetIds = applySubnetInferenceFromSecurityGroups(
    plan,
    t,
    values,
    collectPlacementSubnetIds(values),
    subnetToVpc,
  );
  const merged = mergeWithDefaultAwsProviderAccountRegion(
    plan,
    mergeTerraformTopologyAccountRegionFromSameRegionSubnets(
      mergeTerraformTopologyAccountRegionFromSubnets(
        resolveTerraformTopologyAccountRegion(values),
        subnetIds,
        subnetOwners,
      ),
      subnetOwners,
    ),
  );
  const { account: accountId, region } = merged;
  if (!shouldEmitTopologyPlacement(accountId, region)) {
    return null;
  }
  const vpcId = resolveTopologyVpcId(
    t,
    values,
    subnetIds,
    subnetToVpc,
    securityGroupToVpc,
  );
  if (!vpcId) {
    return null;
  }
  return zoneMapKey(accountId, region, vpcId, subnetIds.join("|"));
}

function resolveRegionalBucketKeyForManagedResource(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  rc: ResourceChange,
  subnetToVpc: Map<string, string>,
  securityGroupToVpc: Map<string, string>,
  subnetOwners: ReturnType<typeof buildSubnetOwnerHintsFromPlan>,
): string | null {
  const values = pickResourceValuesForTopologyPlacement(rc);
  if (!values) {
    return null;
  }
  const subnetIds = collectPlacementSubnetIds(values);
  const merged = mergeWithDefaultAwsProviderAccountRegion(
    plan,
    mergeTerraformTopologyAccountRegionFromSameRegionSubnets(
      mergeTerraformTopologyAccountRegionFromSubnets(
        resolveTerraformTopologyAccountRegion(values),
        subnetIds,
        subnetOwners,
      ),
      subnetOwners,
    ),
  );
  const { account: accountId, region } = merged;
  if (!shouldEmitTopologyPlacement(accountId, region)) {
    return null;
  }
  const vpcId = resolveTopologyVpcId(
    rc.type ?? "",
    values,
    subnetIds,
    subnetToVpc,
    securityGroupToVpc,
  );
  if (vpcId) {
    return null;
  }
  return bucketMapKey(accountId, region);
}

/**
 * Adds managed resources that are not yet placed and not drawn as primary satellites.
 */
export function enrichTopologyPlacementsWithManagedResources(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  zones: TopologyPlacementZone[],
  regionalBuckets: TopologyRegionalPrimaryBucket[],
  options: EnrichTopologyPlacementsOptions,
): void {
  const { nodes, plan: layoutPlan } = options;
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const subnetToVpc = buildSubnetToVpcMapFromPlan(plan);
  const securityGroupToVpc = buildSecurityGroupToVpcMapFromPlan(plan);
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);
  const arnIndex = buildArnIndexForTopology(nodes);

  const placed = new Set<string>();
  for (const addr of options.preplacedAddresses ?? []) {
    placed.add(addr);
  }
  const zoneByKey = new Map<string, TopologyPlacementZone>();
  for (const zone of zones) {
    const key = zoneMapKey(
      zone.accountId,
      zone.region,
      zone.vpcId,
      zone.subnetSignature,
    );
    zoneByKey.set(key, zone);
    for (const addr of zone.addresses) {
      placed.add(addr);
    }
  }
  for (const bucket of regionalBuckets) {
    for (const addr of bucket.addresses) {
      placed.add(addr);
    }
  }

  const primaryAnchors = collectPrimaryAnchorAddresses(
    zones,
    regionalBuckets,
    nodes,
  );
  const satelliteAddresses = collectTopologySatelliteAddressesForPrimaries(
    nodes,
    arnIndex,
    primaryAnchors,
    layoutPlan,
  );
  for (const sat of satelliteAddresses) {
    placed.add(sat);
  }

  const regionalByKey = new Map<string, TopologyRegionalPrimaryBucket>();
  for (const bucket of regionalBuckets) {
    regionalByKey.set(bucketMapKey(bucket.accountId, bucket.region), bucket);
  }

  const changeByAddress = new Map<string, ResourceChange>();
  for (const rc of changes) {
    if (rc.address && typeof rc.address === "string") {
      changeByAddress.set(rc.address, rc);
    }
  }
  const inheritanceIndex = buildTopologyModuleInheritanceIndex(
    zones,
    changeByAddress,
  );
  const eligibleZoneKeys = new Set<string>();
  for (const zone of zones) {
    const zoneKey = zoneMapKey(
      zone.accountId,
      zone.region,
      zone.vpcId,
      zone.subnetSignature,
    );
    for (const addr of zone.addresses) {
      const rc = changeByAddress.get(addr);
      if (rc?.type && rc.type !== "aws_subnet") {
        eligibleZoneKeys.add(zoneKey);
        break;
      }
    }
  }
  const zoneAddressSets = new Map<string, Set<string>>();
  for (const [zoneKey, zone] of zoneByKey) {
    zoneAddressSets.set(zoneKey, new Set(zone.addresses));
  }
  const regionalAddressSets = new Map<string, Set<string>>();
  for (const [regionalKey, bucket] of regionalByKey) {
    regionalAddressSets.set(regionalKey, new Set(bucket.addresses));
  }

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc) || rc.mode !== "managed") {
      continue;
    }
    const t = rc.type;
    if (
      !t ||
      !isTopologyPlacementResourceType(t) ||
      REGIONAL_PLACEMENT_EXCLUDED_TYPES.has(t)
    ) {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }
    if (placed.has(address)) {
      continue;
    }
    if (flowLogModuleBundlePrefixForAddress(address)) {
      continue;
    }

    if (REGIONAL_ONLY_TOPOLOGY_TYPES.has(t)) {
      const regionalKey = resolveRegionalBucketKeyForManagedResource(
        plan,
        rc,
        subnetToVpc,
        securityGroupToVpc,
        subnetOwners,
      );
      if (!regionalKey) {
        continue;
      }
      let bucket = regionalByKey.get(regionalKey);
      if (!bucket) {
        const [accountId, region] = regionalKey.split(REGIONAL_BUCKET_KEY_SEP);
        bucket = { accountId: accountId!, region: region!, addresses: [] };
        regionalBuckets.push(bucket);
        regionalByKey.set(regionalKey, bucket);
        regionalAddressSets.set(regionalKey, new Set());
      }
      appendPlacementAddress(
        bucket.addresses,
        regionalAddressSets.get(regionalKey)!,
        address,
      );
      placed.add(address);
      continue;
    }

    const zoneKey = resolveVpcZoneKeyForManagedResource(
      plan,
      rc,
      subnetToVpc,
      securityGroupToVpc,
      subnetOwners,
    );
    if (zoneKey) {
      let zone = zoneByKey.get(zoneKey);
      if (!zone) {
        const values = pickResourceValuesForTopologyPlacement(rc);
        if (!values) {
          continue;
        }
        const enrichType = rc.type ?? "";
        const subnetIds = applySubnetInferenceFromSecurityGroups(
          plan,
          enrichType,
          values,
          collectPlacementSubnetIds(values),
          subnetToVpc,
        );
        const vpcId =
          resolveTopologyVpcId(
            enrichType,
            values,
            subnetIds,
            subnetToVpc,
            securityGroupToVpc,
          ) ?? "";
        const merged = mergeWithDefaultAwsProviderAccountRegion(
          plan,
          mergeTerraformTopologyAccountRegionFromSameRegionSubnets(
            mergeTerraformTopologyAccountRegionFromSubnets(
              resolveTerraformTopologyAccountRegion(values),
              subnetIds,
              subnetOwners,
            ),
            subnetOwners,
          ),
        );
        zone = {
          accountId: merged.account,
          region: merged.region,
          vpcId,
          subnetSignature: subnetIds.join("|"),
          subnetIds: [...subnetIds],
          addresses: [],
        };
        zones.push(zone);
        zoneByKey.set(zoneKey, zone);
        zoneAddressSets.set(zoneKey, new Set());
      }
      appendPlacementAddress(
        zone.addresses,
        zoneAddressSets.get(zoneKey)!,
        address,
      );
      noteZoneAddressForModuleInheritance(
        zone,
        address,
        changeByAddress,
        eligibleZoneKeys,
        inheritanceIndex,
      );
      placed.add(address);
      continue;
    }

    const inheritedZoneKey = findInheritedZoneKey(address, inheritanceIndex);
    if (inheritedZoneKey) {
      const zone = zoneByKey.get(inheritedZoneKey);
      if (zone) {
        appendPlacementAddress(
          zone.addresses,
          zoneAddressSets.get(inheritedZoneKey)!,
          address,
        );
        placed.add(address);
        continue;
      }
    }

    const regionalKey = resolveRegionalBucketKeyForManagedResource(
      plan,
      rc,
      subnetToVpc,
      securityGroupToVpc,
      subnetOwners,
    );
    if (!regionalKey) {
      continue;
    }
    let bucket = regionalByKey.get(regionalKey);
    if (!bucket) {
      const [accountId, region] = regionalKey.split(REGIONAL_BUCKET_KEY_SEP);
      bucket = { accountId: accountId!, region: region!, addresses: [] };
      regionalBuckets.push(bucket);
      regionalByKey.set(regionalKey, bucket);
      regionalAddressSets.set(regionalKey, new Set());
    }
    appendPlacementAddress(
      bucket.addresses,
      regionalAddressSets.get(regionalKey)!,
      address,
    );
    placed.add(address);
  }

  for (const zone of zones) {
    zone.addresses.sort((a, b) => a.localeCompare(b));
  }
  for (const bucket of regionalBuckets) {
    bucket.addresses.sort((a, b) => a.localeCompare(b));
  }
}
