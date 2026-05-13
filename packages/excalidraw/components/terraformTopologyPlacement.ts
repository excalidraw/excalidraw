/**
 * Placement zones for primary AWS resources in semantic topology layout.
 * Zones group resources by (account, region, vpc, sorted subnet id multiset).
 *
 * **Not placed as topology tiles (by design):**
 * - `terraform_data.*` — Terraform build bookkeeping, not an AWS regional/network primitive.
 * - `aws_route_table_association` — relationship between route table and subnet; route tables
 *   are already placed on zone/VPC bottom edges from `aws_route_table` resources.
 * - `aws_vpc` as a duplicate card when the VPC **frame** already represents that VPC — the
 *   frame is the canonical shell; default plumbing / endpoints / subnets are shown instead.
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
import { isPrimaryVisibleResourceType } from "./terraformPrimaryVisibility";
import { tfComfortPx } from "./terraformLayoutComfort";
import { terraformModulePrefixForAddress } from "./terraformTopologyIamLinks";

/** Provenance for semantic merge / placement (set in `terraformPlanParsing` semantic path). */
export type TopologyZoneSource = "primary" | "supplementary";

export type TopologyPlacementZone = {
  accountId: string;
  region: string;
  vpcId: string;
  /** Sorted `subnetIds.join("|")`; empty string = VPC-only placement. */
  subnetSignature: string;
  subnetIds: string[];
  addresses: string[];
  topologyZoneSource?: TopologyZoneSource;
  /** Supplementary-only zones merged because subnets share one route table. */
  mergedSupplementaryComposite?: boolean;
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
  /** Managed `aws_route_table` resource addresses on this row (one composite box each). */
  addresses: string[];
  /** `aws_route` addresses nested under each route table, sorted per table. */
  routeChildrenByTable: Record<string, string[]>;
};

/** Route tables drawn straddling the VPC bottom (no subnet-only association, or subnets span multiple zones). */
export type RouteTableBottomVpcPlacement = {
  accountId: string;
  region: string;
  vpcId: string;
  addresses: string[];
  routeChildrenByTable: Record<string, string[]>;
};

/** Semantic bottom-edge route table layout (subnet zone vs VPC). */
export type TopologyRouteTableBottomPlacements = {
  zoneBottom: RouteTableBottomZonePlacement[];
  vpcBottom: RouteTableBottomVpcPlacement[];
};

const ROUTE_TABLE_SEMANTIC_GAP = tfComfortPx(10);
const ALB_COMPANION_TYPES = new Set([
  "aws_lb_listener",
  "aws_lb_target_group",
  "aws_lb_target_group_attachment",
  "aws_lambda_permission",
  "aws_security_group",
  "aws_security_group_rule",
]);

/** Minimum inner width for one horizontal row of route-table cluster frames (legacy helper). */
export function routeTableBottomRowMinInnerWidth(addrCount: number): number {
  if (addrCount <= 0) {
    return 0;
  }
  return (
    addrCount * routeTableCompositeSlotWidthPx(0) +
    (addrCount - 1) * ROUTE_TABLE_SEMANTIC_GAP
  );
}

/** Same footprint as topology tier-0 primary + `TOPOLOGY_PRIMARY_CLUSTER_FRAME_PAD_PX`. */
const RT_CLUSTER_PRIMARY_W = tfComfortPx(200);
const RT_CLUSTER_PRIMARY_H = tfComfortPx(88);
const RT_CLUSTER_TIER2_W = tfComfortPx(154);
const RT_CLUSTER_TIER2_H = tfComfortPx(44);
const RT_CLUSTER_SAT_GAP = tfComfortPx(8);
const RT_CLUSTER_FRAME_PAD = tfComfortPx(10);

/** Content height (tier-0 + stacked tier-2 `aws_route` tiles) without outer cluster frame pad. */
export function routeTableClusterContentHeightPx(routeCount: number): number {
  if (routeCount <= 0) {
    return RT_CLUSTER_PRIMARY_H;
  }
  return (
    RT_CLUSTER_PRIMARY_H +
    RT_CLUSTER_SAT_GAP +
    routeCount * RT_CLUSTER_TIER2_H +
    (routeCount - 1) * RT_CLUSTER_SAT_GAP
  );
}

