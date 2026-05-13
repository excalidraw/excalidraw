/**
 * Semantic topology: resolve Lambda `vpc_config.security_group_ids` and per-SG rule resources.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
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
import {
  collectLambdaVpcSecurityGroupRefsFromPlanConfiguration,
  qualifyConfigurationReference,
  shouldUsePlanReference,
} from "./terraformTopologyLambdaSgPlanConfig";
import { collectSgRuleSecurityGroupIdRefsFromPlanConfiguration } from "./terraformTopologySgRulePlanConfig";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
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

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function getResourceTypeFromPath(
  nodePath: string,
  node?: TerraformPlanGraphNode,
): string {
  const primary = getPrimaryResource(node);
  const t = primary?.type;
  if (typeof t === "string") {
    return t;
  }
  const parts = nodePath.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (i < parts.length && parts[i] === "data") {
    return typeof parts[i + 1] === "string" ? String(parts[i + 1]) : "";
  }
  return typeof parts[i] === "string" ? String(parts[i]) : "";
}

/** Every `vpc_config` object block (plan JSON is usually a single-element array). */
function vpcConfigBlocks(
  values: Record<string, unknown>,
): Record<string, unknown>[] {
  const raw = values.vpc_config;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const out: Record<string, unknown>[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      out.push(item as Record<string, unknown>);
    }
  }
  return out;
}

/** Drop trailing `module.NAME` segment (`module.a.module.b` → `module.a`). */
export function stripLastTerraformModuleSegment(modulePrefix: string): string {
  if (!modulePrefix || !modulePrefix.startsWith("module.")) {
    return "";
  }
  const parts = modulePrefix.split(".");
  if (parts.length <= 2) {
    return "";
  }
  return parts.slice(0, -2).join(".");
}

/** Strip `.id` / `.arn` / `.security_group_id` suffixes for Terraform resource reference strings. */
function terraformSecurityGroupAddressLookupCandidates(
  address: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (!t || seen.has(t)) {
      return;
    }
    seen.add(t);
    out.push(t);
  };
  let cur = address.trim();
  for (let guard = 0; guard < 12 && cur; guard += 1) {
    add(cur);
    add(stripIndexes(cur));
    const lower = cur.toLowerCase();
    let stripped = false;
    for (const suf of [".security_group_id", ".id", ".arn"]) {
      if (lower.endsWith(suf)) {
        cur = cur.slice(0, -suf.length);
        stripped = true;
        break;
      }
    }
    if (!stripped) {
      break;
    }
  }
  return out;
}

function listAwsSecurityGroupPathsUnderPrefix(
  nodes: TerraformPlanNodesMap,
  prefixWithDot: string,
): string[] {
  const out: string[] = [];
  for (const key of Object.keys(nodes)) {
    if (key === TERRAFORM_MODULE_TREE_KEY || key.startsWith("__")) {
      continue;
    }
    if (!key.startsWith(prefixWithDot)) {
      continue;
    }
    if (
      getResourceTypeFromPath(key, nodes[key] as TerraformPlanGraphNode) !==
      "aws_security_group"
    ) {
      continue;
    }
    out.push(key);
  }
  return out.sort();
}

/**
 * When `security_group_ids` is omitted/unknown on create, Terraform still lists sibling
 * `aws_security_group` resources under the same stack module — infer those addresses.
 */
function rankInferredSecurityGroupPaths(paths: readonly string[]): string[] {
  if (paths.length === 0) {
    return [];
  }
  if (paths.length === 1) {
    return [paths[0]!];
  }
  const withSgHint = paths.filter((p) => /security_group/i.test(p));
  if (withSgHint.length >= 1) {
    return [...new Set(withSgHint)].sort();
  }
  if (paths.length <= 3) {
    return [...paths].sort();
  }
  return [];
}

function lambdaVpcConfigHasSubnets(values: Record<string, unknown>): boolean {
  for (const block of vpcConfigBlocks(values)) {
    const flat: string[] = [];
    flattenStringish(block.subnet_ids, flat);
    if (flat.length > 0) {
      return true;
    }
  }
  return false;
}

function inferLambdaVpcSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
): string[] {
  const modPref = terraformModulePrefixForAddress(lambdaAddress);
  if (!modPref) {
    return [];
  }
  for (
    let cursor: string | null = modPref;
    cursor;
    cursor = stripLastTerraformModuleSegment(cursor) || null
  ) {
    const paths = listAwsSecurityGroupPathsUnderPrefix(nodes, `${cursor}.`);
    const ranked = rankInferredSecurityGroupPaths(paths);
    if (ranked.length > 0) {
      return ranked;
    }
  }
  return [];
}

/** When a rule omits `security_group_id` in `change.after`, the lone SG in the same module is the target. */
function inferSoleSecurityGroupPathForRuleModule(
  nodes: TerraformPlanNodesMap,
  rulePath: string,
): string | null {
  const modPref = terraformModulePrefixForAddress(rulePath);
  if (!modPref) {
    return null;
  }
  const paths = listAwsSecurityGroupPathsUnderPrefix(nodes, `${modPref}.`);
  const ranked = rankInferredSecurityGroupPaths(paths);
  return ranked.length === 1 ? ranked[0]! : null;
}

function ruleHasExplicitSecurityGroupIdField(
  merged: Record<string, unknown>,
): boolean {
  const flat: string[] = [];
  flattenStringish(merged.security_group_id, flat);
  return flat.some((s) => s.trim().length > 0);
}

function resolveSecurityGroupIdFieldFromPlanConfiguration(
  plan: unknown,
  rulePath: string,
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  idToPath: Map<string, string>,
): string | null {
  const rawList = collectSgRuleSecurityGroupIdRefsFromPlanConfiguration(
    plan,
    rulePath,
  );
  if (rawList === null) {
    return null;
  }
  const caller = terraformModulePrefixForAddress(rulePath);
  for (const ref of rawList) {
    if (!shouldUsePlanReference(ref)) {
      continue;
    }
    const qualified = qualifyConfigurationReference(caller, ref);
    const p = resolveSecurityGroupRefToPath(
      nodes,
      rulePath,
      qualified,
      arnIndex,
      idToPath,
    );
    if (p) {
      return p;
    }
  }
  return null;
}

/** Map `sg-…` (and optional normalized forms) to Terraform `aws_security_group` node path. */
export function buildSecurityGroupIdToPathIndex(
  nodes: TerraformPlanNodesMap,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, node] of Object.entries(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (
      getResourceTypeFromPath(path, node as TerraformPlanGraphNode) !==
      "aws_security_group"
    ) {
      continue;
    }
    const primary = getPrimaryResource(node as TerraformPlanGraphNode);
    if (!primary) {
      continue;
    }
    const merged = mergeTerraformPlanResourceValues(primary);
    const id = typeof merged.id === "string" ? merged.id.trim() : "";
    if (id.startsWith("sg-")) {
      map.set(id, path);
    }
  }
  return map;
}

function resolveSecurityGroupRefToPath(
  nodes: TerraformPlanNodesMap,
  contextAddress: string,
  raw: string,
  arnIndex: Map<string, string>,
  idToPath: Map<string, string>,
): string | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  const graph = nodes as Record<string, TerraformPlanGraphNode>;
  for (const cand of terraformSecurityGroupAddressLookupCandidates(text)) {
    const k = resolveTerraformPlanNodeKey(graph, cand);
    if (k && getResourceTypeFromPath(k, nodes[k]) === "aws_security_group") {
      return k;
    }
  }

  const ctxMod = terraformModulePrefixForAddress(contextAddress);
  if (
    ctxMod &&
    !text.startsWith("module.") &&
    !text.startsWith("data.") &&
    text.includes(".")
  ) {
    const qualified = `${ctxMod}.${text}`;
    for (const qc of terraformSecurityGroupAddressLookupCandidates(qualified)) {
      const k = resolveTerraformPlanNodeKey(graph, qc);
      if (k && getResourceTypeFromPath(k, nodes[k]) === "aws_security_group") {
        return k;
      }
    }
  }

  if (text.startsWith("arn:") && arnIndex.has(text)) {
    const p = arnIndex.get(text)!;
    if (getResourceTypeFromPath(p, nodes[p]) === "aws_security_group") {
      return p;
    }
  }

  for (const [arn, path] of arnIndex.entries()) {
    if (arn && (text === arn || text.includes(arn))) {
      if (getResourceTypeFromPath(path, nodes[path]) === "aws_security_group") {
        return path;
      }
    }
  }

  if (text.startsWith("sg-")) {
    return idToPath.get(text) ?? null;
  }

  return null;
}

