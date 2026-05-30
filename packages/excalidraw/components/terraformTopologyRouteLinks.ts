/**
 * Semantic topology: `aws_route` ↔ `aws_route_table` linking and human labels.
 */

import {
  buildSubnetOwnerHintsFromPlan,
  isAwsTerraformResourceChange,
  mergeTerraformTopologyAccountRegionFromSameRegionSubnets,
  mergeTerraformTopologyAccountRegionFromSubnets,
  mergeWithDefaultAwsProviderAccountRegion,
  pickResourceValuesForTopologyPlacement,
  type TerraformPlanProviderContext,
  resolveTerraformTopologyAccountRegion,
  shouldEmitTopologyPlacement,
} from "./terraformTopologyExtract";
import type { ResourceChange } from "./terraformTopologyExtract";

function stringField(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function isRouteTableId(id: string): boolean {
  return id.startsWith("rtb-");
}

/** `for_each` instance key on `aws_route.*["rtb-…"]`. */
function routeTableIdFromAddress(address: string): string | null {
  const m = address.match(/\["(rtb-[^"]+)"\]/);
  return m?.[1] ?? null;
}

export type RouteTableIdIndexEntry = {
  tableAddress: string;
  accountId: string;
  region: string;
  vpcId: string;
};

export function buildRouteTableIdIndexFromPlan(
  plan: TerraformPlanProviderContext & {
    resource_changes?: ResourceChange[];
  },
): Map<string, RouteTableIdIndexEntry> {
  const out = new Map<string, RouteTableIdIndexEntry>();
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
    if (!vpcIdRaw || !rtbId || !isRouteTableId(rtbId)) {
      continue;
    }
    const subnetIds = collectPlacementSubnetIdsFromValues(values);
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
    out.set(rtbId, {
      tableAddress: address,
      accountId,
      region,
      vpcId: vpcIdRaw,
    });
  }
  return out;
}

function collectPlacementSubnetIdsFromValues(
  values: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.startsWith("subnet-")) {
      out.push(v);
    }
  };
  push(values.subnet_id);
  const assoc = values.associations;
  if (Array.isArray(assoc)) {
    for (const item of assoc) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        push((item as Record<string, unknown>).subnet_id);
      }
    }
  }
  return out;
}

export function resolveRouteTableIdForRoute(
  rc: ResourceChange & { address?: string; type?: string },
): string | null {
  if (!rc.address || typeof rc.address !== "string") {
    return null;
  }
  const values = pickResourceValuesForTopologyPlacement(rc);
  if (values) {
    const rtid = stringField(values.route_table_id);
    if (rtid && isRouteTableId(rtid)) {
      return rtid;
    }
  }
  const fromKey = routeTableIdFromAddress(rc.address);
  if (fromKey && isRouteTableId(fromKey)) {
    return fromKey;
  }
  return null;
}

/** `aws_route` addresses keyed by route table id (`rtb-*`). */
export function buildRouteTableIdToRouteAddressesFromPlan(
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
    const rtid = resolveRouteTableIdForRoute(rc as ResourceChange);
    if (!rtid) {
      continue;
    }
    if (!out.has(rtid)) {
      out.set(rtid, new Set());
    }
    out.get(rtid)!.add(address);
  }
  return out;
}

function collectValueBagsFromResource(
  resource: Record<string, unknown> | null | undefined,
): Record<string, unknown>[] {
  if (!resource || typeof resource !== "object") {
    return [];
  }
  const out: Record<string, unknown>[] = [];
  const change = resource.change as
    | { after?: unknown; before?: unknown }
    | undefined;
  for (const bag of [change?.after, resource.values, change?.before]) {
    if (bag && typeof bag === "object" && !Array.isArray(bag)) {
      out.push(bag as Record<string, unknown>);
    }
  }
  return out;
}

function nextHopLabel(values: Record<string, unknown>): string {
  const igw = stringField(values.gateway_id);
  if (igw?.startsWith("igw-")) {
    return "IGW";
  }
  if (stringField(values.nat_gateway_id)) {
    return "NAT";
  }
  if (stringField(values.transit_gateway_id)) {
    return "TGW";
  }
  if (stringField(values.vpc_peering_connection_id)) {
    return "Peering";
  }
  if (stringField(values.egress_only_gateway_id)) {
    return "EIGW";
  }
  if (stringField(values.carrier_gateway_id)) {
    return "Carrier";
  }
  if (stringField(values.network_interface_id)) {
    return "ENI";
  }
  const gw = stringField(values.gateway_id);
  if (gw) {
    return gw.length > 12 ? `${gw.slice(0, 9)}…` : gw;
  }
  return "local";
}

/** Short label: `10.0.0.0/16 → TGW` from plan attribute bags. */
export function formatAwsRouteSemanticLabel(
  values: Record<string, unknown>,
): string | null {
  const dest =
    stringField(values.destination_cidr_block) ??
    stringField(values.destination_ipv6_cidr_block);
  if (!dest) {
    return null;
  }
  const hop = nextHopLabel(values);
  const label = `${dest} → ${hop}`;
  return label.length > 52 ? `${label.slice(0, 49)}…` : label;
}

export function formatAwsRouteSemanticLabelFromPlanResource(
  resource: Record<string, unknown> | null | undefined,
): string | null {
  for (const bag of collectValueBagsFromResource(resource)) {
    const label = formatAwsRouteSemanticLabel(bag);
    if (label) {
      return label;
    }
  }
  return null;
}
