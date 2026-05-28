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
import { collectAlbClusterSatelliteAddressesForTopologyList } from "./terraformTopologyAlbLinks";
import { collectEcsClusterSatelliteAddressesForTopologyList } from "./terraformTopologyEcsLinks";
import { collectApiGatewayClusterSatelliteAddressesForTopologyList } from "./terraformTopologyApiGatewayLinks";
import { buildResourceCloudWatchCluster } from "./terraformTopologyCloudWatchLinks";
import {
  buildArnIndexForTopology,
  buildPrimaryIamCluster,
} from "./terraformTopologyIamLinks";
import { buildKmsKeyPolicyCluster } from "./terraformTopologyKmsLinks";
import { collectLambdaPermissionSatelliteAddressesForTopologyList } from "./terraformTopologyLambdaPermissionLinks";
import { collectTransitGatewayClusterSatelliteAddressesForTopologyList } from "./terraformTopologyTransitGatewayLinks";
import { buildPrimarySgCluster } from "./terraformTopologySgLinks";
import { buildS3CompanionCluster } from "./terraformTopologyS3Links";
import { buildSqsCompanionCluster } from "./terraformTopologySqsLinks";
import {
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
  collectPlacementSubnetIds,
  inferSubnetIdsForLbFromPlanSecurityGroups,
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

function zoneEligibleForModuleInheritance(
  zone: TopologyPlacementZone,
  plan: TerraformPlanProviderContext & { resource_changes?: ResourceChange[] },
): boolean {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  for (const addr of zone.addresses) {
    const rc = changes.find((r) => r.address === addr);
    if (rc?.type && rc.type !== "aws_subnet") {
      return true;
    }
  }
  return false;
}

function findInheritedZoneKey(
  address: string,
  zones: TopologyPlacementZone[],
  plan: TerraformPlanProviderContext & { resource_changes?: ResourceChange[] },
): string | null {
  if (flowLogModuleBundlePrefixForAddress(address)) {
    return null;
  }
  const want = new Set(modulePlacementKeysForAddress(address));
  if (want.size === 0) {
    return null;
  }
  for (const zone of zones) {
    if (!zoneEligibleForModuleInheritance(zone, plan)) {
      continue;
    }
    for (const placedAddr of zone.addresses) {
      for (const moduleKey of modulePlacementKeysForAddress(placedAddr)) {
        if (want.has(moduleKey)) {
          return zoneMapKey(
            zone.accountId,
            zone.region,
            zone.vpcId,
            zone.subnetSignature,
          );
        }
      }
    }
  }
  return null;
}

/** Addresses rendered as satellites under primaries in zone/regional strips. */
export function collectTopologySatelliteAddressesForPrimaries(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  primaryAddresses: readonly string[],
  plan?: unknown,
): Set<string> {
  const out = new Set<string>();

  for (const addr of collectAlbClusterSatelliteAddressesForTopologyList(
    nodes,
    arnIndex,
    primaryAddresses,
    plan,
  )) {
    out.add(addr);
  }
  for (const addr of collectEcsClusterSatelliteAddressesForTopologyList(
    nodes,
    arnIndex,
    primaryAddresses,
  )) {
    out.add(addr);
  }
  for (const addr of collectApiGatewayClusterSatelliteAddressesForTopologyList(
    nodes,
    primaryAddresses,
  )) {
    out.add(addr);
  }
  for (const addr of collectLambdaPermissionSatelliteAddressesForTopologyList(
    nodes,
    arnIndex,
    primaryAddresses,
  )) {
    out.add(addr);
  }
  for (const addr of collectTransitGatewayClusterSatelliteAddressesForTopologyList(
    nodes,
    primaryAddresses,
    Array.isArray((plan as { resource_changes?: unknown })?.resource_changes)
      ? (plan as { resource_changes: ResourceChange[] }).resource_changes ?? []
      : undefined,
  )) {
    out.add(addr);
  }

  for (const addr of primaryAddresses) {
    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(node);
    const type = typeof pr?.type === "string" ? pr.type : "";

    const cw = buildResourceCloudWatchCluster(nodes, addr);
    if (cw.cluster) {
      for (const a of cw.cluster.alarms) {
        out.add(a);
      }
      for (const lg of cw.cluster.logGroups) {
        out.add(lg);
      }
    }

    const iam = buildPrimaryIamCluster(nodes, addr, arnIndex);
    if (iam.cluster) {
      for (const s of iam.cluster.stack) {
        out.add(s);
      }
    }

    if (type === "aws_kms_key") {
      const kms = buildKmsKeyPolicyCluster(nodes, addr, arnIndex);
      if (kms.cluster) {
        for (const p of kms.cluster.policies) {
          out.add(p);
        }
      }
    }

    const sg = buildPrimarySgCluster(nodes, addr, arnIndex, plan);
    if (sg.cluster) {
      for (const g of sg.cluster.groups) {
        out.add(g.sgPath);
        for (const r of g.rules) {
          out.add(r);
        }
      }
    }

    if (type === "aws_s3_bucket") {
      const s3 = buildS3CompanionCluster(nodes, addr, arnIndex);
      if (s3.cluster) {
        for (const s of s3.cluster.stack) {
          out.add(s);
        }
      }
    }

    if (type === "aws_sqs_queue") {
      const sqs = buildSqsCompanionCluster(nodes, addr, arnIndex);
      if (sqs.cluster) {
        for (const s of sqs.cluster.stack) {
          out.add(s);
        }
      }
    }
  }

  return out;
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
  subnetOwners: ReturnType<typeof buildSubnetOwnerHintsFromPlan>,
): string | null {
  const values = pickResourceValuesForTopologyPlacement(rc);
  if (!values) {
    return null;
  }
  const t = rc.type;
  let subnetIds = collectPlacementSubnetIds(values);
  if (t === "aws_lb" && subnetIds.length === 0) {
    subnetIds = inferSubnetIdsForLbFromPlanSecurityGroups(
      plan,
      values,
      subnetToVpc,
    );
  }
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
  let vpcId =
    typeof values.vpc_id === "string" && values.vpc_id ? values.vpc_id : null;
  if (!vpcId && subnetIds.length > 0) {
    vpcId = subnetToVpc.get(subnetIds[0]!) ?? null;
  }
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
  let vpcId =
    typeof values.vpc_id === "string" && values.vpc_id ? values.vpc_id : null;
  if (!vpcId && subnetIds.length > 0) {
    vpcId = subnetToVpc.get(subnetIds[0]!) ?? null;
  }
  if (vpcId) {
    return null;
  }
  return bucketMapKey(accountId, region);
}

function addAddressSorted(addresses: string[], address: string): void {
  if (addresses.includes(address)) {
    return;
  }
  addresses.push(address);
  addresses.sort((a, b) => a.localeCompare(b));
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
      }
      addAddressSorted(bucket.addresses, address);
      placed.add(address);
      continue;
    }

    const zoneKey = resolveVpcZoneKeyForManagedResource(
      plan,
      rc,
      subnetToVpc,
      subnetOwners,
    );
    if (zoneKey) {
      let zone = zoneByKey.get(zoneKey);
      if (!zone) {
        const values = pickResourceValuesForTopologyPlacement(rc);
        if (!values) {
          continue;
        }
        const subnetIds = collectPlacementSubnetIds(values);
        let vpcId =
          typeof values.vpc_id === "string" && values.vpc_id
            ? values.vpc_id
            : "";
        if (!vpcId && subnetIds.length > 0) {
          vpcId = subnetToVpc.get(subnetIds[0]!) ?? "";
        }
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
      }
      addAddressSorted(zone.addresses, address);
      placed.add(address);
      continue;
    }

    const inheritedZoneKey = findInheritedZoneKey(address, zones, plan);
    if (inheritedZoneKey) {
      const zone = zoneByKey.get(inheritedZoneKey);
      if (zone) {
        addAddressSorted(zone.addresses, address);
        placed.add(address);
        continue;
      }
    }

    const regionalKey = resolveRegionalBucketKeyForManagedResource(
      plan,
      rc,
      subnetToVpc,
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
    }
    addAddressSorted(bucket.addresses, address);
    placed.add(address);
  }
}
