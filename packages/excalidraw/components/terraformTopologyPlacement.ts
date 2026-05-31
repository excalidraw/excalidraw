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
  buildSecurityGroupToVpcMapFromPlan,
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
import {
  API_GATEWAY_TOPOLOGY_SATELLITE_TYPES,
  resolveApiGatewayCompanionParentRestApiAddressFromPlan,
  resolveVpcPlacementFromPrivateRestApi,
} from "./terraformTopologyApiGatewayLinks";
import {
  TGW_TOPOLOGY_SATELLITE_TYPES,
  resolveTransitGatewayCompanionParentFromPlan,
  tgwModulePrefixForAddress,
} from "./terraformTopologyTransitGatewayLinks";
import { stripStackPrefixForModuleParsing } from "./terraformStackAddress";
import { resolveAlbCompanionParentLbAddressFromPlan } from "./terraformTopologyAlbLinks";
import {
  isEcsTopologySatelliteResourceType,
  resolveEcsCompanionParentServiceAddressFromPlan,
} from "./terraformTopologyEcsLinks";
import { resolveLambdaPermissionTargetLambdaAddressFromPlan } from "./terraformTopologyLambdaPermissionLinks";
import { resolveDbSubnetGroupSubnetIds } from "./terraformTopologyDatastoreLinks";
import { buildRouteTableIdToRouteAddressesFromPlan } from "./terraformTopologyRouteLinks";

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
  /** Supplementary-only zones merged by subnet tier within the same VPC. */
  mergedSupplementaryByTier?: boolean;
  /** Primary zones merged by subnet tier (public / intra / private) within the same VPC. */
  mergedPrimaryByTier?: boolean;
};

export type TopologySubnetTier =
  | "vpcOnly"
  | "public"
  | "intra"
  | "private"
  | "other";

export const SUBNET_TIER_ORDER: Record<TopologySubnetTier, number> = {
  vpcOnly: 0,
  public: 1,
  intra: 2,
  private: 3,
  other: 4,
};

function resourceNameFromSubnetValues(
  values: Record<string, unknown>,
): string | null {
  const tags = values.tags;
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    const name = (tags as Record<string, unknown>).Name;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
  }
  const name = values.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Subnet id → display name from `aws_subnet` tag `Name` (or resource `name`). */
export function buildTopologySubnetNameMap(
  plan?: unknown,
): Map<string, string> {
  const out = new Map<string, string>();
  const changes = (plan as { resource_changes?: ResourceChange[] } | undefined)
    ?.resource_changes;
  if (!Array.isArray(changes)) {
    return out;
  }
  for (const rc of changes) {
    if (rc.type !== "aws_subnet") {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    const id = typeof values.id === "string" ? values.id : null;
    const name = resourceNameFromSubnetValues(values);
    if (id && name) {
      out.set(id, name);
    }
  }
  return out;
}

export function topologySubnetTierFromSubnetId(
  subnetId: string,
  subnetNameById: ReadonlyMap<string, string>,
): TopologySubnetTier {
  const label = `${
    subnetNameById.get(subnetId) ?? ""
  } ${subnetId}`.toLowerCase();
  if (/\bpublic\b/.test(label) || label.includes("-public-")) {
    return "public";
  }
  if (/\bintra\b/.test(label) || label.includes("-intra-")) {
    return "intra";
  }
  if (/\bprivate\b/.test(label) || label.includes("-private-")) {
    return "private";
  }
  if (/\bdatabase\b/.test(label) || label.includes("-database-")) {
    return "other";
  }
  return "other";
}

export function topologySubnetTierFromZone(
  z: TopologyPlacementZone,
  subnetNameById: ReadonlyMap<string, string>,
): TopologySubnetTier {
  if (z.subnetIds.length === 0) {
    return "vpcOnly";
  }
  const labels = z.subnetIds
    .map((sid) => `${subnetNameById.get(sid) ?? ""} ${sid}`.toLowerCase())
    .join(" ");
  if (/\bpublic\b/.test(labels) || labels.includes("-public-")) {
    return "public";
  }
  if (/\bintra\b/.test(labels) || labels.includes("-intra-")) {
    return "intra";
  }
  if (/\bprivate\b/.test(labels) || labels.includes("-private-")) {
    return "private";
  }
  if (/\bdatabase\b/.test(labels) || labels.includes("-database-")) {
    return "other";
  }
  const hasVpcCompute = z.addresses.some(
    (a) =>
      a.includes("aws_ecs_service") ||
      a.includes("aws_lambda_function") ||
      /\.aws_lb[.\[]/.test(a),
  );
  if (hasVpcCompute) {
    return "private";
  }
  if (
    z.addresses.some(
      (a) =>
        a.includes("aws_rds_cluster") || a.includes("aws_db_instance"),
    )
  ) {
    return "other";
  }
  // Private REST APIs without subnet name hints use the intra strip (execute-api VPCE).
  if (z.addresses.some((a) => a.includes("aws_api_gateway_rest_api"))) {
    return "intra";
  }
  return "other";
}

/**
 * Resolve VPC for placement when `subnetToVpc` lacks stale subnet ids (multi-state imports).
 */
export function resolveTopologyVpcId(
  type: string,
  values: Record<string, unknown>,
  subnetIds: readonly string[],
  subnetToVpc: ReadonlyMap<string, string>,
  securityGroupToVpc: ReadonlyMap<string, string>,
): string | null {
  let vpcId: string | null = null;
  const topLevel = values.vpc_id;
  if (typeof topLevel === "string" && topLevel.length > 0) {
    vpcId = topLevel;
  }
  if (!vpcId && type === "aws_lambda_function") {
    for (const block of vpcConfigBlocks(values)) {
      const blockVpc = block.vpc_id;
      if (typeof blockVpc === "string" && blockVpc.length > 0) {
        vpcId = blockVpc;
        break;
      }
    }
  }
  if (!vpcId && subnetIds.length > 0) {
    vpcId = subnetToVpc.get(subnetIds[0]!) ?? null;
  }
  if (!vpcId) {
    for (const sg of collectInferenceSecurityGroupIdsFromResource(type, values)) {
      const fromSg = securityGroupToVpc.get(sg);
      if (fromSg) {
        vpcId = fromSg;
        break;
      }
    }
  }
  return vpcId;
}

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

/** One interface VPCE draw instance inside a subnet zone (mirrors use the same Terraform address). */
export type InterfaceVpcEndpointZonePlacement = {
  address: string;
  /** Same logical endpoint is also drawn in another zone (subnet mirror). */
  subnetMirrorDuplicate: boolean;
};

export type InterfaceVpcEndpointZonePlacementMap = ReadonlyMap<
  string,
  readonly InterfaceVpcEndpointZonePlacement[]
>;

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

type ResourceChange = {
  address?: string;
  mode?: string;
  type?: string;
  provider_name?: string;
  change?: { actions?: string[]; before?: unknown; after?: unknown };
};

const ROUTE_TABLE_SEMANTIC_GAP = tfComfortPx(10);
const ALB_COMPANION_TYPES = new Set([
  "aws_lb_listener",
  "aws_lb_target_group",
  "aws_lb_target_group_attachment",
]);

const SG_RULE_TYPES_PLACEMENT = new Set([
  "aws_vpc_security_group_ingress_rule",
  "aws_vpc_security_group_egress_rule",
  "aws_security_group_rule",
]);

function stripIndexesForTopologyRef(address: string): string {
  return address.replace(/\[[^\]]+\]/g, "");
}

function isPlainObjectForPlacement(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function flattenStringishForPlacement(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenStringishForPlacement(item, out);
    }
    return;
  }
  if (isPlainObjectForPlacement(value)) {
    for (const v of Object.values(value)) {
      flattenStringishForPlacement(v, out);
    }
  }
}

