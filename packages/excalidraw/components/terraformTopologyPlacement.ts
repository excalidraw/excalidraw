/**
 * Placement zones for primary AWS resources in semantic topology layout.
 * Zones group resources by (account, region, vpc, sorted subnet id multiset).
 */

import {
  buildSubnetOwnerHintsFromPlan,
  buildSubnetToVpcMapFromPlan,
  isAwsTerraformResourceChange,
  mergeTerraformTopologyAccountRegionFromSameRegionSubnets,
  mergeTerraformTopologyAccountRegionFromSubnets,
  mergeWithDefaultAwsProviderAccountRegion,
  pickResourceValuesForTopologyPlacement,
  type TerraformPlanProviderContext,
  resolveTerraformTopologyAccountRegion,
  shouldEmitTopologyPlacement,
} from "./terraformTopologyExtract";
import {
  isPrimaryVisibleResourceType,
} from "./terraformPrimaryVisibility";

export type TopologyPlacementZone = {
  accountId: string;
  region: string;
  vpcId: string;
  /** Sorted `subnetIds.join("|")`; empty string = VPC-only placement. */
  subnetSignature: string;
  subnetIds: string[];
  addresses: string[];
};

/** Primary resources with resolved account/region but no VPC (S3, SQS, …). */
export type TopologyRegionalPrimaryBucket = {
  accountId: string;
  region: string;
  addresses: string[];
};

/** Managed `aws_vpc_endpoint` addresses grouped by placement VPC (semantic layout strip). */
export type TopologyVpcEndpointBucket = {
  accountId: string;
  region: string;
  vpcId: string;
  addresses: string[];
};

/** Managed `aws_route_table` addresses grouped by VPC (`vpc_id` on the table). */
export type TopologyRouteTableBucket = {
  accountId: string;
  region: string;
  vpcId: string;
  addresses: string[];
};

/** Route tables drawn straddling the bottom edge of a subnet zone frame (association subnets ⊆ zone). */
export type RouteTableBottomZonePlacement = {
  accountId: string;
  region: string;
  vpcId: string;
  subnetSignature: string;
  addresses: string[];
};

/** Route tables drawn straddling the VPC bottom (no subnet-only association, or subnets span multiple zones). */
export type RouteTableBottomVpcPlacement = {
  accountId: string;
  region: string;
  vpcId: string;
  addresses: string[];
};

/** Semantic bottom-edge route table layout (subnet zone vs VPC). */
export type TopologyRouteTableBottomPlacements = {
  zoneBottom: RouteTableBottomZonePlacement[];
  vpcBottom: RouteTableBottomVpcPlacement[];
};

const ROUTE_TABLE_SEMANTIC_TILE_W = 160;
const ROUTE_TABLE_SEMANTIC_GAP = 10;

/** Minimum inner width for one horizontal row of route table tiles (matches layout constants). */
export function routeTableBottomRowMinInnerWidth(addrCount: number): number {
  if (addrCount <= 0) {
    return 0;
  }
  return (
    addrCount * ROUTE_TABLE_SEMANTIC_TILE_W +
    (addrCount - 1) * ROUTE_TABLE_SEMANTIC_GAP
  );
}

type ResourceChange = {
  address?: string;
  mode?: string;
  type?: string;
  provider_name?: string;
  change?: { actions?: string[]; before?: unknown; after?: unknown };
};

