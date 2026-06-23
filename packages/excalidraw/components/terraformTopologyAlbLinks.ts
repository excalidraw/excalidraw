/**
 * Semantic topology: stack `aws_lb_listener`, `aws_lb_target_group`, and
 * `aws_lb_target_group_attachment` under their `aws_lb` (tier-0) like S3 companions.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  canonicalTopologyNodeKey,
  dedupeTopologyAddressesByBareKey,
  topologyAddressesMatch,
  topologyBareAddressKey,
} from "./terraformTopologyAddress";
import {
  parseStackAddress,
  prefixStackAddress,
  stripStackPrefixForModuleParsing,
} from "./terraformStackAddress";
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
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";
import { pickResourceValuesForTopologyPlacement } from "./terraformTopologyExtract";
import { buildLoadBalancerSgCluster } from "./terraformTopologySgLinks";

type PlanRc = Parameters<typeof pickResourceValuesForTopologyPlacement>[0];

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

const LISTENER_TYPES = new Set(["aws_lb_listener", "aws_alb_listener"]);
const TARGET_GROUP_TYPES = new Set([
  "aws_lb_target_group",
  "aws_alb_target_group",
]);
const ATTACHMENT_TYPES = new Set([
  "aws_lb_target_group_attachment",
  "aws_alb_target_group_attachment",
]);

/** Types drawn only under `aws_lb` when cluster resolution succeeds. */
export const ALB_TOPOLOGY_SATELLITE_TYPES = new Set([
  ...LISTENER_TYPES,
  ...TARGET_GROUP_TYPES,
  ...ATTACHMENT_TYPES,
]);