function findAwsSecurityGroupAddressForTopologyPlanRef(
  ref: string,
  changes: readonly ResourceChange[],
): string | null {
  const t = ref.trim();
  if (!t) {
    return null;
  }
  const stripT = stripIndexesForTopologyRef(t);

  for (const rc of changes) {
    if (rc.type !== "aws_security_group" || typeof rc.address !== "string") {
      continue;
    }
    const addr = rc.address;
    const stripAddr = stripIndexesForTopologyRef(addr);
    if (
      t === addr ||
      stripT === stripAddr ||
      t === stripAddr ||
      stripT === addr
    ) {
      return addr;
    }
  }

  if (t.startsWith("sg-")) {
    for (const rc of changes) {
      if (rc.type !== "aws_security_group" || typeof rc.address !== "string") {
        continue;
      }
      const pv = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
      if (!pv) {
        continue;
      }
      const id = typeof pv.id === "string" ? pv.id : "";
      if (id === t) {
        return rc.address;
      }
    }
  }

  return null;
}

function pickResourceChangeByAddress(
  changes: readonly ResourceChange[],
  address: string,
): ResourceChange | null {
  for (const rc of changes) {
    if (rc.address === address) {
      return rc;
    }
  }
  return null;
}

function sgRuleSecurityGroupIdMatchesSgAddress(
  sgAddress: string,
  sgId: string,
  sgArn: string,
  ruleSgIdField: unknown,
  changes: readonly ResourceChange[],
): boolean {
  const flat: string[] = [];
  flattenStringishForPlacement(ruleSgIdField, flat);
  for (const s of flat) {
    const x = s.trim();
    if (!x) {
      continue;
    }
    if (x === sgAddress || stripIndexesForTopologyRef(x) === sgAddress) {
      return true;
    }
    if (sgId && (x === sgId || x.includes(sgId))) {
      return true;
    }
    if (sgArn && x === sgArn) {
      return true;
    }
    const resolved = findAwsSecurityGroupAddressForTopologyPlanRef(x, changes);
    if (resolved === sgAddress) {
      return true;
    }
  }
  return false;
}

function collectRuleChangeAddressesForSgPlan(
  sgAddress: string,
  changes: readonly ResourceChange[],
): string[] {
  const sgRc = pickResourceChangeByAddress(changes, sgAddress);
  if (!sgRc) {
    return [];
  }
  const sgVals = pickResourceValuesForTopologyPlacement(sgRc as ResourceChange);
  const sgId = sgVals && typeof sgVals.id === "string" ? sgVals.id : "";
  const sgArn = sgVals && typeof sgVals.arn === "string" ? sgVals.arn : "";

  const out: string[] = [];
  const seen = new Set<string>();
  for (const rc of changes) {
    if (!rc.type || !SG_RULE_TYPES_PLACEMENT.has(rc.type)) {
      continue;
    }
    if (typeof rc.address !== "string") {
      continue;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!pv) {
      continue;
    }
    if (
      sgRuleSecurityGroupIdMatchesSgAddress(
        sgAddress,
        sgId,
        sgArn,
        pv.security_group_id,
        changes,
      )
    ) {
      if (!seen.has(rc.address)) {
        seen.add(rc.address);
        out.push(rc.address);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

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
  for (const sid of stringArrayField(values.subnets)) {
    ids.add(sid);
  }
  const subnetMapping = values.subnet_mapping;
  if (Array.isArray(subnetMapping)) {
    for (const entry of subnetMapping) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const sid = stringField((entry as Record<string, unknown>).subnet_id);
        if (sid) {
          ids.add(sid);
        }
      }
    }
  }
  const networkConfiguration = values.network_configuration;
  if (Array.isArray(networkConfiguration)) {
    for (const entry of networkConfiguration) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        for (const sid of stringArrayField(
          (entry as Record<string, unknown>).subnets,
        )) {
          ids.add(sid);
        }
      }
    }
  }
  return [...ids].sort();
}