function stringArrayField(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function vpcConfigBlocks(values: Record<string, unknown>): Record<string, unknown>[] {
  const raw = values.vpc_config;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const first = raw[0];
  return first && typeof first === "object" && !Array.isArray(first)
    ? [first as Record<string, unknown>]
    : [];
}

/** Unique sorted subnet ids referenced by the resource shape. */
export function collectPlacementSubnetIds(values: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  for (const block of vpcConfigBlocks(values)) {
    for (const sid of stringArrayField(block.subnet_ids)) {
      ids.add(sid);
    }
  }
  const single = values.subnet_id;
  if (typeof single === "string" && single.length > 0) {
    ids.add(single);
  }
  for (const sid of stringArrayField(values.subnet_ids)) {
    ids.add(sid);
  }
  return [...ids].sort();
}

function zoneMapKey(
  account: string,
  region: string,
  vpcId: string,
  subnetSignature: string,
): string {
  return `${account}\0${region}\0${vpcId}\0${subnetSignature}`;
}

/**
 * One zone per distinct `(vpc, subnet multiset)` for primary resource types.
 * Resources without a resolvable VPC are omitted (regional-only layout is non-goal v1).
 */
export function extractPrimaryTopologyZones(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyPlacementZone[] {
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  const subnetToVpc = buildSubnetToVpcMapFromPlan(plan);
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  const accum = new Map<
    string,
    {
      accountId: string;
      region: string;
      vpcId: string;
      subnetSignature: string;
      subnetIds: string[];
      addresses: Set<string>;
    }
  >();

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    const t = rc.type;
    if (!t || !isPrimaryVisibleResourceType(t)) {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }

    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
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
      continue;
    }

    let vpcId = typeof values.vpc_id === "string" && values.vpc_id ? values.vpc_id : null;
    if (!vpcId && subnetIds.length > 0) {
      vpcId = subnetToVpc.get(subnetIds[0]!) ?? null;
    }
    if (!vpcId) {
      continue;
    }

    const subnetSignature = subnetIds.join("|");
    const key = zoneMapKey(accountId, region, vpcId, subnetSignature);
    let row = accum.get(key);
    if (!row) {
      row = {
        accountId,
        region,
        vpcId,
        subnetSignature,
        subnetIds: [...subnetIds],
        addresses: new Set(),
      };
      accum.set(key, row);
    }
    row.addresses.add(address);
  }

  const out: TopologyPlacementZone[] = [...accum.values()].map((row) => ({
    accountId: row.accountId,
    region: row.region,
    vpcId: row.vpcId,
    subnetSignature: row.subnetSignature,
    subnetIds: row.subnetIds,
    addresses: [...row.addresses].sort(),
  }));

  out.sort((a, b) => {
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
  });

  return out;
}

function stringField(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function vpcEndpointBucketKey(accountId: string, region: string, vpcId: string): string {
  return `${accountId}\0${region}\0${vpcId}`;
}

/**
 * Managed `aws_vpc_endpoint` resources keyed by (account, region, vpc_id).
 * Excludes `aws_vpc_endpoint_service` and other modes. Addresses sorted by `service_name` then address.
 */
export function extractVpcEndpointsByVpc(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyVpcEndpointBucket[] {
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  const accum = new Map<
    string,
    {
      accountId: string;
      region: string;
      vpcId: string;
      rows: { address: string; serviceName: string }[];
    }
  >();

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_vpc_endpoint") {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }

    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }

    const vpcIdRaw = stringField(values.vpc_id);
    if (!vpcIdRaw) {
      continue;
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
      continue;
    }

    const serviceName = stringField(values.service_name) ?? "";
    const key = vpcEndpointBucketKey(accountId, region, vpcIdRaw);
    let row = accum.get(key);
    if (!row) {
      row = { accountId, region, vpcId: vpcIdRaw, rows: [] };
      accum.set(key, row);
    }
    if (!row.rows.some((x) => x.address === address)) {
      row.rows.push({ address, serviceName });
    }
  }

  const out: TopologyVpcEndpointBucket[] = [...accum.values()].map((row) => ({
    accountId: row.accountId,
    region: row.region,
    vpcId: row.vpcId,
    addresses: [...row.rows]
      .sort((a, b) => {
        const c = a.serviceName.localeCompare(b.serviceName);
        return c !== 0 ? c : a.address.localeCompare(b.address);
      })
      .map((x) => x.address),
  }));

  out.sort((a, b) => {
    if (a.accountId !== b.accountId) {
      return a.accountId.localeCompare(b.accountId);
    }
    if (a.region !== b.region) {
      return a.region.localeCompare(b.region);
    }
    return a.vpcId.localeCompare(b.vpcId);
  });

  return out;
}

function routeTableSortLabel(values: Record<string, unknown>): string {
  const tags = values.tags;
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    const name = (tags as Record<string, unknown>).Name;
    if (typeof name === "string" && name.length > 0) {
      return name;
    }
  }
  return stringField(values.id) ?? "";
}

/**
 * Managed `aws_route_table` resources keyed by (account, region, vpc_id).
 * Subnets use route tables via associations; tables themselves are VPC-scoped.
 */
