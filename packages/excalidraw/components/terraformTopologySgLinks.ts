/**
 * Semantic topology: resolve Lambda `vpc_config.security_group_ids` and per-SG rule resources.
 */

import { canonicalTopologyNodeKey } from "./terraformTopologyAddress";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import {
  getResourceTypeFromPath,
  mergeTerraformPlanResourceValues,
  terraformModulePrefixForAddress,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import { collectEcsServiceNetworkFieldIds } from "./terraformTopologyPlacement";
import {
  collectLambdaVpcSecurityGroupRefsFromPlanConfiguration,
  qualifyConfigurationReference,
  shouldUsePlanReference,
} from "./terraformTopologyLambdaSgPlanConfig";
import { collectSgRuleSecurityGroupIdRefsFromPlanConfiguration } from "./terraformTopologySgRulePlanConfig";
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";
import {
  nestedSgGroupsExtraHeightPx,
  terraformSatelliteLayoutElementId,
  terraformSatelliteSgRuleLayoutElementId,
} from "./terraformTopologySatelliteLayout";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const out: string[] = [];
  for (const key of candidatesForType(
    nodesByType,
    "aws_security_group",
    nodes,
  )) {
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

/** Sibling `aws_security_group` resources under the same Terraform module prefix as `anchorAddress`. */
function inferModuleColocatedSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  anchorAddress: string,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const modPref = terraformModulePrefixForAddress(anchorAddress);
  if (!modPref) {
    return [];
  }
  for (
    let cursor: string | null = modPref;
    cursor;
    cursor = stripLastTerraformModuleSegment(cursor) || null
  ) {
    const paths = listAwsSecurityGroupPathsUnderPrefix(
      nodes,
      `${cursor}.`,
      nodesByType,
    );
    const ranked = rankInferredSecurityGroupPaths(paths);
    if (ranked.length > 0) {
      return ranked;
    }
  }
  return [];
}

function inferLambdaVpcSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  return inferModuleColocatedSecurityGroupRefs(
    nodes,
    lambdaAddress,
    nodesByType,
  );
}

/** When a rule omits `security_group_id` in `change.after`, the lone SG in the same module is the target. */
function inferSoleSecurityGroupPathForRuleModule(
  nodes: TerraformPlanNodesMap,
  rulePath: string,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const modPref = terraformModulePrefixForAddress(rulePath);
  if (!modPref) {
    return null;
  }
  const paths = listAwsSecurityGroupPathsUnderPrefix(
    nodes,
    `${modPref}.`,
    nodesByType,
  );
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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const path of candidatesForType(
    nodesByType,
    "aws_security_group",
    nodes,
  )) {
    const node = nodes[path] as TerraformPlanGraphNode | undefined;
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

/** Unique ordered refs from `network_configuration[*].security_groups` on ECS services. */
export function collectEcsServiceSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
): string[] {
  const node = nodes[serviceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_ecs_service") {
    return [];
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sid of collectEcsServiceNetworkFieldIds(
    values,
    "security_groups",
  )) {
    if (!seen.has(sid)) {
      seen.add(sid);
      out.push(sid);
    }
  }
  return out;
}

/** Unique ordered refs from `vpc_config[*].security_group_ids`. */
export function collectLambdaVpcSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
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
  return inferLambdaVpcSecurityGroupRefs(nodes, lambdaAddress, nodesByType);
}