function bareAddressInTerraformModule(
  modulePrefix: string,
  address: string,
): boolean {
  const bare = stripStackPrefixForModuleParsing(address);
  return bare === modulePrefix || bare.startsWith(`${modulePrefix}.`);
}

/**
 * Union of `subnet_ids` / `subnets` on managed resources in the same Terraform module
 * as `anchorAddress` (e.g. Lambda subnets for `module.api` when placing a private API).
 * Satellites and the anchor itself are skipped; only resources with placement subnets count.
 */
export function inferSubnetIdsForModuleColocatedPrimaries(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  anchorAddress: string,
): string[] {
  const modulePrefix = terraformModulePrefixForAddress(
    stripStackPrefixForModuleParsing(anchorAddress),
  );
  if (!modulePrefix) {
    return [];
  }
  const skipTypes = new Set<string>([
    ...API_GATEWAY_TOPOLOGY_SATELLITE_TYPES,
    "aws_cloudwatch_log_group",
    "aws_lambda_permission",
  ]);
  const ids = new Set<string>();
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc) || rc.mode !== "managed") {
      continue;
    }
    const addr = rc.address;
    if (!addr || typeof addr !== "string") {
      continue;
    }
    if (!bareAddressInTerraformModule(modulePrefix, addr)) {
      continue;
    }
    const t = rc.type;
    if (!t || skipTypes.has(t) || t === "aws_api_gateway_rest_api") {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    for (const sid of collectPlacementSubnetIds(values)) {
      ids.add(sid);
    }
  }

  return [...ids].sort();
}

/** `aws_lb.security_groups` entries that are resolved SG ids in the plan JSON. */
function parseLbSecurityGroupIds(values: Record<string, unknown>): string[] {
  return stringArrayField(values.security_groups).filter((s) =>
    s.startsWith("sg-"),
  );
}

function collectInferenceSubnetIdsFromResource(
  type: string,
  values: Record<string, unknown>,
): string[] {
  const ids = new Set<string>();
  if (type === "aws_instance" || type === "aws_spot_instance_request") {
    const sid = stringField(values.subnet_id);
    if (sid) {
      ids.add(sid);
    }
  }
  if (type === "aws_lambda_function") {
    for (const block of vpcConfigBlocks(values)) {
      for (const sid of stringArrayField(block.subnet_ids)) {
        ids.add(sid);
      }
    }
  }
  if (type === "aws_ecs_service") {
    for (const sid of collectEcsServiceNetworkFieldIds(values, "subnets")) {
      ids.add(sid);
    }
  }
  return [...ids].sort();
}

/** `network_configuration[*].subnets` / `security_groups` on Fargate ECS services. */
export function collectEcsServiceNetworkFieldIds(
  values: Record<string, unknown>,
  field: "subnets" | "security_groups",
): string[] {
  const out: string[] = [];
  const networkConfiguration = values.network_configuration;
  if (!Array.isArray(networkConfiguration)) {
    return out;
  }
  for (const entry of networkConfiguration) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      out.push(...stringArrayField((entry as Record<string, unknown>)[field]));
    }
  }
  return out;
}

function collectInferenceSecurityGroupIdsFromResource(
  type: string,
  values: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  if (type === "aws_instance" || type === "aws_spot_instance_request") {
    out.push(...stringArrayField(values.vpc_security_group_ids));
  }
  if (type === "aws_lambda_function") {
    for (const block of vpcConfigBlocks(values)) {
      out.push(...stringArrayField(block.security_group_ids));
    }
  }
  if (type === "aws_ecs_service") {
    out.push(...collectEcsServiceNetworkFieldIds(values, "security_groups"));
  }
  if (type === "aws_rds_cluster" || type === "aws_db_instance") {
    out.push(...stringArrayField(values.vpc_security_group_ids));
  }
  return out.filter((s) => s.startsWith("sg-"));
}

const SG_SUBNET_INFERENCE_PEER_TYPES = new Set([
  "aws_instance",
  "aws_spot_instance_request",
  "aws_lambda_function",
  "aws_ecs_service",
]);

function securityGroupIdsForSubnetInference(
  type: string,
  values: Record<string, unknown>,
): string[] {
  if (type === "aws_lb") {
    return parseLbSecurityGroupIds(values);
  }
  return collectInferenceSecurityGroupIdsFromResource(type, values);
}

/**
 * When a VPC-bound resource has no placement subnets in the plan snapshot, infer subnet ids
 * from other resources that share its security group ids (same VPC when `vpc_id` is known).
 */
