/**
 * Semantic topology: `aws_ec2_transit_gateway` (regional primary) with attachments,
 * peering accepters, static routes, and optional custom route tables as satellites.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  canonicalTopologyNodeKey,
  topologyAddressesMatch,
  topologyBareAddressKey,
} from "./terraformTopologyAddress";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import {
  mergeTerraformPlanResourceValues,
  terraformModulePrefixForAddress,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import { pickResourceValuesForTopologyPlacement } from "./terraformTopologyExtract";
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";
import { stripStackPrefixForModuleParsing } from "./terraformStackAddress";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function candidatesForTypes(
  nodesByType: ReadonlyMap<string, readonly string[]> | undefined,
  types: ReadonlySet<string>,
  nodes: TerraformPlanNodesMap,
): readonly string[] {
  if (!nodesByType) {
    recordNodesByTypeFallbackScan();
    return Object.keys(nodes);
  }
  const out: string[] = [];
  for (const t of types) {
    out.push(...(nodesByType.get(t) ?? []));
  }
  return out;
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function flattenStringish(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenStringish(item, out);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      flattenStringish(v, out);
    }
  }
}

type PlanRc = Parameters<typeof pickResourceValuesForTopologyPlacement>[0];

/** Types drawn only under `aws_ec2_transit_gateway` when cluster resolution succeeds. */
export const TGW_TOPOLOGY_SATELLITE_TYPES = new Set([
  "aws_ec2_transit_gateway_vpc_attachment",
  "aws_ec2_transit_gateway_peering_attachment",
  "aws_ec2_transit_gateway_peering_attachment_accepter",
  "aws_ec2_transit_gateway_connect_attachment",
  "aws_ec2_transit_gateway_vpn_attachment",
  "aws_ec2_transit_gateway_route",
  "aws_ec2_transit_gateway_route_table",
  "aws_ec2_transit_gateway_route_table_association",
  "aws_ec2_transit_gateway_route_table_propagation",
]);

export function isTgwTopologySatelliteResourceType(
  resourceType: string,
): boolean {
  return TGW_TOPOLOGY_SATELLITE_TYPES.has(resourceType);
}

function refMatchesAddress(ref: string, address: string, id: string): boolean {
  const t = ref.trim();
  const stripT = stripIndexes(t);
  const stripAddr = stripIndexes(address);
  return (
    t === address ||
    stripT === stripAddr ||
    t === stripAddr ||
    stripT === address ||
    (id.length > 0 && (t === id || stripT === id))
  );
}

function findTransitGatewayAddressForPlanRef(
  ref: string,
  changes: readonly PlanRc[],
): string | null {
  const t = ref.trim();
  if (!t) {
    return null;
  }
  for (const rc of changes) {
    if (
      rc.type !== "aws_ec2_transit_gateway" ||
      typeof rc.address !== "string"
    ) {
      continue;
    }
    const addr = rc.address;
    const pv = pickResourceValuesForTopologyPlacement(rc);
    const id = typeof pv?.id === "string" ? pv.id : "";
    if (refMatchesAddress(t, addr, id)) {
      return addr;
    }
  }
  return null;
}

const TGW_ATTACHMENT_TYPES = new Set([
  "aws_ec2_transit_gateway_vpc_attachment",
  "aws_ec2_transit_gateway_peering_attachment",
  "aws_ec2_transit_gateway_connect_attachment",
  "aws_ec2_transit_gateway_vpn_attachment",
]);

function findAttachmentAddressForPlanRef(
  ref: string,
  changes: readonly PlanRc[],
): string | null {
  const t = ref.trim();
  if (!t) {
    return null;
  }
  for (const rc of changes) {
    if (
      !rc.type ||
      !TGW_ATTACHMENT_TYPES.has(rc.type) ||
      typeof rc.address !== "string"
    ) {
      continue;
    }
    const addr = rc.address;
    const pv = pickResourceValuesForTopologyPlacement(rc);
    const id = typeof pv?.id === "string" ? pv.id : "";
    if (refMatchesAddress(t, addr, id)) {
      return addr;
    }
  }
  return null;
}