/** Unique ordered refs from `vpc_config[*].security_group_ids`. */
export function collectLambdaVpcSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  plan?: unknown,
): string[] {
  const node = nodes[lambdaAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_lambda_function") {
    return [];
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const block of vpcConfigBlocks(values)) {
    const flat: string[] = [];
    flattenStringish(block.security_group_ids, flat);
    for (const sid of flat) {
      if (!seen.has(sid)) {
        seen.add(sid);
        out.push(sid);
      }
    }
  }
  if (out.length > 0) {
    return out;
  }
  if (plan !== undefined) {
    const fromPlan = collectLambdaVpcSecurityGroupRefsFromPlanConfiguration(
      plan,
      lambdaAddress,
      nodes,
    );
    if (fromPlan !== null) {
      return fromPlan;
    }
  }
  if (!lambdaVpcConfigHasSubnets(values)) {
    return [];
  }
  return inferLambdaVpcSecurityGroupRefs(nodes, lambdaAddress);
}

const SG_RULE_TYPES = new Set([
  "aws_vpc_security_group_ingress_rule",
  "aws_vpc_security_group_egress_rule",
  "aws_security_group_rule",
]);

function resolveSecurityGroupIdFieldToPath(
  nodes: TerraformPlanNodesMap,
  contextAddress: string,
  sgIdValue: unknown,
  arnIndex: Map<string, string>,
  idToPath: Map<string, string>,
): string | null {
  const strings: string[] = [];
  flattenStringish(sgIdValue, strings);
  for (const s of strings) {
    const p = resolveSecurityGroupRefToPath(
      nodes,
      contextAddress,
      s,
      arnIndex,
      idToPath,
    );
    if (p) {
      return p;
    }
  }
  return null;
}

/**
 * Rule resources whose `security_group_id` resolves to `sgPath`’s merged `id` / ARN.
 */
export function collectSecurityGroupRulesForSg(
  nodes: TerraformPlanNodesMap,
  sgPath: string,
  arnIndex: Map<string, string>,
  idToPath: Map<string, string>,
  plan?: unknown,
): string[] {
  const sgNode = nodes[sgPath] as TerraformPlanGraphNode | undefined;
  const sgPrimary = getPrimaryResource(sgNode);
  if (!sgPrimary) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();

  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const t = getResourceTypeFromPath(
      path,
      nodes[path] as TerraformPlanGraphNode,
    );
    if (!SG_RULE_TYPES.has(t)) {
      continue;
    }
    const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!primary) {
      continue;
    }
    const merged = mergeTerraformPlanResourceValues(primary);
    let resolved = resolveSecurityGroupIdFieldToPath(
      nodes,
      path,
      merged.security_group_id,
      arnIndex,
      idToPath,
    );
    if (resolved !== sgPath && plan !== undefined) {
      const fromCfg = resolveSecurityGroupIdFieldFromPlanConfiguration(
        plan,
        path,
        nodes,
        arnIndex,
        idToPath,
      );
      if (fromCfg) {
        resolved = fromCfg;
      }
    }
    if (resolved !== sgPath && !ruleHasExplicitSecurityGroupIdField(merged)) {
      const inferred = inferSoleSecurityGroupPathForRuleModule(nodes, path);
      if (inferred === sgPath) {
        resolved = inferred;
      }
    }
    if (resolved !== sgPath) {
      continue;
    }
    if (!seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  }

  return out.sort();
}

export type LambdaSgGroup = {
  sgPath: string;
  rules: string[];
};

export type LambdaSgCluster = {
  /** Primary resource address (`aws_lambda_function` or `aws_lb`). */
  lambda: string;
  groups: LambdaSgGroup[];
};

/**
 * Unique ordered refs from `aws_lb.security_groups`.
 */