/** Unique ordered refs from `vpc_security_group_ids` on `aws_rds_cluster` / `aws_db_instance`. */
export function collectDatastoreVpcSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  primaryAddress: string,
): string[] {
  const node = nodes[primaryAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary) {
    return [];
  }
  const t = typeof primary.type === "string" ? primary.type : "";
  if (t !== "aws_rds_cluster" && t !== "aws_db_instance") {
    return [];
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const out: string[] = [];
  const seen = new Set<string>();
  const flat: string[] = [];
  flattenStringish(values.vpc_security_group_ids, flat);
  for (const sid of flat) {
    if (!seen.has(sid)) {
      seen.add(sid);
      out.push(sid);
    }
  }
  return out;
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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const sgNode = nodes[sgPath] as TerraformPlanGraphNode | undefined;
  const sgPrimary = getPrimaryResource(sgNode);
  if (!sgPrimary) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();

  for (const path of candidatesForTypes(nodesByType, SG_RULE_TYPES, nodes)) {
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
      const inferred = inferSoleSecurityGroupPathForRuleModule(
        nodes,
        path,
        nodesByType,
      );
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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  const refs = collectLoadBalancerSecurityGroupRefs(nodes, lbAddress, plan);
  if (refs.length === 0) {
    return { cluster: null, edges: [] };
  }

  const idToPath = buildSecurityGroupIdToPathIndex(nodes, nodesByType);
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
    const canonicalSg = sgPath ? canonicalTopologyNodeKey(nodes, sgPath) : null;
    if (!canonicalSg || seenSg.has(canonicalSg)) {
      continue;
    }
    seenSg.add(canonicalSg);
    const rules = collectSecurityGroupRulesForSg(
      nodes,
      canonicalSg,
      arnIndex,
      idToPath,
      plan,
      nodesByType,
    );
    groups.push({ sgPath: canonicalSg, rules });
    edges.push({
      source: canonicalTopologyNodeKey(nodes, lbAddress),
      target: canonicalSg,
      type: "security_group",
      label: "security group",
    });
    for (const r of rules) {
      edges.push({
        source: canonicalSg,
        target: canonicalTopologyNodeKey(nodes, r),
        type: "sg_rule",
        label: "rule",
      });
    }
  }

  if (groups.length === 0) {
    return { cluster: null, edges: [] };
  }

  return {
    cluster: {
      lambda: canonicalTopologyNodeKey(nodes, lbAddress),
      groups,
    },
    edges,
  };
}

/** Layout keys for VPCE-mounted SG satellites (unique per endpoint × SG / rule). */
export function terraformVpceSgLayoutElementId(
  vpcEndpointAddress: string,
  sgPath: string,
): string {
  return terraformSatelliteLayoutElementId(vpcEndpointAddress, sgPath);
}

export function terraformVpceSgRuleLayoutElementId(
  vpcEndpointAddress: string,
  rulePath: string,
): string {
  return terraformSatelliteSgRuleLayoutElementId(vpcEndpointAddress, rulePath);
}

/** SG id refs from `aws_vpc_endpoint.security_group_ids` (interface endpoints). */
export function collectVpcEndpointSecurityGroupRefs(
  nodes: TerraformPlanNodesMap,
  vpcEndpointAddress: string,
): string[] {
  const node = nodes[vpcEndpointAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_vpc_endpoint") {
    return [];
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const out: string[] = [];
  const seen = new Set<string>();
  const flat: string[] = [];
  flattenStringish(values.security_group_ids, flat);
  for (const sid of flat) {
    if (!seen.has(sid)) {
      seen.add(sid);
      out.push(sid);
    }
  }
  return out;
}

/**
 * SG column for one `aws_vpc_endpoint` (same shape as Lambda SG cluster: primary→SG→rules).
 */
export function buildVpcEndpointSgCluster(
  nodes: TerraformPlanNodesMap,
  vpcEndpointAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  const refs = collectVpcEndpointSecurityGroupRefs(nodes, vpcEndpointAddress);
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
      vpcEndpointAddress,
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
      source: vpcEndpointAddress,
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
    cluster: { lambda: vpcEndpointAddress, groups },
    edges,
  };
}

export function buildLambdaSgCluster(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  const refs = collectLambdaVpcSecurityGroupRefs(
    nodes,
    lambdaAddress,
    plan,
    nodesByType,
  );
  if (refs.length === 0) {
    return { cluster: null, edges: [] };
  }

  const idToPath = buildSecurityGroupIdToPathIndex(nodes, nodesByType);
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
      nodesByType,
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

export function buildEcsServiceSgCluster(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  const refs = collectEcsServiceSecurityGroupRefs(nodes, serviceAddress);
  if (refs.length === 0) {
    return { cluster: null, edges: [] };
  }

  const idToPath = buildSecurityGroupIdToPathIndex(nodes, nodesByType);
  const groups: LambdaSgGroup[] = [];
  const edges: TopologyIamEdge[] = [];
  const seenSg = new Set<string>();

  for (const ref of refs) {
    const sgPath = resolveSecurityGroupRefToPath(
      nodes,
      serviceAddress,
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
      nodesByType,
    );
    groups.push({ sgPath, rules });
    edges.push({
      source: serviceAddress,
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
    cluster: { lambda: serviceAddress, groups },
    edges,
  };
}

/** Aurora / RDS Postgres security-group satellites (`vpc_security_group_ids`). */
export function buildDatastorePrimarySgCluster(
  nodes: TerraformPlanNodesMap,
  primaryAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  let refs = collectDatastoreVpcSecurityGroupRefs(nodes, primaryAddress);
  if (refs.length === 0) {
    refs = inferModuleColocatedSecurityGroupRefs(
      nodes,
      primaryAddress,
      nodesByType,
    );
  }
  if (refs.length === 0) {
    return { cluster: null, edges: [] };
  }

  const idToPath = buildSecurityGroupIdToPathIndex(nodes, nodesByType);
  const groups: LambdaSgGroup[] = [];
  const edges: TopologyIamEdge[] = [];
  const seenSg = new Set<string>();
  const canonicalPrimary = canonicalTopologyNodeKey(nodes, primaryAddress);

  for (const ref of refs) {
    const sgPath = resolveSecurityGroupRefToPath(
      nodes,
      primaryAddress,
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
      nodesByType,
    );
    groups.push({ sgPath, rules });
    edges.push({
      source: canonicalPrimary,
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
    cluster: { lambda: canonicalPrimary, groups },
    edges,
  };
}

/** Lambda, ECS service, ALB, or RDS/Aurora security-group satellites for topology layout. */
export function buildPrimarySgCluster(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: LambdaSgCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  const t = typeof primary?.type === "string" ? primary.type : "";
  if (t === "aws_lb") {
    return buildLoadBalancerSgCluster(
      nodes,
      address,
      arnIndex,
      plan,
      nodesByType,
    );
  }
  if (t === "aws_ecs_service") {
    return buildEcsServiceSgCluster(
      nodes,
      address,
      arnIndex,
      plan,
      nodesByType,
    );
  }
  if (t === "aws_rds_cluster" || t === "aws_db_instance") {
    return buildDatastorePrimarySgCluster(
      nodes,
      address,
      arnIndex,
      plan,
      nodesByType,
    );
  }
  return buildLambdaSgCluster(nodes, address, arnIndex, plan, nodesByType);
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
  const { cluster } = buildPrimarySgCluster(nodes, address, arnIndex, plan);
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
  return h + nestedSgGroupsExtraHeightPx(cluster.groups.length);
}