export function inferSubnetIdsFromPlanSecurityGroups(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  type: string,
  values: Record<string, unknown>,
  subnetToVpc: ReadonlyMap<string, string>,
): string[] {
  const resourceSg = new Set(securityGroupIdsForSubnetInference(type, values));
  if (resourceSg.size === 0) {
    return [];
  }
  const resourceVpcId = stringField(values.vpc_id);
  const inferred = new Set<string>();
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    const peerType = rc.type;
    if (!peerType || !SG_SUBNET_INFERENCE_PEER_TYPES.has(peerType)) {
      continue;
    }
    const v = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!v) {
      continue;
    }
    const candSgs = collectInferenceSecurityGroupIdsFromResource(peerType, v);
    if (!candSgs.some((sg) => resourceSg.has(sg))) {
      continue;
    }
    const candSubnets = collectInferenceSubnetIdsFromResource(peerType, v);
    for (const sid of candSubnets) {
      if (resourceVpcId) {
        const vpc = subnetToVpc.get(sid);
        if (vpc === resourceVpcId) {
          inferred.add(sid);
        }
      } else {
        inferred.add(sid);
      }
    }
  }

  return [...inferred].sort((a, b) => a.localeCompare(b));
}

/**
 * When an `aws_lb` has no `subnets` / `subnet_mapping` / `subnet_ids` in the placement snapshot,
 * infer subnet ids from other resources in the plan that share the LB's security group ids
 * (same VPC when `vpc_id` is known on the LB).
 */
export function inferSubnetIdsForLbFromPlanSecurityGroups(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  lbValues: Record<string, unknown>,
  subnetToVpc: ReadonlyMap<string, string>,
): string[] {
  return inferSubnetIdsFromPlanSecurityGroups(
    plan,
    "aws_lb",
    lbValues,
    subnetToVpc,
  );
}

export function applySubnetInferenceFromSecurityGroups(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  type: string,
  values: Record<string, unknown>,
  subnetIds: string[],
  subnetToVpc: ReadonlyMap<string, string>,
): string[] {
  if (subnetIds.length > 0) {
    return subnetIds;
  }
  if (
    type !== "aws_lb" &&
    type !== "aws_ecs_service" &&
    type !== "aws_lambda_function"
  ) {
    return subnetIds;
  }
  return inferSubnetIdsFromPlanSecurityGroups(
    plan,
    type,
    values,
    subnetToVpc,
  );
}

export function topologyZoneMapKey(
  account: string,
  region: string,
  vpcId: string,
  subnetSignature: string,
): string {
  return `${account}\0${region}\0${vpcId}\0${subnetSignature}`;
}