export function isAlbTopologySatelliteResourceType(
  resourceType: string,
): boolean {
  return ALB_TOPOLOGY_SATELLITE_TYPES.has(resourceType);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function getResourceType(
  path: string,
  node: TerraformPlanGraphNode | undefined,
): string {
  const primary = getPrimaryResource(node);
  const t = primary?.type;
  if (typeof t === "string") {
    return t;
  }
  const parts = path.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (i < parts.length && parts[i] === "data") {
    return typeof parts[i + 1] === "string" ? String(parts[i + 1]) : "";
  }
  return typeof parts[i] === "string" ? String(parts[i]) : "";
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

/**
 * Candidate paths for a single type: indexed lookup if available, else the full scan. A
 * missing bucket (no nodes of that type) is a correct empty result, not a fallback.
 */
function candidatesForType(
  nodesByType: ReadonlyMap<string, readonly string[]> | undefined,
  type: string,
  nodes: TerraformPlanNodesMap,
): readonly string[] {
  if (!nodesByType) {
    recordNodesByTypeFallbackScan();
    return Object.keys(nodes);
  }
  return nodesByType.get(type) ?? [];
}

/** Candidate paths for a union of types — used when a scan filters by a Set of types. */
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

function isAwsLbNode(nodes: TerraformPlanNodesMap, path: string): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_lb";
}

export {
  canonicalTopologyNodeKey,
  topologyBareAddressKey,
} from "./terraformTopologyAddress";

/**
 * Resolve `load_balancer_arn` / LB ARN strings to a `nodes` key for `aws_lb`.
 */
export function resolveLoadBalancerArnToLbPath(
  nodes: TerraformPlanNodesMap,
  lbArnField: unknown,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(lbArnField, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    const byStrip = resolveTerraformPlanNodeKey(graphNodes, stripIndexes(s));
    if (byStrip && isAwsLbNode(nodes, byStrip)) {
      return byStrip;
    }
    const byFull = resolveTerraformPlanNodeKey(graphNodes, s);
    if (byFull && isAwsLbNode(nodes, byFull)) {
      return byFull;
    }
    const byArn = arnIndex.get(s);
    if (byArn && isAwsLbNode(nodes, byArn)) {
      return byArn;
    }
  }

  for (const path of candidatesForType(nodesByType, "aws_lb", nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!primary || primary.type !== "aws_lb") {
      continue;
    }
    const v = mergeTerraformPlanResourceValues(primary);
    if (typeof v.arn === "string" && strings.some((x) => x === v.arn)) {
      return path;
    }
  }

  return null;
}

function planRefMatchesResourceAddress(
  ref: string,
  resourceAddress: string,
): boolean {
  const t = ref.trim();
  const addr = resourceAddress.trim();
  if (!t || !addr) {
    return false;
  }
  const stripT = stripIndexes(t);
  const stripAddr = stripIndexes(addr);
  if (
    t === addr ||
    stripT === stripAddr ||
    t === stripAddr ||
    stripT === addr
  ) {
    return true;
  }
  const bareAddr = parseStackAddress(addr)?.address ?? addr;
  const stripBare = stripIndexes(bareAddr);
  return (
    t === bareAddr ||
    stripT === stripBare ||
    t === stripBare ||
    stripT === bareAddr
  );
}

function collectStackIdsFromPlanChanges(changes: readonly PlanRc[]): string[] {
  const stackIds = new Set<string>();
  for (const rc of changes) {
    if (typeof rc.address !== "string") {
      continue;
    }
    const parsed = parseStackAddress(rc.address);
    if (parsed) {
      stackIds.add(parsed.stackId);
    }
  }
  return [...stackIds];
}

function findAwsLbAddressForPlanRef(
  ref: string,
  changes: readonly PlanRc[],
): string | null {
  const t = ref.trim();
  if (!t) {
    return null;
  }
  if (t.endsWith(".arn")) {
    const withoutArn = findAwsLbAddressForPlanRef(t.slice(0, -4), changes);
    if (withoutArn) {
      return withoutArn;
    }
  }
  for (const rc of changes) {
    if (rc.type !== "aws_lb" || !rc.address) {
      continue;
    }
    if (planRefMatchesResourceAddress(t, rc.address)) {
      return rc.address;
    }
    const lv = pickResourceValuesForTopologyPlacement(rc);
    if (!lv) {
      continue;
    }
    const arn = typeof lv.arn === "string" ? lv.arn : "";
    if (arn && t === arn) {
      return rc.address;
    }
  }
  if (!t.includes("::")) {
    const stackIds = collectStackIdsFromPlanChanges(changes);
    const qualifiedMatches: string[] = [];
    for (const stackId of stackIds) {
      const qualified = prefixStackAddress(stackId, stripIndexes(t));
      for (const rc of changes) {
        if (rc.type === "aws_lb" && rc.address === qualified) {
          qualifiedMatches.push(qualified);
        }
      }
    }
    const unique = [...new Set(qualifiedMatches)];
    if (unique.length === 1) {
      return unique[0]!;
    }
  }
  return null;
}

function findTargetGroupAddressForPlanRef(
  ref: string,
  changes: readonly PlanRc[],
): string | null {
  const t = ref.trim();
  if (!t) {
    return null;
  }
  for (const rc of changes) {
    if (!rc.type || !TARGET_GROUP_TYPES.has(rc.type) || !rc.address) {
      continue;
    }
    if (planRefMatchesResourceAddress(t, rc.address)) {
      return rc.address;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (!pv) {
      continue;
    }
    const arn = typeof pv.arn === "string" ? pv.arn : "";
    const name = typeof pv.name === "string" ? pv.name : "";
    const namePrefix = typeof pv.name_prefix === "string" ? pv.name_prefix : "";
    if (arn && t === arn) {
      return rc.address;
    }
    if (name && t === name) {
      return rc.address;
    }
    if (namePrefix && t.includes(namePrefix)) {
      return rc.address;
    }
  }
  if (!t.includes("::")) {
    const stackIds = collectStackIdsFromPlanChanges(changes);
    const qualifiedMatches: string[] = [];
    for (const stackId of stackIds) {
      const qualified = prefixStackAddress(stackId, stripIndexes(t));
      for (const rc of changes) {
        if (
          rc.type &&
          TARGET_GROUP_TYPES.has(rc.type) &&
          rc.address === qualified
        ) {
          qualifiedMatches.push(qualified);
        }
      }
    }
    const unique = [...new Set(qualifiedMatches)];
    if (unique.length === 1) {
      return unique[0]!;
    }
  }
  return null;
}

function listenerPlanValuesForwardToTargetGroup(
  listenerValues: Record<string, unknown>,
  tgAddress: string,
  tgArn: string,
  changes: readonly PlanRc[],
): boolean {
  for (const act of normalizeDefaultActions(listenerValues)) {
    for (const arnStr of collectTargetGroupArnStringsFromAction(act)) {
      if (tgArn && arnStr === tgArn) {
        return true;
      }
      const resolved = findTargetGroupAddressForPlanRef(arnStr, changes);
      if (resolved === tgAddress) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Plan-only resolver for [`extractPrimaryTopologyZones`](terraformTopologyPlacement.ts).
 */
export function resolveListenerParentLbAddressFromPlan(
  listenerRc: PlanRc,
  changes: readonly PlanRc[],
): string | null {
  if (
    !listenerRc.type ||
    !LISTENER_TYPES.has(listenerRc.type) ||
    !listenerRc.address
  ) {
    return null;
  }
  const pv = pickResourceValuesForTopologyPlacement(listenerRc);
  if (!pv) {
    return null;
  }
  const strings: string[] = [];
  flattenStringish(pv.load_balancer_arn, strings);

  for (const raw of strings) {
    const lb = findAwsLbAddressForPlanRef(raw, changes);
    if (lb) {
      return lb;
    }
  }

  const listenerMod = terraformModulePrefixForAddress(
    stripStackPrefixForModuleParsing(listenerRc.address),
  );
  for (const rc of changes) {
    if (rc.type !== "aws_lb" || !rc.address) {
      continue;
    }
    if (
      terraformModulePrefixForAddress(
        stripStackPrefixForModuleParsing(rc.address),
      ) !== listenerMod
    ) {
      continue;
    }
    const lv = pickResourceValuesForTopologyPlacement(rc);
    if (!lv) {
      continue;
    }
    const arn = typeof lv.arn === "string" ? lv.arn : "";
    for (const raw of strings) {
      const t = raw.trim();
      if (!t || !arn) {
        continue;
      }
      if (
        t.endsWith(".arn") &&
        planRefMatchesResourceAddress(t.slice(0, -4), rc.address)
      ) {
        return rc.address;
      }
    }
  }

  return null;
}

/**
 * Plan-only: resolve parent `aws_lb` for a target group via listener `default_action` refs.
 */
export function resolveTargetGroupParentLbAddressFromPlan(
  tgRc: PlanRc,
  changes: readonly PlanRc[],
): string | null {
  if (!tgRc.type || !TARGET_GROUP_TYPES.has(tgRc.type) || !tgRc.address) {
    return null;
  }
  const pv = pickResourceValuesForTopologyPlacement(tgRc);
  const tgArn = pv && typeof pv.arn === "string" ? pv.arn : "";

  for (const rc of changes) {
    if (!rc.type || !LISTENER_TYPES.has(rc.type) || !rc.address) {
      continue;
    }
    const lv = pickResourceValuesForTopologyPlacement(rc);
    if (!lv) {
      continue;
    }
    if (
      listenerPlanValuesForwardToTargetGroup(lv, tgRc.address, tgArn, changes)
    ) {
      return resolveListenerParentLbAddressFromPlan(rc, changes);
    }
  }

  return null;
}

/**
 * Plan-only: parent `aws_lb` for listener, target group, or target group attachment.
 */
export function resolveAlbCompanionParentLbAddressFromPlan(
  companionRc: PlanRc,
  changes: readonly PlanRc[],
): string | null {
  const t = companionRc.type;
  if (!t || !companionRc.address) {
    return null;
  }
  if (LISTENER_TYPES.has(t)) {
    return resolveListenerParentLbAddressFromPlan(companionRc, changes);
  }
  if (TARGET_GROUP_TYPES.has(t)) {
    return resolveTargetGroupParentLbAddressFromPlan(companionRc, changes);
  }
  if (ATTACHMENT_TYPES.has(t)) {
    const pv = pickResourceValuesForTopologyPlacement(companionRc);
    if (!pv) {
      return null;
    }
    const strings: string[] = [];
    flattenStringish(pv.target_group_arn, strings);
    for (const raw of strings) {
      const tgAddr = findTargetGroupAddressForPlanRef(raw, changes);
      if (!tgAddr) {
        continue;
      }
      const tgRc = changes.find((c) => c.address === tgAddr);
      if (tgRc) {
        return resolveTargetGroupParentLbAddressFromPlan(tgRc, changes);
      }
    }
  }
  return null;
}

function resolveArnLikeToNodePath(
  nodes: TerraformPlanNodesMap,
  ref: string,
  arnIndex: Map<string, string>,
  acceptType: (t: string) => boolean,
): string | null {
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;
  const s = ref.trim();
  if (!s) {
    return null;
  }
  const byStrip = resolveTerraformPlanNodeKey(graphNodes, stripIndexes(s));
  if (byStrip && acceptType(getResourceType(byStrip, nodes[byStrip]))) {
    return byStrip;
  }
  const byFull = resolveTerraformPlanNodeKey(graphNodes, s);
  if (byFull && acceptType(getResourceType(byFull, nodes[byFull]))) {
    return byFull;
  }
  const byArn = arnIndex.get(s);
  if (byArn && acceptType(getResourceType(byArn, nodes[byArn]))) {
    return byArn;
  }
  return null;
}

function normalizeDefaultActions(values: Record<string, unknown>): unknown[] {
  const da = values.default_action;
  if (da == null) {
    return [];
  }
  return Array.isArray(da) ? da : [da];
}

/** Collect `target_group_arn` strings and nested forward block ARNs from one action. */
function collectTargetGroupArnStringsFromAction(action: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (!v) {
      return;
    }
    if (typeof v === "string" && v.trim()) {
      out.push(v.trim());
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        visit(item);
      }
      return;
    }
    if (!isPlainObject(v)) {
      return;
    }
    for (const [k, val] of Object.entries(v)) {
      if (k === "target_group_arn") {
        visit(val);
        continue;
      }
      if (k === "target_group" && isPlainObject(val)) {
        visit((val as { arn?: unknown }).arn);
        continue;
      }
      if (k === "forward" || k === "weighted_forward") {
        visit(val);
      }
    }
  };
  visit(action);
  return out;
}

function collectListenerTargetGroupPaths(
  nodes: TerraformPlanNodesMap,
  listenerPath: string,
  arnIndex: Map<string, string>,
): string[] {
  const node = nodes[listenerPath] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary) {
    return [];
  }
  const t = typeof primary.type === "string" ? primary.type : "";
  if (!LISTENER_TYPES.has(t)) {
    return [];
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const tgPaths = new Set<string>();
  for (const act of normalizeDefaultActions(values)) {
    for (const arnStr of collectTargetGroupArnStringsFromAction(act)) {
      const p = resolveArnLikeToNodePath(nodes, arnStr, arnIndex, (rt) =>
        TARGET_GROUP_TYPES.has(rt),
      );
      if (p) {
        tgPaths.add(p);
      }
    }
  }
  return [...tgPaths].sort((a, b) => a.localeCompare(b));
}

function collectAttachmentPathsForTargetGroups(
  nodes: TerraformPlanNodesMap,
  tgPaths: ReadonlySet<string>,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const out = new Set<string>();
  for (const path of candidatesForTypes(nodesByType, ATTACHMENT_TYPES, nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    if (!ATTACHMENT_TYPES.has(t)) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(p);
    const resolved = resolveArnLikeToNodePath(
      nodes,
      typeof values.target_group_arn === "string"
        ? values.target_group_arn
        : "",
      arnIndex,
      (rt) => TARGET_GROUP_TYPES.has(rt),
    );
    if (resolved && tgPaths.has(resolved)) {
      out.add(path);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export type AlbListenerTargetCluster = {
  lb: string;
  /** Drawn top-to-bottom: listeners, then target groups, then attachments. */
  stack: string[];
};

/**
 * Listeners (same LB), their resolved target groups, and attachments for those TGs.
 */
export function buildAlbListenerTargetCluster(
  nodes: TerraformPlanNodesMap,
  lbAddress: string,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: AlbListenerTargetCluster | null; edges: TopologyIamEdge[] } {
  const canonicalLb = canonicalTopologyNodeKey(nodes, lbAddress);
  const lbNode = nodes[canonicalLb] as TerraformPlanGraphNode | undefined;
  const lbPrimary = getPrimaryResource(lbNode);
  if (!lbPrimary || lbPrimary.type !== "aws_lb") {
    return { cluster: null, edges: [] };
  }

  const listenerBareSeen = new Set<string>();
  const listenerPaths: string[] = [];
  for (const path of candidatesForTypes(nodesByType, LISTENER_TYPES, nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr) {
      continue;
    }
    const t = typeof pr.type === "string" ? pr.type : "";
    if (!LISTENER_TYPES.has(t)) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(pr);
    const listenerLb = resolveLoadBalancerArnToLbPath(
      nodes,
      values.load_balancer_arn,
      arnIndex,
      nodesByType,
    );
    if (!listenerLb || !topologyAddressesMatch(listenerLb, canonicalLb)) {
      continue;
    }
    const canonicalListener = canonicalTopologyNodeKey(nodes, path);
    const listenerBare = topologyBareAddressKey(canonicalListener);
    if (listenerBareSeen.has(listenerBare)) {
      continue;
    }
    listenerBareSeen.add(listenerBare);
    listenerPaths.push(canonicalListener);
  }
  listenerPaths.sort((a, b) => a.localeCompare(b));

  const tgBareSeen = new Set<string>();
  const tgOrdered: string[] = [];
  const tgSet = new Set<string>();
  const listenerToTgs = new Map<string, string[]>();

  for (const lp of listenerPaths) {
    const tgs = collectListenerTargetGroupPaths(nodes, lp, arnIndex).map((tg) =>
      canonicalTopologyNodeKey(nodes, tg),
    );
    const dedupedTgs = dedupeTopologyAddressesByBareKey(nodes, tgs);
    listenerToTgs.set(lp, dedupedTgs);
    for (const tg of dedupedTgs) {
      const tgBare = topologyBareAddressKey(tg);
      if (!tgBareSeen.has(tgBare)) {
        tgBareSeen.add(tgBare);
        tgSet.add(tg);
        tgOrdered.push(tg);
      }
    }
  }

  const attachmentPaths = dedupeTopologyAddressesByBareKey(
    nodes,
    collectAttachmentPathsForTargetGroups(nodes, tgSet, arnIndex, nodesByType),
  );

  const stack = dedupeTopologyAddressesByBareKey(nodes, [
    ...listenerPaths,
    ...tgOrdered,
    ...attachmentPaths,
  ]);
  if (stack.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [];
  for (const lp of listenerPaths) {
    edges.push({
      source: canonicalLb,
      target: lp,
      type: "alb_listener",
      label: "listener",
    });
    for (const tg of listenerToTgs.get(lp) ?? []) {
      edges.push({
        source: lp,
        target: tg,
        type: "alb_forward",
        label: "forward",
      });
    }
  }
  for (const ap of attachmentPaths) {
    const n = nodes[ap] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    const values = mergeTerraformPlanResourceValues(pr);
    const tg = resolveArnLikeToNodePath(
      nodes,
      typeof values.target_group_arn === "string"
        ? values.target_group_arn
        : "",
      arnIndex,
      (rt) => TARGET_GROUP_TYPES.has(rt),
    );
    if (tg) {
      edges.push({
        source: tg,
        target: ap,
        type: "alb_attachment",
        label: "attachment",
      });
    }
  }

  return { cluster: { lb: canonicalLb, stack }, edges };
}

/** Fill in heights using layout constants (keeps alb module free of layout px imports). */
export function albSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  lbAddress: string,
  arnIndex: Map<string, string>,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildAlbListenerTargetCluster(nodes, lbAddress, arnIndex);
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  let h = satelliteGap;
  for (const addr of cluster.stack) {
    const t = getResourceType(addr, nodes[addr] as TerraformPlanGraphNode);
    const tileH =
      TARGET_GROUP_TYPES.has(t) || ATTACHMENT_TYPES.has(t)
        ? tier2SatelliteH
        : tier1SatelliteH;
    h += tileH + satelliteGap;
  }
  return h;
}

/** Terraform addresses drawn as satellites under some `aws_lb` in this address list. */
export function collectAlbClusterSatelliteAddressesForTopologyList(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
  plan?: unknown,
): Set<string> {
  const consumed = new Set<string>();
  for (const addr of addresses) {
    const n = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_lb") {
      continue;
    }
    const { cluster } = buildAlbListenerTargetCluster(nodes, addr, arnIndex);
    if (cluster) {
      for (const s of cluster.stack) {
        consumed.add(s);
      }
    }
    const sgCluster = buildLoadBalancerSgCluster(
      nodes,
      addr,
      arnIndex,
      plan,
    ).cluster;
    if (sgCluster) {
      for (const g of sgCluster.groups) {
        consumed.add(g.sgPath);
        for (const r of g.rules) {
          consumed.add(r);
        }
      }
    }
  }
  return consumed;
}

/**
 * Drop listener / target group / attachment addresses that are rendered under an `aws_lb`
 * in the same list (same zone or regional column).
 */
/** True when some `aws_lb` cluster in `nodes` already lists `address` as a satellite. */
export function isAlbCompanionConsumedAsSatellite(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  address: string,
): boolean {
  const targetBare = topologyBareAddressKey(address);
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const pr = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!pr || pr.type !== "aws_lb") {
      continue;
    }
    const { cluster } = buildAlbListenerTargetCluster(
      nodes,
      canonicalTopologyNodeKey(nodes, path),
      arnIndex,
    );
    if (cluster?.stack.some((s) => topologyBareAddressKey(s) === targetBare)) {
      return true;
    }
  }
  return false;
}

export function filterTopologyAddressesExcludingAlbSatellites(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
  plan?: unknown,
): string[] {
  const consumed = collectAlbClusterSatelliteAddressesForTopologyList(
    nodes,
    arnIndex,
    addresses,
    plan,
  );
  return [...addresses].filter((a) => !consumed.has(a));
}

export function albCompanionDrawMetrics(
  nodes: TerraformPlanNodesMap,
  satAddr: string,
  tier1W: number,
  tier2W: number,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
): { tileH: number; tileW: number; tileXOffset: number; tier: 1 | 2 } {
  const t = getResourceType(satAddr, nodes[satAddr] as TerraformPlanGraphNode);
  if (TARGET_GROUP_TYPES.has(t) || ATTACHMENT_TYPES.has(t)) {
    return {
      tileH: tier2SatelliteH,
      tileW: tier2W,
      tileXOffset: Math.floor((tier1W - tier2W) / 2),
      tier: 2,
    };
  }
  return {
    tileH: tier1SatelliteH,
    tileW: tier1W,
    tileXOffset: 0,
    tier: 1,
  };
}
