/**
 * Semantic topology: stack `aws_lb_listener`, `aws_lb_target_group`, and
 * `aws_lb_target_group_attachment` under their `aws_lb` (tier-0) like S3 companions.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import {
  mergeTerraformPlanResourceValues,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";

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

function isAwsLbNode(nodes: TerraformPlanNodesMap, path: string): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_lb";
}

/**
 * Resolve `load_balancer_arn` / LB ARN strings to a `nodes` key for `aws_lb`.
 */
export function resolveLoadBalancerArnToLbPath(
  nodes: TerraformPlanNodesMap,
  lbArnField: unknown,
  arnIndex: Map<string, string>,
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

  for (const [path, node] of Object.entries(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const primary = getPrimaryResource(node as TerraformPlanGraphNode);
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

function normalizeDefaultActions(
  values: Record<string, unknown>,
): unknown[] {
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
      const p = resolveArnLikeToNodePath(
        nodes,
        arnStr,
        arnIndex,
        (rt) => TARGET_GROUP_TYPES.has(rt),
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
): string[] {
  const out = new Set<string>();
  for (const path of Object.keys(nodes)) {
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
): { cluster: AlbListenerTargetCluster | null; edges: TopologyIamEdge[] } {
  const lbNode = nodes[lbAddress] as TerraformPlanGraphNode | undefined;
  const lbPrimary = getPrimaryResource(lbNode);
  if (!lbPrimary || lbPrimary.type !== "aws_lb") {
    return { cluster: null, edges: [] };
  }

  const listenerPaths: string[] = [];
  for (const path of Object.keys(nodes)) {
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
    if (
      resolveLoadBalancerArnToLbPath(
        nodes,
        values.load_balancer_arn,
        arnIndex,
      ) !== lbAddress
    ) {
      continue;
    }
    listenerPaths.push(path);
  }
  listenerPaths.sort((a, b) => a.localeCompare(b));

  const tgOrdered: string[] = [];
  const tgSet = new Set<string>();
  const listenerToTgs = new Map<string, string[]>();

  for (const lp of listenerPaths) {
    const tgs = collectListenerTargetGroupPaths(nodes, lp, arnIndex);
    listenerToTgs.set(lp, tgs);
    for (const tg of tgs) {
      if (!tgSet.has(tg)) {
        tgSet.add(tg);
        tgOrdered.push(tg);
      }
    }
  }

  const attachmentPaths = collectAttachmentPathsForTargetGroups(
    nodes,
    tgSet,
    arnIndex,
  );

  const stack = [...listenerPaths, ...tgOrdered, ...attachmentPaths];
  if (stack.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [];
  for (const lp of listenerPaths) {
    edges.push({
      source: lbAddress,
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

  return { cluster: { lb: lbAddress, stack }, edges };
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
): Set<string> {
  const consumed = new Set<string>();
  for (const addr of addresses) {
    const n = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_lb") {
      continue;
    }
    const { cluster } = buildAlbListenerTargetCluster(nodes, addr, arnIndex);
    if (!cluster) {
      continue;
    }
    for (const s of cluster.stack) {
      consumed.add(s);
    }
  }
  return consumed;
}

/**
 * Drop listener / target group / attachment addresses that are rendered under an `aws_lb`
 * in the same list (same zone or regional column).
 */
export function filterTopologyAddressesExcludingAlbSatellites(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
): string[] {
  const consumed = collectAlbClusterSatelliteAddressesForTopologyList(
    nodes,
    arnIndex,
    addresses,
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