function zoneMapKey(
  account: string,
  region: string,
  vpcId: string,
  subnetSignature: string,
): string {
  return topologyZoneMapKey(account, region, vpcId, subnetSignature);
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
  const securityGroupToVpc = buildSecurityGroupToVpcMapFromPlan(plan);
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);
  const albModulePrefixes: Array<{ prefix: string; key: string }> = [];
  const apiModulePrefixes: Array<{ prefix: string; key: string }> = [];
  const ecsModulePrefixes: Array<{ prefix: string; key: string }> = [];
  const lbAddressToZoneKey = new Map<string, string>();
  const restApiAddressToZoneKey = new Map<string, string>();
  const ecsServiceAddressToZoneKey = new Map<string, string>();

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

    let subnetIds = applySubnetInferenceFromSecurityGroups(
      plan,
      t,
      values,
      collectPlacementSubnetIds(values),
      subnetToVpc,
    );
    if (
      (t === "aws_rds_cluster" || t === "aws_db_instance") &&
      subnetIds.length === 0
    ) {
      subnetIds = resolveDbSubnetGroupSubnetIds(plan, address, values);
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
      continue;
    }

    let vpcId = resolveTopologyVpcId(
      t,
      values,
      subnetIds,
      subnetToVpc,
      securityGroupToVpc,
    );
    if (!vpcId && t === "aws_api_gateway_rest_api") {
      const vpcePlacement = resolveVpcPlacementFromPrivateRestApi(
        plan,
        values,
        subnetToVpc,
      );
      if (vpcePlacement) {
        vpcId = vpcePlacement.vpcId;
        if (subnetIds.length === 0) {
          subnetIds = vpcePlacement.subnetIds;
        }
      }
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
      lbAddressToZoneKey.set(address, key);
      albModulePrefixes.push({
        prefix: terraformModulePrefixForAddress(address),
        key,
      });
    }
    if (t === "aws_api_gateway_rest_api") {
      restApiAddressToZoneKey.set(address, key);
      apiModulePrefixes.push({
        prefix: terraformModulePrefixForAddress(
          stripStackPrefixForModuleParsing(address),
        ),
        key,
      });
    }
    if (t === "aws_ecs_service") {
      ecsServiceAddressToZoneKey.set(address, key);
      ecsModulePrefixes.push({
        prefix: terraformModulePrefixForAddress(
          stripStackPrefixForModuleParsing(address),
        ),
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
      !API_GATEWAY_TOPOLOGY_SATELLITE_TYPES.has(rc.type)
    ) {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }
    const parentApi = resolveApiGatewayCompanionParentRestApiAddressFromPlan(
      rc as ResourceChange,
      changes,
    );
    if (parentApi) {
      const zoneKey = restApiAddressToZoneKey.get(parentApi);
      if (zoneKey) {
        accum.get(zoneKey)?.addresses.add(address);
      }
      continue;
    }
    const prefix = terraformModulePrefixForAddress(
      stripStackPrefixForModuleParsing(address),
    );
    const owner = apiModulePrefixes.find((x) => x.prefix === prefix);
    if (owner) {
      accum.get(owner.key)?.addresses.add(address);
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
    const parentLb = resolveAlbCompanionParentLbAddressFromPlan(rc, changes);
    if (parentLb) {
      const zoneKey = lbAddressToZoneKey.get(parentLb);
      if (zoneKey) {
        accum.get(zoneKey)?.addresses.add(address);
      }
      continue;
    }
    const prefix = terraformModulePrefixForAddress(address);
    const owner = albModulePrefixes.find((x) => x.prefix === prefix);
    if (!owner) {
      continue;
    }
    accum.get(owner.key)?.addresses.add(address);
  }

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (
      rc.mode !== "managed" ||
      !rc.type ||
      !isEcsTopologySatelliteResourceType(rc.type)
    ) {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }
    const parentService = resolveEcsCompanionParentServiceAddressFromPlan(
      rc,
      changes,
    );
    if (parentService) {
      const zoneKey = ecsServiceAddressToZoneKey.get(parentService);
      if (zoneKey) {
        accum.get(zoneKey)?.addresses.add(address);
      }
      continue;
    }
    const prefix = terraformModulePrefixForAddress(
      stripStackPrefixForModuleParsing(address),
    );
    const owner = ecsModulePrefixes.find((x) => x.prefix === prefix);
    if (owner) {
      accum.get(owner.key)?.addresses.add(address);
    }
  }

  const addressToZoneRow = new Map<
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
  for (const row of accum.values()) {
    for (const addr of row.addresses) {
      addressToZoneRow.set(addr, row);
    }
  }

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_lambda_permission") {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }
    const targetLambda = resolveLambdaPermissionTargetLambdaAddressFromPlan(
      rc,
      changes,
    );
    if (!targetLambda) {
      continue;
    }
    const row = addressToZoneRow.get(targetLambda);
    if (row) {
      row.addresses.add(address);
    }
  }

  for (const row of accum.values()) {
    for (const addr of [...row.addresses]) {
      const lbRc = pickResourceChangeByAddress(changes, addr);
      if (!lbRc || lbRc.type !== "aws_lb") {
        continue;
      }
      const pv = pickResourceValuesForTopologyPlacement(lbRc as ResourceChange);
      if (!pv) {
        continue;
      }
      const refs: string[] = [];
      flattenStringishForPlacement(pv.security_groups, refs);
      for (const r of refs) {
        const sgAddr = findAwsSecurityGroupAddressForTopologyPlanRef(
          r,
          changes,
        );
        if (!sgAddr) {
          continue;
        }
        row.addresses.add(sgAddr);
        for (const ruleAddr of collectRuleChangeAddressesForSgPlan(
          sgAddr,
          changes,
        )) {
          row.addresses.add(ruleAddr);
        }
      }
    }
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

function findZoneContainingSubnet(
  zones: readonly TopologyPlacementZone[],
  accountId: string,
  region: string,
  vpcId: string,
  subnetId: string,
): TopologyPlacementZone | undefined {
  return zones.find(
    (z) =>
      z.accountId === accountId &&
      z.region === region &&
      z.vpcId === vpcId &&
      z.subnetIds.includes(subnetId),
  );
}

/**
 * Interface endpoints whose `subnet_ids` all resolve to placement zones: attach to those
 * zones (one tile per distinct zone). If subnets map to **multiple** zones, each tile is a
 * mirror duplicate (`subnetMirrorDuplicate`). Unmatched or Gateway endpoints are omitted
 * here (they stay on the VPC strip via bucket filtering).
 */
export function computeInterfaceVpcEndpointZonePlacements(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  zones: readonly TopologyPlacementZone[],
): {
  byZone: Map<string, InterfaceVpcEndpointZonePlacement[]>;
  zonePlacedAddresses: ReadonlySet<string>;
} {
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);
  const byZone = new Map<string, InterfaceVpcEndpointZonePlacement[]>();
  const zonePlacedAddresses = new Set<string>();

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
    const epType = stringField(values.vpc_endpoint_type);
    if (epType !== "Interface") {
      continue;
    }
    const vpcIdRaw = stringField(values.vpc_id);
    if (!vpcIdRaw) {
      continue;
    }
    const subnetIds = collectPlacementSubnetIds(values);
    if (subnetIds.length === 0) {
      continue;
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
      continue;
    }

    const uniqZones: TopologyPlacementZone[] = [];
    const seenSig = new Set<string>();
    let allSubnetsResolve = true;
    for (const sid of subnetIds) {
      const z = findZoneContainingSubnet(
        zones,
        accountId,
        region,
        vpcIdRaw,
        sid,
      );
      if (!z) {
        allSubnetsResolve = false;
        break;
      }
      if (!seenSig.has(z.subnetSignature)) {
        seenSig.add(z.subnetSignature);
        uniqZones.push(z);
      }
    }
    if (!allSubnetsResolve || uniqZones.length === 0) {
      continue;
    }

    const subnetMirrorDuplicate = uniqZones.length > 1;
    for (const z of uniqZones) {
      const zk = topologyZoneMapKey(
        z.accountId,
        z.region,
        z.vpcId,
        z.subnetSignature,
      );
      const row = byZone.get(zk) ?? [];
      row.push({ address, subnetMirrorDuplicate });
      byZone.set(zk, row);
      zonePlacedAddresses.add(address);
    }
  }

  return {
    byZone,
    zonePlacedAddresses,
  };
}