export function extractRouteTablesByVpc(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyRouteTableBucket[] {
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  const accum = new Map<
    string,
    {
      accountId: string;
      region: string;
      vpcId: string;
      rows: { address: string; sortLabel: string }[];
    }
  >();

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_route_table") {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }

    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }

    const vpcIdRaw = stringField(values.vpc_id);
    if (!vpcIdRaw) {
      continue;
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
      continue;
    }

    const sortLabel = routeTableSortLabel(values);
    const key = vpcEndpointBucketKey(accountId, region, vpcIdRaw);
    let row = accum.get(key);
    if (!row) {
      row = { accountId, region, vpcId: vpcIdRaw, rows: [] };
      accum.set(key, row);
    }
    if (!row.rows.some((x) => x.address === address)) {
      row.rows.push({ address, sortLabel });
    }
  }

  const out: TopologyRouteTableBucket[] = [...accum.values()].map((row) => ({
    accountId: row.accountId,
    region: row.region,
    vpcId: row.vpcId,
    addresses: [...row.rows]
      .sort((a, b) => {
        const c = a.sortLabel.localeCompare(b.sortLabel);
        return c !== 0 ? c : a.address.localeCompare(b.address);
      })
      .map((x) => x.address),
  }));

  out.sort((a, b) => {
    if (a.accountId !== b.accountId) {
      return a.accountId.localeCompare(b.accountId);
    }
    if (a.region !== b.region) {
      return a.region.localeCompare(b.region);
    }
    return a.vpcId.localeCompare(b.vpcId);
  });

  return out;
}

type RouteTableAddressMeta = {
  rtbId: string;
  accountId: string;
  region: string;
  vpcId: string;
};

function buildRouteTableIdToSubnetIdsFromPlan(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_route_table_association") {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    const rtid = stringField(values.route_table_id);
    const sid = stringField(values.subnet_id);
    if (!rtid || !sid || !rtid.startsWith("rtb-")) {
      continue;
    }
    if (!out.has(rtid)) {
      out.set(rtid, new Set());
    }
    out.get(rtid)!.add(sid);
  }
  return out;
}

function buildRouteTableAddressToMeta(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): Map<string, RouteTableAddressMeta> {
  const out = new Map<string, RouteTableAddressMeta>();
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_route_table") {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    const vpcIdRaw = stringField(values.vpc_id);
    const rtbId = stringField(values.id);
    if (!vpcIdRaw || !rtbId || !rtbId.startsWith("rtb-")) {
      continue;
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
      continue;
    }
    out.set(address, {
      rtbId,
      accountId,
      region,
      vpcId: vpcIdRaw,
    });
  }
  return out;
}

function pickNarrowestZoneContainingSubnets(
  zones: readonly TopologyPlacementZone[],
  accountId: string,
  region: string,
  vpcId: string,
  subnetIds: readonly string[],
): TopologyPlacementZone | null {
  if (subnetIds.length === 0) {
    return null;
  }
  const candidates = zones.filter(
    (z) =>
      z.accountId === accountId &&
      z.region === region &&
      z.vpcId === vpcId &&
      subnetIds.every((sid) => z.subnetIds.includes(sid)),
  );
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => a.subnetIds.length - b.subnetIds.length);
  return candidates[0] ?? null;
}

function routeTableVpcAccumKey(accountId: string, region: string, vpcId: string): string {
  return `${accountId}\0${region}\0${vpcId}`;
}

/**
 * Split route tables between **subnet zone bottom** (when association subnets fit a single
 * placement zone — narrowest match) vs **VPC bottom** (no associations, unknown subnets, or
 * subnets spanning multiple zones).
 */