function findRouteTableOwnerTgwAddress(
  routeTableRef: string,
  changes: readonly PlanRc[],
): string | null {
  const refs = [routeTableRef.trim()].filter(Boolean);
  if (refs.length === 0) {
    return null;
  }

  for (const rc of changes) {
    if (
      rc.type !== "aws_ec2_transit_gateway_route_table" ||
      typeof rc.address !== "string"
    ) {
      continue;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (!pv) {
      continue;
    }
    const id = typeof pv.id === "string" ? pv.id : "";
    const rtAddr = rc.address;
    if (!refs.some((r) => refMatchesAddress(r, rtAddr, id))) {
      continue;
    }
    const tgwRefs: string[] = [];
    flattenStringish(pv.transit_gateway_id, tgwRefs);
    for (const raw of tgwRefs) {
      const parent = findTransitGatewayAddressForPlanRef(raw, changes);
      if (parent) {
        return parent;
      }
    }
  }

  for (const rc of changes) {
    if (
      rc.type !== "aws_ec2_transit_gateway" ||
      typeof rc.address !== "string"
    ) {
      continue;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (!pv) {
      continue;
    }
    const defaultRt =
      typeof pv.association_default_route_table_id === "string"
        ? pv.association_default_route_table_id
        : typeof pv.propagation_default_route_table_id === "string"
        ? pv.propagation_default_route_table_id
        : "";
    const tgwAddr = rc.address;
    if (
      defaultRt &&
      refs.some((r) => refMatchesAddress(r, tgwAddr, defaultRt))
    ) {
      return tgwAddr;
    }
  }

  return null;
}

/** Resolve a TGW satellite resource to its parent `aws_ec2_transit_gateway` address. */
export function resolveTransitGatewayCompanionParentFromPlan(
  companionRc: PlanRc,
  changes: readonly PlanRc[],
): string | null {
  const t = companionRc.type;
  if (!t || !companionRc.address || !TGW_TOPOLOGY_SATELLITE_TYPES.has(t)) {
    return null;
  }
  const pv = pickResourceValuesForTopologyPlacement(companionRc);
  if (!pv) {
    return null;
  }

  if (
    t === "aws_ec2_transit_gateway_vpc_attachment" ||
    t === "aws_ec2_transit_gateway_peering_attachment" ||
    t === "aws_ec2_transit_gateway_connect_attachment" ||
    t === "aws_ec2_transit_gateway_vpn_attachment"
  ) {
    const refs: string[] = [];
    flattenStringish(pv.transit_gateway_id, refs);
    for (const raw of refs) {
      const parent = findTransitGatewayAddressForPlanRef(raw, changes);
      if (parent) {
        return parent;
      }
    }
    return null;
  }

  if (t === "aws_ec2_transit_gateway_peering_attachment_accepter") {
    const refs: string[] = [];
    flattenStringish(pv.transit_gateway_attachment_id, refs);
    for (const raw of refs) {
      const att = findAttachmentAddressForPlanRef(raw, changes);
      if (!att) {
        continue;
      }
      const attRc = changes.find((r) => r.address === att);
      if (!attRc) {
        continue;
      }
      return resolveTransitGatewayCompanionParentFromPlan(attRc, changes);
    }
    return null;
  }

  if (t === "aws_ec2_transit_gateway_route_table") {
    const refs: string[] = [];
    flattenStringish(pv.transit_gateway_id, refs);
    for (const raw of refs) {
      const parent = findTransitGatewayAddressForPlanRef(raw, changes);
      if (parent) {
        return parent;
      }
    }
    return null;
  }

  if (t === "aws_ec2_transit_gateway_route") {
    const rtRefs: string[] = [];
    flattenStringish(pv.transit_gateway_route_table_id, rtRefs);
    for (const raw of rtRefs) {
      const parent = findRouteTableOwnerTgwAddress(raw, changes);
      if (parent) {
        return parent;
      }
    }
    return null;
  }

  if (
    t === "aws_ec2_transit_gateway_route_table_association" ||
    t === "aws_ec2_transit_gateway_route_table_propagation"
  ) {
    const rtRefs: string[] = [];
    flattenStringish(pv.transit_gateway_route_table_id, rtRefs);
    for (const raw of rtRefs) {
      const parent = findRouteTableOwnerTgwAddress(raw, changes);
      if (parent) {
        return parent;
      }
    }
  }

  return null;
}

function resolveTransitGatewayIdToPath(
  nodes: TerraformPlanNodesMap,
  ref: unknown,
  changes?: readonly PlanRc[],
): string | null {
  const refs: string[] = [];
  flattenStringish(ref, refs);
  for (const raw of refs) {
    if (changes) {
      const fromPlan = findTransitGatewayAddressForPlanRef(raw, changes);
      if (fromPlan) {
        return canonicalTopologyNodeKey(nodes, fromPlan);
      }
    }
    const key = resolveTerraformPlanNodeKey(
      nodes as Record<string, TerraformPlanGraphNode>,
      raw,
    );
    if (key) {
      const pr = getPrimaryResource(nodes[key] as TerraformPlanGraphNode);
      if (pr?.type === "aws_ec2_transit_gateway") {
        return canonicalTopologyNodeKey(nodes, key);
      }
    }
  }
  return null;
}

function resolveAttachmentIdToPath(
  nodes: TerraformPlanNodesMap,
  ref: unknown,
  changes?: readonly PlanRc[],
): string | null {
  const refs: string[] = [];
  flattenStringish(ref, refs);
  for (const raw of refs) {
    if (changes) {
      const fromPlan = findAttachmentAddressForPlanRef(raw, changes);
      if (fromPlan) {
        return canonicalTopologyNodeKey(nodes, fromPlan);
      }
    }
    const key = resolveTerraformPlanNodeKey(
      nodes as Record<string, TerraformPlanGraphNode>,
      raw,
    );
    if (key) {
      const pr = getPrimaryResource(nodes[key] as TerraformPlanGraphNode);
      const t = typeof pr?.type === "string" ? pr.type : "";
      if (t.includes("transit_gateway") && t.includes("attachment")) {
        return canonicalTopologyNodeKey(nodes, key);
      }
    }
  }
  return null;
}

export type TgwPeeringCluster = {
  peering: string;
  accepter: string | null;
  routes: string[];
};

export type TransitGatewayCompanionCluster = {
  transitGateway: string;
  vpcAttachments: string[];
  peering: TgwPeeringCluster[];
  routeTables: string[];
  standaloneRoutes: string[];
};

export function transitGatewayCompanionSatellitePaths(
  cluster: TransitGatewayCompanionCluster,
): string[] {
  const out: string[] = [
    ...cluster.vpcAttachments,
    ...cluster.routeTables,
    ...cluster.standaloneRoutes,
  ];
  for (const p of cluster.peering) {
    out.push(p.peering);
    if (p.accepter) {
      out.push(p.accepter);
    }
    out.push(...p.routes);
  }
  return out;
}

export function buildTransitGatewayCompanionCluster(
  nodes: TerraformPlanNodesMap,
  tgwAddress: string,
  planChanges?: readonly PlanRc[],
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): {
  cluster: TransitGatewayCompanionCluster | null;
  edges: TopologyIamEdge[];
} {
  const canonicalTgw = canonicalTopologyNodeKey(nodes, tgwAddress);
  const tgwNode = nodes[canonicalTgw] as TerraformPlanGraphNode | undefined;
  const tgwPrimary = getPrimaryResource(tgwNode);
  if (!tgwPrimary || tgwPrimary.type !== "aws_ec2_transit_gateway") {
    return { cluster: null, edges: [] };
  }

  const vpcAttachments: string[] = [];
  const peeringByPath = new Map<string, TgwPeeringCluster>();
  const routeTables: string[] = [];
  const standaloneRoutes: string[] = [];
  const attachmentKind = new Map<string, "vpc" | "peering" | "other">();
  const pendingAccepters: Array<{
    path: string;
    values: Record<string, unknown>;
  }> = [];

  for (const path of candidatesForTypes(nodesByType, TGW_TOPOLOGY_SATELLITE_TYPES, nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    if (!TGW_TOPOLOGY_SATELLITE_TYPES.has(t)) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(p);
    const parent = resolveTransitGatewayIdToPath(
      nodes,
      values.transit_gateway_id,
      planChanges,
    );
    const planRc =
      planChanges?.find(
        (r) =>
          r.address === path ||
          stripIndexes(r.address ?? "") === stripIndexes(path),
      ) ?? ({ type: t, address: path } as PlanRc);
    const parentFromPlan =
      planChanges && !parent
        ? resolveTransitGatewayCompanionParentFromPlan(planRc, planChanges)
        : null;
    const resolvedParent = parent
      ? parent
      : parentFromPlan
      ? canonicalTopologyNodeKey(nodes, parentFromPlan)
      : null;
    if (
      !resolvedParent ||
      !topologyAddressesMatch(resolvedParent, canonicalTgw)
    ) {
      if (t === "aws_ec2_transit_gateway_route") {
        const rtRefs: string[] = [];
        flattenStringish(values.transit_gateway_route_table_id, rtRefs);
        for (const raw of rtRefs) {
          const rtOwner =
            planChanges && findRouteTableOwnerTgwAddress(raw, planChanges);
          if (
            rtOwner &&
            topologyAddressesMatch(
              canonicalTopologyNodeKey(nodes, rtOwner),
              canonicalTgw,
            )
          ) {
            standaloneRoutes.push(canonicalTopologyNodeKey(nodes, path));
          }
        }
      }
      continue;
    }

    const canonicalPath = canonicalTopologyNodeKey(nodes, path);

    if (t === "aws_ec2_transit_gateway_vpc_attachment") {
      vpcAttachments.push(canonicalPath);
      attachmentKind.set(canonicalPath, "vpc");
      continue;
    }
    if (t === "aws_ec2_transit_gateway_peering_attachment") {
      peeringByPath.set(canonicalPath, {
        peering: canonicalPath,
        accepter: null,
        routes: [],
      });
      attachmentKind.set(canonicalPath, "peering");
      continue;
    }
    if (
      t === "aws_ec2_transit_gateway_connect_attachment" ||
      t === "aws_ec2_transit_gateway_vpn_attachment"
    ) {
      vpcAttachments.push(canonicalPath);
      attachmentKind.set(canonicalPath, "other");
      continue;
    }
    if (t === "aws_ec2_transit_gateway_route_table") {
      routeTables.push(canonicalPath);
      continue;
    }
    if (t === "aws_ec2_transit_gateway_route") {
      const attRef = resolveAttachmentIdToPath(
        nodes,
        values.transit_gateway_attachment_id,
        planChanges,
      );
      if (attRef && attachmentKind.get(attRef) === "peering") {
        const peering = peeringByPath.get(attRef);
        if (peering) {
          peering.routes.push(canonicalPath);
        }
      } else {
        standaloneRoutes.push(canonicalPath);
      }
      continue;
    }
    if (t === "aws_ec2_transit_gateway_peering_attachment_accepter") {
      pendingAccepters.push({ path: canonicalPath, values });
    }
  }

  for (const { path: canonicalPath, values } of pendingAccepters) {
    const attRef = resolveAttachmentIdToPath(
      nodes,
      values.transit_gateway_attachment_id,
      planChanges,
    );
    if (attRef && peeringByPath.has(attRef)) {
      peeringByPath.get(attRef)!.accepter = canonicalPath;
    }
  }

  vpcAttachments.sort((a, b) => a.localeCompare(b));
  routeTables.sort((a, b) => a.localeCompare(b));
  standaloneRoutes.sort((a, b) => a.localeCompare(b));
  const peering = [...peeringByPath.values()].sort((a, b) =>
    a.peering.localeCompare(b.peering),
  );
  for (const p of peering) {
    p.routes.sort((a, b) => a.localeCompare(b));
  }

  if (
    vpcAttachments.length === 0 &&
    peering.length === 0 &&
    routeTables.length === 0 &&
    standaloneRoutes.length === 0
  ) {
    return { cluster: null, edges: [] };
  }

  const cluster: TransitGatewayCompanionCluster = {
    transitGateway: canonicalTgw,
    vpcAttachments,
    peering,
    routeTables,
    standaloneRoutes,
  };

  const edges: TopologyIamEdge[] = [];
  for (const vpc of vpcAttachments) {
    edges.push({
      source: canonicalTgw,
      target: vpc,
      type: "tgw_vpc_attachment",
      label: "VPC attachment",
    });
  }
  for (const p of peering) {
    edges.push({
      source: canonicalTgw,
      target: p.peering,
      type: "tgw_peering",
      label: "peering",
    });
    if (p.accepter) {
      edges.push({
        source: p.peering,
        target: p.accepter,
        type: "tgw_peering_accepter",
        label: "accepter",
      });
    }
    for (const route of p.routes) {
      edges.push({
        source: p.peering,
        target: route,
        type: "tgw_route",
        label: "route",
      });
    }
  }
  for (const rt of routeTables) {
    edges.push({
      source: canonicalTgw,
      target: rt,
      type: "tgw_route_table",
      label: "route table",
    });
  }
  for (const route of standaloneRoutes) {
    edges.push({
      source: canonicalTgw,
      target: route,
      type: "tgw_route",
      label: "route",
    });
  }

  return { cluster, edges };
}

export function transitGatewaySatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  tgwAddress: string,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
  satelliteGap: number,
  planChanges?: readonly PlanRc[],
): number {
  const { cluster } = buildTransitGatewayCompanionCluster(
    nodes,
    tgwAddress,
    planChanges,
  );
  if (!cluster) {
    return 0;
  }
  let h = 0;
  const addTier1 = () => {
    h += (h > 0 ? satelliteGap : 0) + tier1SatelliteH;
  };
  const addTier2 = () => {
    h += satelliteGap + tier2SatelliteH;
  };
  for (let i = 0; i < cluster.vpcAttachments.length; i++) {
    addTier1();
  }
  for (const p of cluster.peering) {
    addTier1();
    if (p.accepter) {
      addTier2();
    }
    for (let j = 0; j < p.routes.length; j++) {
      addTier2();
    }
  }
  for (let i = 0; i < cluster.routeTables.length; i++) {
    addTier1();
  }
  for (let i = 0; i < cluster.standaloneRoutes.length; i++) {
    addTier2();
  }
  return h > 0 ? h + satelliteGap : 0;
}

export function collectTransitGatewayClusterSatelliteAddressesForTopologyList(
  nodes: TerraformPlanNodesMap,
  addresses: readonly string[],
  planChanges?: readonly PlanRc[],
): Set<string> {
  const consumed = new Set<string>();
  for (const addr of addresses) {
    const n = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_ec2_transit_gateway") {
      continue;
    }
    const { cluster } = buildTransitGatewayCompanionCluster(
      nodes,
      addr,
      planChanges,
    );
    if (cluster) {
      for (const s of transitGatewayCompanionSatellitePaths(cluster)) {
        consumed.add(s);
      }
    }
  }
  return consumed;
}

export function filterTopologyAddressesExcludingTgwSatellites(
  nodes: TerraformPlanNodesMap,
  addresses: readonly string[],
  planChanges?: readonly PlanRc[],
): string[] {
  const consumed =
    collectTransitGatewayClusterSatelliteAddressesForTopologyList(
      nodes,
      addresses,
      planChanges,
    );
  return [...addresses].filter((a) => !consumed.has(a));
}

export function isTgwCompanionConsumedAsSatellite(
  nodes: TerraformPlanNodesMap,
  address: string,
  planChanges?: readonly PlanRc[],
): boolean {
  const targetBare = topologyBareAddressKey(address);
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const pr = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!pr || pr.type !== "aws_ec2_transit_gateway") {
      continue;
    }
    const { cluster } = buildTransitGatewayCompanionCluster(
      nodes,
      path,
      planChanges,
    );
    if (
      cluster &&
      transitGatewayCompanionSatellitePaths(cluster).some(
        (s) => topologyBareAddressKey(s) === targetBare,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Module-prefix fallback when plan refs are address strings (same stack module as TGW). */
export function collectTgwModulePrefixKeysForAddress(
  address: string,
): string[] {
  const bare = stripStackPrefixForModuleParsing(address);
  const parts = bare.split(".");
  const keys: string[] = [];
  for (let i = 0; i < parts.length - 1; ) {
    if (parts[i] !== "module" || !parts[i + 1]) {
      break;
    }
    keys.push(parts.slice(0, i + 2).join("."));
    i += 2;
  }
  return keys;
}

export function tgwModulePrefixForAddress(address: string): string {
  return terraformModulePrefixForAddress(
    stripStackPrefixForModuleParsing(address),
  );
}