export function filterVpcEndpointBucketsRemovingZonePlacedAddresses(
  buckets: readonly TopologyVpcEndpointBucket[],
  zonePlacedAddresses: ReadonlySet<string>,
): TopologyVpcEndpointBucket[] {
  return buckets.map((b) => ({
    ...b,
    addresses: b.addresses.filter((a) => !zonePlacedAddresses.has(a)),
  }));
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

export type RouteTablePlanIndexes = {
  rtidToSubnets: Map<string, Set<string>>;
  addrToMeta: Map<string, RouteTableAddressMeta>;
};

/** Built once per topology layout pass; reused for VPC route-table fan-out. */
export function buildRouteTablePlanIndexes(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): RouteTablePlanIndexes {
  return {
    rtidToSubnets: buildRouteTableIdToSubnetIdsFromPlan(plan),
    addrToMeta: buildRouteTableAddressToMeta(plan),
  };
}

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

/** Route addresses already drawn as tier-2 tiles under route-table bottom rows. */
export function collectRouteAddressesFromBottomPlacements(
  placements: TopologyRouteTableBottomPlacements,
): readonly string[] {
  const out = new Set<string>();
  for (const row of placements.zoneBottom) {
    for (const addrs of Object.values(row.routeChildrenByTable)) {
      for (const a of addrs) {
        out.add(a);
      }
    }
  }
  for (const row of placements.vpcBottom) {
    for (const addrs of Object.values(row.routeChildrenByTable)) {
      for (const a of addrs) {
        out.add(a);
      }
    }
  }
  return [...out];
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
  if (z.topologyZoneSource === "supplementary" && z.addresses.length === 0) {
    return true;
  }
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
      for (const idx of comp) {
        const zz = group[idx]!;
        for (const sid of zz.subnetIds) {
          subnets.add(sid);
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
        addresses: [],
        topologyZoneSource: "supplementary",
      });
    }
  }

  return [...primary, ...mergedSupp, ...passthroughSupp].sort(
    sortPlacementZones,
  );
}

/**
 * Merge primary placement zones in the same VPC when every subnet in each zone belongs to
 * the same tier (public, intra, or private). Unions subnet ids and primary addresses.
 */