/** Full cluster frame height (matches `appendTopologyResourceRectangles` primaryCluster frame). */
export function routeTableCompositeHeightPx(routeCount: number): number {
  return (
    routeTableClusterContentHeightPx(routeCount) + 2 * RT_CLUSTER_FRAME_PAD
  );
}

/** Outer width of one route-table primaryCluster frame. */
export function routeTableCompositeSlotWidthPx(_routeCount: number): number {
  return RT_CLUSTER_PRIMARY_W + 2 * RT_CLUSTER_FRAME_PAD;
}

/** Sum of composite slot widths + gaps for one bottom row. */
export function routeTableCompositeRowMinInnerWidthPx(
  tableAddrs: readonly string[],
  routeChildrenByTable: Record<string, string[]>,
): number {
  const sorted = [...tableAddrs].sort();
  if (sorted.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    const addr = sorted[i]!;
    const n = (routeChildrenByTable[addr] ?? []).length;
    sum += routeTableCompositeSlotWidthPx(n);
    if (i < sorted.length - 1) {
      sum += ROUTE_TABLE_SEMANTIC_GAP;
    }
  }
  return sum;
}

/** Tallest composite on a row (for zone / VPC bottom inset). */
export function routeTableMaxCompositeHeightForRowPx(
  tableAddrs: readonly string[],
  routeChildrenByTable: Record<string, string[]>,
): number {
  let maxH = 0;
  for (const addr of tableAddrs) {
    const n = (routeChildrenByTable[addr] ?? []).length;
    maxH = Math.max(maxH, routeTableCompositeHeightPx(n));
  }
  return maxH;
}

/**
 * Vertical distance from the body-bottom anchor midline (tier-0 center) down to the outer
 * bottom of the `primaryCluster` frame in `appendRouteTableBottomEdgeRectangles`. Using
 * half of {@link routeTableCompositeHeightPx} is wrong when `aws_route` tiles stack below
 * the primary — most of the composite sits under the anchor, not split evenly above/below.
 */
export function routeTableExtentBelowAnchorMidlinePx(
  routeCount: number,
): number {
  const primaryLower =
    RT_CLUSTER_PRIMARY_H - Math.round(RT_CLUSTER_PRIMARY_H / 2);
  const routeBlock =
    routeCount <= 0
      ? 0
      : RT_CLUSTER_SAT_GAP +
        routeCount * RT_CLUSTER_TIER2_H +
        (routeCount - 1) * RT_CLUSTER_SAT_GAP;
  return primaryLower + routeBlock + RT_CLUSTER_FRAME_PAD;
}