export function collectLoadBalancerSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  lbAddress: string,
  _plan?: unknown,
): string[] {
  const node = nodes[lbAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_lb") {
    return [];
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const out: string[] = [];
  const seen = new Set<string>();
  const flat: string[] = [];
  flattenStringish(values.security_groups, flat);
  for (const sid of flat) {
    if (!seen.has(sid)) {
      seen.add(sid);
      out.push(sid);
    }
  }
  return out;
}

/**
 * Build SG column for one `aws_lb` (same layout as Lambda SG cluster).
 */
export function buildLoadBalancerSgCluster(
  nodes: TerraformPlanNodesMap,
  lbAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  const refs = collectLoadBalancerSecurityGroupRefs(nodes, lbAddress, plan);
  if (refs.length === 0) {
    return { cluster: null, edges: [] };
  }

  const idToPath = buildSecurityGroupIdToPathIndex(nodes);
  const groups: LambdaSgGroup[] = [];
  const edges: TopologyIamEdge[] = [];
  const seenSg = new Set<string>();

  for (const ref of refs) {
    const sgPath = resolveSecurityGroupRefToPath(
      nodes,
      lbAddress,
      ref,
      arnIndex,
      idToPath,
    );
    if (!sgPath || seenSg.has(sgPath)) {
      continue;
    }
    seenSg.add(sgPath);
    const rules = collectSecurityGroupRulesForSg(
      nodes,
      sgPath,
      arnIndex,
      idToPath,
      plan,
    );
    groups.push({ sgPath, rules });
    edges.push({
      source: lbAddress,
      target: sgPath,
      type: "security_group",
      label: "security group",
    });
    for (const r of rules) {
      edges.push({
        source: sgPath,
        target: r,
        type: "sg_rule",
        label: "rule",
      });
    }
  }

  if (groups.length === 0) {
    return { cluster: null, edges: [] };
  }

  return {
    cluster: { lambda: lbAddress, groups },
    edges,
  };
}

/**
 * Build SG column (each SG + rules below) for one Lambda, plus data-flow edges
 * (Lambda→SG, SG→each rule).
 */
export function buildLambdaSgCluster(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  const refs = collectLambdaVpcSecurityGroupRefs(nodes, lambdaAddress, plan);
  if (refs.length === 0) {
    return { cluster: null, edges: [] };
  }

  const idToPath = buildSecurityGroupIdToPathIndex(nodes);
  const groups: LambdaSgGroup[] = [];
  const edges: TopologyIamEdge[] = [];
  const seenSg = new Set<string>();

  for (const ref of refs) {
    const sgPath = resolveSecurityGroupRefToPath(
      nodes,
      lambdaAddress,
      ref,
      arnIndex,
      idToPath,
    );
    if (!sgPath || seenSg.has(sgPath)) {
      continue;
    }
    seenSg.add(sgPath);
    const rules = collectSecurityGroupRulesForSg(
      nodes,
      sgPath,
      arnIndex,
      idToPath,
      plan,
    );
    groups.push({ sgPath, rules });
    edges.push({
      source: lambdaAddress,
      target: sgPath,
      type: "security_group",
      label: "security group",
    });
    for (const r of rules) {
      edges.push({
        source: sgPath,
        target: r,
        type: "sg_rule",
        label: "rule",
      });
    }
  }

  if (groups.length === 0) {
    return { cluster: null, edges: [] };
  }

  return {
    cluster: { lambda: lambdaAddress, groups },
    edges,
  };
}

/** Vertical gap between stacked SG groups under one Lambda (layout must match). */
export const TOPOLOGY_SG_BETWEEN_GROUPS_GAP_PX = 4;

/**
 * Right-column height under the Lambda (0 when no SG cluster).
 */
export function sgSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  sgTileH: number,
  ruleTileH: number,
  gap: number,
  plan?: unknown,
): number {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  const t = typeof primary?.type === "string" ? primary.type : "";
  const { cluster } =
    t === "aws_lb"
      ? buildLoadBalancerSgCluster(nodes, address, arnIndex, plan)
      : buildLambdaSgCluster(nodes, address, arnIndex, plan);
  if (!cluster || cluster.groups.length === 0) {
    return 0;
  }
  let h = gap;
  for (let gi = 0; gi < cluster.groups.length; gi++) {
    const g = cluster.groups[gi]!;
    h += sgTileH + gap;
    h += g.rules.length * (ruleTileH + gap);
    if (gi < cluster.groups.length - 1) {
      h += TOPOLOGY_SG_BETWEEN_GROUPS_GAP_PX;
    }
  }
  return h;
}