export function mergePrimaryTopologyZonesByTier(
  zones: readonly TopologyPlacementZone[],
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyPlacementZone[] {
  const subnetNameById = buildTopologySubnetNameMap(plan);
  const passthrough: TopologyPlacementZone[] = [];
  const byVpcTier = new Map<string, TopologyPlacementZone[]>();

  for (const z of zones) {
    if (z.topologyZoneSource === "supplementary") {
      passthrough.push(z);
      continue;
    }
    if (z.subnetIds.length === 0) {
      passthrough.push(z);
      continue;
    }
    const tier = topologySubnetTierFromZone(z, subnetNameById);
    if (tier === "other" || tier === "vpcOnly") {
      passthrough.push(z);
      continue;
    }
    const key = `${z.accountId}\0${z.region}\0${z.vpcId}\0${tier}`;
    if (!byVpcTier.has(key)) {
      byVpcTier.set(key, []);
    }
    byVpcTier.get(key)!.push(z);
  }

  const mergedPrimary: TopologyPlacementZone[] = [];
  for (const [, group] of byVpcTier) {
    if (group.length < 2) {
      mergedPrimary.push(...group);
      continue;
    }
    const tier = topologySubnetTierFromZone(group[0]!, subnetNameById);
    const homogeneous = group.every((z) => {
      if (topologySubnetTierFromZone(z, subnetNameById) !== tier) {
        return false;
      }
      return z.subnetIds.every(
        (sid) => topologySubnetTierFromSubnetId(sid, subnetNameById) === tier,
      );
    });
    if (!homogeneous) {
      mergedPrimary.push(...group);
      continue;
    }
    const subnets = new Set<string>();
    const addresses = new Set<string>();
    for (const zz of group) {
      for (const sid of zz.subnetIds) {
        subnets.add(sid);
      }
      for (const addr of zz.addresses) {
        addresses.add(addr);
      }
    }
    const subnetIds = [...subnets].sort();
    const z0 = group[0]!;
    mergedPrimary.push({
      accountId: z0.accountId,
      region: z0.region,
      vpcId: z0.vpcId,
      subnetSignature: subnetIds.join("|"),
      subnetIds,
      addresses: [...addresses].sort(),
      topologyZoneSource: z0.topologyZoneSource ?? "primary",
      mergedPrimaryByTier: true,
    });
  }

  return [...mergedPrimary, ...passthrough].sort(sortPlacementZones);
}

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

/**
 * Re-run tier / route-table coalescing after {@link enrichTopologyPlacementsWithManagedResources}
 * may have appended per-subnet placement zones.
 */
export function reconcileTopologyPlacementZonesAfterEnrich(
  zones: TopologyPlacementZone[],
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): void {
  const reconciled = mergeSupplementarySubnetZonesByTier(
    mergeSupplementarySubnetZonesSharedRouteTable(
      mergePrimaryTopologyZonesByTier(
        zones.map((z) => ({
          ...z,
          topologyZoneSource: z.topologyZoneSource ?? "primary",
        })),
        plan,
      ).sort(sortTopologyPlacementZones),
      plan,
    ),
    plan,
  );
  zones.length = 0;
  zones.push(...reconciled);
}

/**
 * Merge supplementary `aws_subnet`-only zones in the same VPC that share a subnet tier
 * (public / intra / private), including when per-AZ route tables differ.
 */
export function mergeSupplementarySubnetZonesByTier(
  zones: readonly TopologyPlacementZone[],
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): TopologyPlacementZone[] {
  const subnetNameById = buildTopologySubnetNameMap(plan);
  const primary = zones.filter((z) => z.topologyZoneSource !== "supplementary");
  const supplementary = zones.filter(
    (z) => z.topologyZoneSource === "supplementary",
  );

  const tierEligible: TopologyPlacementZone[] = [];
  const passthroughSupp: TopologyPlacementZone[] = [];

  for (const z of supplementary) {
    if (!zoneAddressesAreAllAwsSubnet(z, plan)) {
      passthroughSupp.push(z);
      continue;
    }
    const tier = topologySubnetTierFromZone(z, subnetNameById);
    if (tier === "other" || tier === "vpcOnly") {
      passthroughSupp.push(z);
      continue;
    }
    tierEligible.push(z);
  }

  const byVpcTier = new Map<string, TopologyPlacementZone[]>();
  for (const z of tierEligible) {
    const tier = topologySubnetTierFromZone(z, subnetNameById);
    const key = `${z.accountId}\0${z.region}\0${z.vpcId}\0${tier}`;
    if (!byVpcTier.has(key)) {
      byVpcTier.set(key, []);
    }
    byVpcTier.get(key)!.push(z);
  }

  const mergedSupp: TopologyPlacementZone[] = [];
  for (const [, group] of byVpcTier) {
    if (group.length < 2) {
      mergedSupp.push(...group);
      continue;
    }
    const subnets = new Set<string>();
    for (const zz of group) {
      for (const sid of zz.subnetIds) {
        subnets.add(sid);
      }
    }
    const subnetIds = [...subnets].sort();
    const z0 = group[0]!;
    mergedSupp.push({
      accountId: z0.accountId,
      region: z0.region,
      vpcId: z0.vpcId,
      subnetSignature: subnetIds.join("|"),
      subnetIds,
      addresses: [],
      topologyZoneSource: "supplementary",
      mergedSupplementaryByTier: true,
    });
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
  routeTableIndexes?: RouteTablePlanIndexes,
): ReadonlySet<string> {
  const row = placements.vpcBottom.find(
    (x) =>
      x.accountId === accountId && x.region === regionName && x.vpcId === vpcId,
  );
  if (!row || row.addresses.length === 0) {
    return new Set();
  }
  const rtidToSubnets =
    routeTableIndexes?.rtidToSubnets ??
    buildRouteTableIdToSubnetIdsFromPlan(plan);
  const addrToMeta =
    routeTableIndexes?.addrToMeta ?? buildRouteTableAddressToMeta(plan);
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
  const securityGroupToVpc = buildSecurityGroupToVpcMapFromPlan(plan);
  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);

  const accum = new Map<
    string,
    { accountId: string; region: string; addresses: Set<string> }
  >();
  const tgwAddressToRegionalKey = new Map<string, string>();
  const tgwModulePrefixes: Array<{ prefix: string; key: string }> = [];

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

    let vpcId = resolveTopologyVpcId(
      t,
      values,
      subnetIds,
      subnetToVpc,
      securityGroupToVpc,
    );
    if (!vpcId && t === "aws_api_gateway_rest_api") {
      const vpcePlacement = resolveVpcPlacementFromPrivateRestApi(
        plan,
        values,
        subnetToVpc,
      );
      if (vpcePlacement) {
        vpcId = vpcePlacement.vpcId;
      }
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
    if (t === "aws_ec2_transit_gateway") {
      tgwAddressToRegionalKey.set(address, key);
      const pref = tgwModulePrefixForAddress(address);
      if (pref) {
        tgwModulePrefixes.push({ prefix: pref, key });
      }
    }
  }

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (
      rc.mode !== "managed" ||
      !rc.type ||
      !TGW_TOPOLOGY_SATELLITE_TYPES.has(rc.type)
    ) {
      continue;
    }
    const address = rc.address;
    if (!address || typeof address !== "string") {
      continue;
    }
    const parentTgw = resolveTransitGatewayCompanionParentFromPlan(
      rc as ResourceChange,
      changes,
    );
    if (parentTgw) {
      const regionalKey = tgwAddressToRegionalKey.get(parentTgw);
      if (regionalKey) {
        accum.get(regionalKey)?.addresses.add(address);
      }
      continue;
    }
    const prefix = tgwModulePrefixForAddress(address);
    const owner = tgwModulePrefixes.find((x) => x.prefix === prefix);
    if (owner) {
      accum.get(owner.key)?.addresses.add(address);
    }
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

/** One NAT gateway clustered with its paired EIP(s), scoped to a subnet zone. */
export type TopologyNatZoneCluster = {
  /** Address of the `aws_nat_gateway` primary. */
  natAddress: string;
  /** Paired `aws_eip` addresses (resolved by `allocation_id`); sorted for stability. */
  eipAddresses: string[];
};

/** NAT/EIP placements broken out of default plumbing into the owning public-subnet zone. */
export type TopologyNatZonePlacements = {
  /** `(account, region, vpcId, subnetSignature)` zone key → list of NAT clusters in that zone. */
  byZone: Map<string, TopologyNatZoneCluster[]>;
  /**
   * Plan addresses (NAT + paired EIP) successfully placed in a zone. Strip from
   * `vpcDefaultPlumbingBuckets` so the right-edge column does not double-render them.
   */
  consumedAddresses: Set<string>;
};

/**
 * Pair each `aws_nat_gateway` with the `aws_eip` referencing its `allocation_id`, and route the
 * pair into the placement zone whose `subnetIds` contains the NAT's `subnet_id`.
 *
 * NATs whose `subnet_id` does not land in any zone (e.g. plan has the NAT but the public subnet
 * is missing from the zone graph) are left **unconsumed** so they continue to fall through to
 * `vpcDefaultPlumbingBuckets` and render on the VPC right edge.
 */
export function computeNatGatewayZonePlacements(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
  zones: readonly TopologyPlacementZone[],
): TopologyNatZonePlacements {
  const empty: TopologyNatZonePlacements = {
    byZone: new Map(),
    consumedAddresses: new Set(),
  };
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  if (changes.length === 0 || zones.length === 0) {
    return empty;
  }

  /** EIP id / allocation_id → EIP address (either side of the join works). */
  const eipByJoinKey = new Map<string, string>();
  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_eip") {
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
    const id = stringField(values.id);
    const allocationId = stringField(values.allocation_id);
    if (id) {
      eipByJoinKey.set(id, address);
    }
    if (allocationId) {
      eipByJoinKey.set(allocationId, address);
    }
  }

  const subnetOwners = buildSubnetOwnerHintsFromPlan(plan);
  const subnetToVpc = buildSubnetToVpcMapFromPlan(plan);

  const byZone = new Map<string, TopologyNatZoneCluster[]>();
  const consumed = new Set<string>();

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_nat_gateway") {
      continue;
    }
    const natAddress = rc.address;
    if (!natAddress || typeof natAddress !== "string") {
      continue;
    }
    const values = pickResourceValuesForTopologyPlacement(rc as ResourceChange);
    if (!values) {
      continue;
    }
    const subnetId = stringField(values.subnet_id);
    if (!subnetId) {
      continue;
    }
    const vpcId =
      stringField(values.vpc_id) ?? subnetToVpc.get(subnetId) ?? null;
    if (!vpcId) {
      continue;
    }
    const merged = mergeWithDefaultAwsProviderAccountRegion(
      plan,
      mergeTerraformTopologyAccountRegionFromSameRegionSubnets(
        mergeTerraformTopologyAccountRegionFromSubnets(
          resolveTerraformTopologyAccountRegion(values),
          [subnetId],
          subnetOwners,
        ),
        subnetOwners,
      ),
    );
    const { account: accountId, region } = merged;
    if (!shouldEmitTopologyPlacement(accountId, region)) {
      continue;
    }

    const zone = zones.find(
      (z) =>
        z.accountId === accountId &&
        z.region === region &&
        z.vpcId === vpcId &&
        z.subnetIds.includes(subnetId),
    );
    if (!zone) {
      continue;
    }

    const eipAddresses: string[] = [];
    const allocationId = stringField(values.allocation_id);
    if (allocationId) {
      const eipAddr = eipByJoinKey.get(allocationId);
      if (eipAddr) {
        eipAddresses.push(eipAddr);
      }
    }

    const zk = zoneMapKey(accountId, region, vpcId, zone.subnetSignature);
    let bucket = byZone.get(zk);
    if (!bucket) {
      bucket = [];
      byZone.set(zk, bucket);
    }
    bucket.push({
      natAddress,
      eipAddresses: [...new Set(eipAddresses)].sort(),
    });

    consumed.add(natAddress);
    for (const eipAddr of eipAddresses) {
      consumed.add(eipAddr);
    }
  }

  for (const list of byZone.values()) {
    list.sort((a, b) => a.natAddress.localeCompare(b.natAddress));
  }

  return { byZone, consumedAddresses: consumed };
}