export function routeTableMaxExtentBelowAnchorForRowPx(
  tableAddrs: readonly string[],
  routeChildrenByTable: Record<string, string[]>,
): number {
  let maxE = 0;
  for (const addr of tableAddrs) {
    const n = (routeChildrenByTable[addr] ?? []).length;
    maxE = Math.max(maxE, routeTableExtentBelowAnchorMidlinePx(n));
  }
  return maxE;
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

function vpcConfigBlocks(
  values: Record<string, unknown>,
): Record<string, unknown>[] {
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
export function collectPlacementSubnetIds(
  values: Record<string, unknown>,
): string[] {
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
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const subnetToVpc = buildSubnetToVpcMapFromPlan(plan);
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);
  const albModulePrefixes: Array<{ prefix: string; key: string }> = [];

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

    let vpcId =
      typeof values.vpc_id === "string" && values.vpc_id ? values.vpc_id : null;
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
    if (t === "aws_lb") {
      albModulePrefixes.push({
        prefix: terraformModulePrefixForAddress(address),
        key,
      });
    }
  }

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (
      rc.mode !== "managed" ||
      !rc.type ||
      !ALB_COMPANION_TYPES.has(rc.type)
    ) {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }
    const prefix = terraformModulePrefixForAddress(address);
    const owner = albModulePrefixes.find((x) => x.prefix === prefix);
    if (!owner) {
      continue;
    }
    accum.get(owner.key)?.addresses.add(address);
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

function vpcEndpointBucketKey(
  accountId: string,
  region: string,
  vpcId: string,
): string {
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
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
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
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
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
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
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

/** `aws_route` addresses keyed by route table id (`route_table_id` in plan values). */
function buildRouteTableIdToRouteAddressesFromPlan(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_route") {
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
    const rtid = stringField(values.route_table_id);
    if (!rtid || !rtid.startsWith("rtb-")) {
      continue;
    }
    if (!out.has(rtid)) {
      out.set(rtid, new Set());
    }
    out.get(rtid)!.add(address);
  }
  return out;
}

function buildRouteTableAddressToMeta(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): Map<string, RouteTableAddressMeta> {
  const out = new Map<string, RouteTableAddressMeta>();
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
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

function routeTableVpcAccumKey(
  accountId: string,
  region: string,
  vpcId: string,
): string {
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
  const rtidToRoutes = buildRouteTableIdToRouteAddressesFromPlan(plan);
  const addrToMeta = buildRouteTableAddressToMeta(plan);

  const zoneAccum = new Map<string, string[]>();
  const zoneChildrenAccum = new Map<string, Map<string, string[]>>();
  const vpcAccum = new Map<string, string[]>();
  const vpcChildrenAccum = new Map<string, Map<string, string[]>>();

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
        if (!vpcChildrenAccum.has(vk)) {
          vpcChildrenAccum.set(vk, new Map());
        }
        vpcChildrenAccum.get(vk)!.set(addr, []);
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

      const routesForTable = [
        ...(rtidToRoutes.get(meta.rtbId) ?? new Set()),
      ].sort();

      if (zonePick) {
        const zk = `${meta.accountId}\0${meta.region}\0${meta.vpcId}\0${zonePick.subnetSignature}`;
        if (!zoneAccum.has(zk)) {
          zoneAccum.set(zk, []);
        }
        zoneAccum.get(zk)!.push(addr);
        if (!zoneChildrenAccum.has(zk)) {
          zoneChildrenAccum.set(zk, new Map());
        }
        zoneChildrenAccum.get(zk)!.set(addr, routesForTable);
      } else {
        const vk = routeTableVpcAccumKey(
          meta.accountId,
          meta.region,
          meta.vpcId,
        );
        if (!vpcAccum.has(vk)) {
          vpcAccum.set(vk, []);
        }
        vpcAccum.get(vk)!.push(addr);
        if (!vpcChildrenAccum.has(vk)) {
          vpcChildrenAccum.set(vk, new Map());
        }
        vpcChildrenAccum.get(vk)!.set(addr, routesForTable);
      }
    }
  }

  const zoneBottom: RouteTableBottomZonePlacement[] = [];
  for (const [key, addresses] of zoneAccum.entries()) {
    const [accountId, region, vpcId, subnetSignature] = key.split("\0");
    if (!accountId || !region || !vpcId) {
      continue;
    }
    const sortedAddrs = [...new Set(addresses)].sort();
    const childMap = zoneChildrenAccum.get(key);
    const routeChildrenByTable: Record<string, string[]> = {};
    for (const a of sortedAddrs) {
      routeChildrenByTable[a] = [...(childMap?.get(a) ?? [])];
    }
    zoneBottom.push({
      accountId,
      region,
      vpcId,
      subnetSignature,
      addresses: sortedAddrs,
      routeChildrenByTable,
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
    const sortedAddrs = [...new Set(addresses)].sort();
    const childMap = vpcChildrenAccum.get(key);
    const routeChildrenByTable: Record<string, string[]> = {};
    for (const a of sortedAddrs) {
      routeChildrenByTable[a] = [...(childMap?.get(a) ?? [])];
    }
    vpcBottom.push({
      accountId,
      region,
      vpcId,
      addresses: sortedAddrs,
      routeChildrenByTable,
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

function resourceChangeForAddress(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  address: string,
): ResourceChange | null {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  for (const rc of changes) {
    if (rc.address === address) {
      return rc as ResourceChange;
    }
  }
  return null;
}

/** Each subnet id → route table ids from `aws_route_table_association` (usually size 1). */
function buildSubnetIdToRouteTableIdsMap(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
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
    if (!out.has(sid)) {
      out.set(sid, new Set());
    }
    out.get(sid)!.add(rtid);
  }
  return out;
}

function zoneAddressesAreAllAwsSubnet(
  z: TopologyPlacementZone,
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): boolean {
  if (z.addresses.length === 0) {
    return false;
  }
  for (const addr of z.addresses) {
    const rc = resourceChangeForAddress(plan, addr);
    if (!rc || rc.type !== "aws_subnet") {
      return false;
    }
  }
  return true;
}

function singleRouteTableIdForSubnets(
  subnetIds: readonly string[],
  sidToRtbs: ReadonlyMap<string, Set<string>>,
): string | null {
  let common: string | null = null;
  for (const sid of subnetIds) {
    const set = sidToRtbs.get(sid);
    if (!set || set.size !== 1) {
      return null;
    }
    const rt = [...set][0]!;
    if (common === null) {
      common = rt;
    } else if (common !== rt) {
      return null;
    }
  }
  return common;
}

function routeTableIdForZoneSubnets(
  z: TopologyPlacementZone,
  sidToRtbs: ReadonlyMap<string, Set<string>>,
): string | null {
  return singleRouteTableIdForSubnets(z.subnetIds, sidToRtbs);
}

function sortPlacementZones(
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

/**
 * Merge supplementary `aws_subnet`-only zones in the same VPC when every subnet in the union
 * associates to exactly one shared route table id (generic; not tier-specific).
 */
export function mergeSupplementarySubnetZonesSharedRouteTable(
  zones: readonly TopologyPlacementZone[],
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyPlacementZone[] {
  const sidToRtbs = buildSubnetIdToRouteTableIdsMap(plan);
  const primary = zones.filter((z) => z.topologyZoneSource !== "supplementary");
  const supplementary = zones.filter(
    (z) => z.topologyZoneSource === "supplementary",
  );
  const byVpc = new Map<string, TopologyPlacementZone[]>();
  for (const z of supplementary) {
    if (!zoneAddressesAreAllAwsSubnet(z, plan)) {
      continue;
    }
    const vk = `${z.accountId}\0${z.region}\0${z.vpcId}`;
    if (!byVpc.has(vk)) {
      byVpc.set(vk, []);
    }
    byVpc.get(vk)!.push(z);
  }

  const mergedSupp: TopologyPlacementZone[] = [];
  const passthroughSupp: TopologyPlacementZone[] = [];

  for (const z of supplementary) {
    if (!zoneAddressesAreAllAwsSubnet(z, plan)) {
      passthroughSupp.push(z);
    }
  }

  for (const [, group] of byVpc) {
    if (group.length < 2) {
      mergedSupp.push(...group);
      continue;
    }
    const n = group.length;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      const ri = routeTableIdForZoneSubnets(group[i]!, sidToRtbs);
      if (!ri) {
        continue;
      }
      for (let j = i + 1; j < n; j++) {
        const rj = routeTableIdForZoneSubnets(group[j]!, sidToRtbs);
        if (rj && ri === rj) {
          adj[i]!.push(j);
          adj[j]!.push(i);
        }
      }
    }
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (seen.has(i)) {
        continue;
      }
      const stack = [i];
      const comp: number[] = [];
      seen.add(i);
      while (stack.length) {
        const u = stack.pop()!;
        comp.push(u);
        for (const v of adj[u] ?? []) {
          if (!seen.has(v)) {
            seen.add(v);
            stack.push(v);
          }
        }
      }
      if (comp.length < 2) {
        for (const idx of comp) {
          mergedSupp.push(group[idx]!);
        }
        continue;
      }
      const subnets = new Set<string>();
      const addrs = new Set<string>();
      for (const idx of comp) {
        const zz = group[idx]!;
        for (const sid of zz.subnetIds) {
          subnets.add(sid);
        }
        for (const a of zz.addresses) {
          addrs.add(a);
        }
      }
      const subnetIds = [...subnets].sort();
      if (singleRouteTableIdForSubnets(subnetIds, sidToRtbs) == null) {
        for (const idx of comp) {
          mergedSupp.push(group[idx]!);
        }
        continue;
      }
      const z0 = group[comp[0]!]!;
      mergedSupp.push({
        accountId: z0.accountId,
        region: z0.region,
        vpcId: z0.vpcId,
        subnetSignature: subnetIds.join("|"),
        subnetIds,
        addresses: [...addrs].sort(),
        topologyZoneSource: "supplementary",
        mergedSupplementaryComposite: true,
      });
    }
  }

  return [...primary, ...mergedSupp, ...passthroughSupp].sort(
    sortPlacementZones,
  );
}

/**
 * Route table addresses on the VPC bottom strip that should be drawn per intersecting subnet
 * column instead (shared RT whose subnets span multiple placement zones).
 */
export function computeVpcRouteTableFanOutAddressesForVpc(
  zones: readonly TopologyPlacementZone[],
  placements: TopologyRouteTableBottomPlacements,
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  accountId: string,
  regionName: string,
  vpcId: string,
): ReadonlySet<string> {
  const row = placements.vpcBottom.find(
    (x) =>
      x.accountId === accountId && x.region === regionName && x.vpcId === vpcId,
  );
  if (!row || row.addresses.length === 0) {
    return new Set();
  }
  const rtidToSubnets = buildRouteTableIdToSubnetIdsFromPlan(plan);
  const addrToMeta = buildRouteTableAddressToMeta(plan);
  const vpcZones = zones.filter(
    (z) =>
      z.accountId === accountId &&
      z.region === regionName &&
      z.vpcId === vpcId &&
      z.subnetIds.length > 0,
  );
  const out = new Set<string>();
  for (const addr of row.addresses) {
    const meta = addrToMeta.get(addr);
    if (!meta) {
      continue;
    }
    const subnetSet = rtidToSubnets.get(meta.rtbId);
    if (!subnetSet || subnetSet.size === 0) {
      continue;
    }
    let hit = 0;
    for (const z of vpcZones) {
      if (z.subnetIds.some((sid) => subnetSet.has(sid))) {
        hit++;
        if (hit >= 2) {
          break;
        }
      }
    }
    if (hit >= 2) {
      out.add(addr);
    }
  }
  return out;
}

/** Subnet ids associated with this `aws_route_table` Terraform address (via RT id in plan). */
export function subnetSetForRouteTableAddress(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  routeTableAddress: string,
): ReadonlySet<string> | null {
  const meta = buildRouteTableAddressToMeta(plan).get(routeTableAddress);
  if (!meta) {
    return null;
  }
  const set = buildRouteTableIdToSubnetIdsFromPlan(plan).get(meta.rtbId);
  return set ?? null;
}

/** Per subnet-zone row: table count, min inner width, and tallest composite (for frame inset). */
export type RouteTableZoneBottomSizing = {
  tableCount: number;
  minInnerWidthPx: number;
  maxCompositeHeightPx: number;
  /** Subnet-zone frame bottom padding so route clusters are not clipped by the parent frame. */
  maxExtentBelowAnchorPx: number;
};

export function buildRouteTableZoneSizingMapForVpc(
  placements: TopologyRouteTableBottomPlacements,
  accountId: string,
  regionName: string,
  vpcId: string,
): Map<string, RouteTableZoneBottomSizing> {
  const m = new Map<string, RouteTableZoneBottomSizing>();
  for (const z of placements.zoneBottom) {
    if (
      z.accountId === accountId &&
      z.region === regionName &&
      z.vpcId === vpcId
    ) {
      m.set(z.subnetSignature, {
        tableCount: z.addresses.length,
        minInnerWidthPx: routeTableCompositeRowMinInnerWidthPx(
          z.addresses,
          z.routeChildrenByTable,
        ),
        maxCompositeHeightPx: routeTableMaxCompositeHeightForRowPx(
          z.addresses,
          z.routeChildrenByTable,
        ),
        maxExtentBelowAnchorPx: routeTableMaxExtentBelowAnchorForRowPx(
          z.addresses,
          z.routeChildrenByTable,
        ),
      });
    }
  }
  return m;
}

export function vpcBottomRouteTablesRowSizing(
  placements: TopologyRouteTableBottomPlacements,
  accountId: string,
  regionName: string,
  vpcId: string,
): {
  minInnerWidthPx: number;
  maxCompositeHeightPx: number;
  maxExtentBelowAnchorPx: number;
  tableCount: number;
} | null {
  const row = placements.vpcBottom.find(
    (x) =>
      x.accountId === accountId && x.region === regionName && x.vpcId === vpcId,
  );
  if (!row || row.addresses.length === 0) {
    return null;
  }
  return {
    tableCount: row.addresses.length,
    minInnerWidthPx: routeTableCompositeRowMinInnerWidthPx(
      row.addresses,
      row.routeChildrenByTable,
    ),
    maxCompositeHeightPx: routeTableMaxCompositeHeightForRowPx(
      row.addresses,
      row.routeChildrenByTable,
    ),
    maxExtentBelowAnchorPx: routeTableMaxExtentBelowAnchorForRowPx(
      row.addresses,
      row.routeChildrenByTable,
    ),
  };
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
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
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

    let vpcId =
      typeof values.vpc_id === "string" && values.vpc_id ? values.vpc_id : null;
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

  const out: TopologyRegionalPrimaryBucket[] = [...accum.values()].map(
    (row) => ({
      accountId: row.accountId,
      region: row.region,
      addresses: [...row.addresses].sort(),
    }),
  );

  out.sort((a, b) => {
    if (a.accountId !== b.accountId) {
      return a.accountId.localeCompare(b.accountId);
    }
    return a.region.localeCompare(b.region);
  });

  return out;
}

/** Managed default VPC resources (`vpc_id` scoped). */
export type TopologyVpcDefaultPlumbingBucket = {
  accountId: string;
  region: string;
  vpcId: string;
  addresses: string[];
};

const VPC_DEFAULT_TYPES = new Set([
  "aws_default_network_acl",
  "aws_default_route_table",
  "aws_default_security_group",
  "aws_eip",
  "aws_internet_gateway",
  "aws_nat_gateway",
]);

/**
 * Default VPC plumbing (NACL / route table / security group) grouped by VPC.
 */
export function extractVpcDefaultPlumbingBuckets(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyVpcDefaultPlumbingBucket[] {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);
  const subnetToVpc = buildSubnetToVpcMapFromPlan(plan);
  const natAllocationToVpc = new Map<string, string>();

  for (const rc of changes) {
    if (
      !isAwsTerraformResourceChange(rc) ||
      rc.mode !== "managed" ||
      rc.type !== "aws_nat_gateway"
    ) {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    const allocationId = stringField(values.allocation_id);
    const subnetId = stringField(values.subnet_id);
    const vpcId = subnetId ? subnetToVpc.get(subnetId) : null;
    if (allocationId && vpcId) {
      natAllocationToVpc.set(allocationId, vpcId);
    }
  }

  const accum = new Map<
    string,
    { accountId: string; region: string; vpcId: string; addresses: Set<string> }
  >();

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || !rc.type || !VPC_DEFAULT_TYPES.has(rc.type)) {
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
    let vpcIdRaw = stringField(values.vpc_id);
    if (!vpcIdRaw && rc.type === "aws_nat_gateway") {
      const subnetId = stringField(values.subnet_id);
      vpcIdRaw = subnetId ? subnetToVpc.get(subnetId) ?? null : null;
    }
    if (!vpcIdRaw && rc.type === "aws_eip") {
      const id = stringField(values.id) ?? stringField(values.allocation_id);
      vpcIdRaw = id ? natAllocationToVpc.get(id) ?? null : null;
    }
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
    const key = vpcEndpointBucketKey(accountId, region, vpcIdRaw);
    let row = accum.get(key);
    if (!row) {
      row = { accountId, region, vpcId: vpcIdRaw, addresses: new Set() };
      accum.set(key, row);
    }
    row.addresses.add(address);
  }

  const out: TopologyVpcDefaultPlumbingBucket[] = [...accum.values()].map(
    (row) => ({
      accountId: row.accountId,
      region: row.region,
      vpcId: row.vpcId,
      addresses: [...row.addresses].sort(),
    }),
  );

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

/**
 * `aws_subnet` resources not covered by any primary zone’s subnet multiset (e.g. intra subnets).
 */
export function extractSupplementarySubnetZones(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  primaryZones: readonly TopologyPlacementZone[],
): TopologyPlacementZone[] {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  const covered = new Set<string>();
  for (const z of primaryZones) {
    for (const sid of z.subnetIds) {
      covered.add(`${z.accountId}\0${z.region}\0${z.vpcId}\0${sid}`);
    }
  }

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
    if (rc.mode !== "managed" || rc.type !== "aws_subnet") {
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
    const subnetId = stringField(values.id);
    const vpcIdRaw = stringField(values.vpc_id);
    if (!subnetId || !vpcIdRaw) {
      continue;
    }
    const subnetIds = [subnetId];
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
    const coverKey = `${accountId}\0${region}\0${vpcIdRaw}\0${subnetId}`;
    if (covered.has(coverKey)) {
      continue;
    }

    const subnetSignature = subnetId;
    const key = zoneMapKey(accountId, region, vpcIdRaw, subnetSignature);
    let row = accum.get(key);
    if (!row) {
      row = {
        accountId,
        region,
        vpcId: vpcIdRaw,
        subnetSignature,
        subnetIds: [subnetId],
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

/** VPC-scoped flow log module resources. */
export type TopologyVpcFlowLogBucket = {
  accountId: string;
  region: string;
  vpcId: string;
  addresses: string[];
};

/**
 * `aws_flow_log` plus other `resource_changes` rows in the **same Terraform module prefix**
 * (CloudWatch log group, IAM role/policy, data policy documents).
 */
export function extractVpcFlowLogBundles(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyVpcFlowLogBucket[] {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  type FlowRow = {
    address: string;
    modulePrefix: string;
    accountId: string;
    region: string;
    vpcId: string;
  };
  const flowRows: FlowRow[] = [];

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_flow_log") {
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
    flowRows.push({
      address,
      modulePrefix: terraformModulePrefixForAddress(address),
      accountId,
      region,
      vpcId: vpcIdRaw,
    });
  }

  const accum = new Map<
    string,
    { accountId: string; region: string; vpcId: string; addresses: Set<string> }
  >();

  for (const fr of flowRows) {
    const key = vpcEndpointBucketKey(fr.accountId, fr.region, fr.vpcId);
    let row = accum.get(key);
    if (!row) {
      row = {
        accountId: fr.accountId,
        region: fr.region,
        vpcId: fr.vpcId,
        addresses: new Set(),
      };
      accum.set(key, row);
    }
    row.addresses.add(fr.address);
  }

  const allowedCompanion = (rc: ResourceChange): boolean => {
    const t = rc.type;
    if (!t) {
      return false;
    }
    if (
      t === "aws_cloudwatch_log_group" ||
      t === "aws_flow_log" ||
      t === "aws_iam_role" ||
      t === "aws_iam_role_policy" ||
      t === "aws_iam_policy"
    ) {
      return true;
    }
    return rc.mode === "data" && t === "aws_iam_policy_document";
  };

  for (const rc of changes) {
    const addr = rc.address;
    if (!addr || typeof addr !== "string") {
      continue;
    }
    if (!allowedCompanion(rc)) {
      continue;
    }
    const pref = terraformModulePrefixForAddress(addr);
    if (!pref) {
      continue;
    }
    for (const fr of flowRows) {
      if (pref !== fr.modulePrefix) {
        continue;
      }
      const key = vpcEndpointBucketKey(fr.accountId, fr.region, fr.vpcId);
      const row = accum.get(key);
      if (row) {
        row.addresses.add(addr);
      }
    }
  }

  const out: TopologyVpcFlowLogBucket[] = [...accum.values()].map((row) => ({
    accountId: row.accountId,
    region: row.region,
    vpcId: row.vpcId,
    addresses: [...row.addresses].sort(),
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

/** Security groups referenced by interface VPC endpoints in the same VPC. */
export type TopologyEndpointSecurityGroupBucket = {
  accountId: string;
  region: string;
  vpcId: string;
  addresses: string[];
};

function parseSecurityGroupIdsFromValues(
  values: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  const raw = values.security_group_ids;
  if (!Array.isArray(raw)) {
    return out;
  }
  for (const item of raw) {
    if (typeof item === "string" && item.startsWith("sg-")) {
      out.push(item);
    }
  }
  return out;
}

/**
 * `aws_security_group` resources whose `id` appears in `aws_vpc_endpoint.security_group_ids`
 * for endpoints in `vpcEndpointBuckets`.
 */
export function extractInterfaceEndpointSecurityGroupBuckets(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  vpcEndpointBuckets: readonly TopologyVpcEndpointBucket[],
): TopologyEndpointSecurityGroupBucket[] {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  const sgIdsByVpc = new Map<
    string,
    { accountId: string; region: string; vpcId: string; sgIds: Set<string> }
  >();

  for (const b of vpcEndpointBuckets) {
    const key = vpcEndpointBucketKey(b.accountId, b.region, b.vpcId);
    if (!sgIdsByVpc.has(key)) {
      sgIdsByVpc.set(key, {
        accountId: b.accountId,
        region: b.region,
        vpcId: b.vpcId,
        sgIds: new Set(),
      });
    }
  }

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
    const key = vpcEndpointBucketKey(accountId, region, vpcIdRaw);
    if (!sgIdsByVpc.has(key)) {
      continue;
    }
    for (const sg of parseSecurityGroupIdsFromValues(values)) {
      sgIdsByVpc.get(key)!.sgIds.add(sg);
    }
  }

  const sgAddressById = new Map<string, string>();
  const sgModulePrefixById = new Map<string, string>();
  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_security_group") {
      continue;
    }
    const addr = rc.address;
    if (!addr || typeof addr !== "string") {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    const id = stringField(values.id);
    if (id && id.startsWith("sg-")) {
      sgAddressById.set(id, addr);
      sgModulePrefixById.set(id, terraformModulePrefixForAddress(addr));
    }
  }

  const sgRuleAddressesBySgId = new Map<string, Set<string>>();
  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_security_group_rule") {
      continue;
    }
    const addr = rc.address;
    if (!addr || typeof addr !== "string") {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    const sgId = stringField(values.security_group_id);
    const matchingSgId =
      sgId && sgId.startsWith("sg-")
        ? sgId
        : [...sgModulePrefixById.entries()].find(
            ([, prefix]) =>
              prefix && prefix === terraformModulePrefixForAddress(addr),
          )?.[0] ?? null;
    if (!matchingSgId) {
      continue;
    }
    if (!sgRuleAddressesBySgId.has(matchingSgId)) {
      sgRuleAddressesBySgId.set(matchingSgId, new Set());
    }
    sgRuleAddressesBySgId.get(matchingSgId)!.add(addr);
  }

  const out: TopologyEndpointSecurityGroupBucket[] = [];
  for (const [, row] of sgIdsByVpc) {
    const addresses: string[] = [];
    for (const sgId of row.sgIds) {
      const a = sgAddressById.get(sgId);
      if (a) {
        addresses.push(a);
      }
      for (const ruleAddr of sgRuleAddressesBySgId.get(sgId) ?? []) {
        addresses.push(ruleAddr);
      }
    }
    if (addresses.length === 0) {
      continue;
    }
    addresses.sort();
    out.push({
      accountId: row.accountId,
      region: row.region,
      vpcId: row.vpcId,
      addresses,
    });
  }

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