export function computeRouteTableBottomEdgePlacements(
  zones: readonly TopologyPlacementZone[],
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyRouteTableBottomPlacements {
  const buckets = extractRouteTablesByVpc(plan);
  const rtidToSubnets = buildRouteTableIdToSubnetIdsFromPlan(plan);
  const addrToMeta = buildRouteTableAddressToMeta(plan);

  const zoneAccum = new Map<string, string[]>();
  const vpcAccum = new Map<string, string[]>();

  for (const bucket of buckets) {
    for (const addr of bucket.addresses) {
      const meta = addrToMeta.get(addr);
      if (!meta) {
        const vk = routeTableVpcAccumKey(
          bucket.accountId,
          bucket.region,
          bucket.vpcId,
        );
        if (!vpcAccum.has(vk)) {
          vpcAccum.set(vk, []);
        }
        vpcAccum.get(vk)!.push(addr);
        continue;
      }
      const subnetSet = rtidToSubnets.get(meta.rtbId);
      const subnetList = subnetSet ? [...subnetSet] : [];

      let zonePick: TopologyPlacementZone | null = null;
      if (subnetList.length > 0) {
        zonePick = pickNarrowestZoneContainingSubnets(
          zones,
          meta.accountId,
          meta.region,
          meta.vpcId,
          subnetList,
        );
      }

      if (zonePick) {
        const zk = `${meta.accountId}\0${meta.region}\0${meta.vpcId}\0${zonePick.subnetSignature}`;
        if (!zoneAccum.has(zk)) {
          zoneAccum.set(zk, []);
        }
        zoneAccum.get(zk)!.push(addr);
      } else {
        const vk = routeTableVpcAccumKey(meta.accountId, meta.region, meta.vpcId);
        if (!vpcAccum.has(vk)) {
          vpcAccum.set(vk, []);
        }
        vpcAccum.get(vk)!.push(addr);
      }
    }
  }

  const zoneBottom: RouteTableBottomZonePlacement[] = [];
  for (const [key, addresses] of zoneAccum.entries()) {
    const [accountId, region, vpcId, subnetSignature] = key.split("\0");
    if (!accountId || !region || !vpcId) {
      continue;
    }
    zoneBottom.push({
      accountId,
      region,
      vpcId,
      subnetSignature,
      addresses: [...addresses].sort(),
    });
  }
  zoneBottom.sort((a, b) => {
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
  });

  const vpcBottom: RouteTableBottomVpcPlacement[] = [];
  for (const [key, addresses] of vpcAccum.entries()) {
    const [accountId, region, vpcId] = key.split("\0");
    if (!accountId || !region || !vpcId) {
      continue;
    }
    vpcBottom.push({
      accountId,
      region,
      vpcId,
      addresses: [...addresses].sort(),
    });
  }
  vpcBottom.sort((a, b) => {
    if (a.accountId !== b.accountId) {
      return a.accountId.localeCompare(b.accountId);
    }
    if (a.region !== b.region) {
      return a.region.localeCompare(b.region);
    }
    return a.vpcId.localeCompare(b.vpcId);
  });

  return { zoneBottom, vpcBottom };
}

function bucketMapKey(accountId: string, region: string): string {
  return `${accountId}\0${region}`;
}

/**
 * Primaries that belong in account/region but not inside a VPC frame (no `vpc_id`/subnet map).
 */
export function extractRegionalTopologyPrimaries(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyRegionalPrimaryBucket[] {
  const changes = Array.isArray(plan.resource_changes) ? plan.resource_changes : [];
  const subnetToVpc = buildSubnetToVpcMapFromPlan(plan);
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  const accum = new Map<
    string,
    { accountId: string; region: string; addresses: Set<string> }
  >();

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    const t = rc.type;
    if (!t || !isPrimaryVisibleResourceType(t)) {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }

    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
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
      continue;
    }

    let vpcId = typeof values.vpc_id === "string" && values.vpc_id ? values.vpc_id : null;
    if (!vpcId && subnetIds.length > 0) {
      vpcId = subnetToVpc.get(subnetIds[0]!) ?? null;
    }
    if (vpcId) {
      continue;
    }

    const key = bucketMapKey(accountId, region);
    let row = accum.get(key);
    if (!row) {
      row = { accountId, region, addresses: new Set() };
      accum.set(key, row);
    }
    row.addresses.add(address);
  }

  const out: TopologyRegionalPrimaryBucket[] = [...accum.values()].map((row) => ({
    accountId: row.accountId,
    region: row.region,
    addresses: [...row.addresses].sort(),
  }));

  out.sort((a, b) => {
    if (a.accountId !== b.accountId) {
      return a.accountId.localeCompare(b.accountId);
    }
    return a.region.localeCompare(b.region);
  });

  return out;
}