/** Read-only zone lookup key for `TopologyNatZonePlacements.byZone`. */
export function natZonePlacementsKey(
  accountId: string,
  region: string,
  vpcId: string,
  subnetSignature: string,
): string {
  return zoneMapKey(accountId, region, vpcId, subnetSignature);
}

/**
 * Subnet IDs not covered by any primary zone’s subnet multiset (e.g. intra subnets).
 * Emits structural placement zones only — `addresses` stay empty; subnets are not graph resources.
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
    }
  >();

  for (const rc of changes) {
    if (!isAwsTerraformResourceChange(rc)) {
      continue;
    }
    if (rc.mode !== "managed" || rc.type !== "aws_subnet") {
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
      };
      accum.set(key, row);
    }
  }

  const out: TopologyPlacementZone[] = [...accum.values()].map((row) => ({
    accountId: row.accountId,
    region: row.region,
    vpcId: row.vpcId,
    subnetSignature: row.subnetSignature,
    subnetIds: row.subnetIds,
    addresses: [],
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

const VPC_FLOW_LOGS_MODULE_MARKER = ".module.vpc_flow_logs";

/**
 * Full Terraform submodule prefix for `modules/vpc_flow_logs` resources, e.g.
 * `module.east_network.module.vpc_flow_logs` (stack prefix stripped).
 */
export function vpcFlowLogsModulePrefixForAddress(
  address: string,
): string | null {
  const bare = stripStackPrefixForModuleParsing(address);
  const markerIdx = bare.indexOf(VPC_FLOW_LOGS_MODULE_MARKER);
  if (markerIdx === -1) {
    return null;
  }
  return bare.slice(0, markerIdx + VPC_FLOW_LOGS_MODULE_MARKER.length);
}

/** Module prefix for a VPC flow log bundle (nested `vpc_flow_logs` or inline `aws_flow_log`). */
export function flowLogModuleBundlePrefixForAddress(
  address: string,
): string | null {
  const nested = vpcFlowLogsModulePrefixForAddress(address);
  if (nested) {
    return nested;
  }
  const bare = stripStackPrefixForModuleParsing(address);
  const parts = bare.split(".");
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]!.startsWith("aws_flow_log")) {
      return parts.slice(0, i).join(".");
    }
  }
  return null;
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
    const flowModulePrefix = flowLogModuleBundlePrefixForAddress(address);
    if (!flowModulePrefix) {
      continue;
    }
    flowRows.push({
      address,
      modulePrefix: flowModulePrefix,
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
    const pref =
      flowLogModuleBundlePrefixForAddress(addr) ||
      terraformModulePrefixForAddress(stripStackPrefixForModuleParsing(addr));
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
