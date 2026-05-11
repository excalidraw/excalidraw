/**
 * Resolve Lambda ↔ security group links from Terraform JSON `configuration`
 * (`terraform show -json`): DFS over `configuration.root_module` collects
 * `references` from (1) each `aws_lambda_function` resource `expressions` subtree
 * (VPC SG–relevant paths only) and (2) each `module_calls[*].expressions` for
 * `vpc_security_group_ids` / `security_group_ids`, when `resource_changes` omits SG ids.
 *
 * Limits: pure `local`/`var` wiring with no `module.*`/`aws_*`/`data.*` references
 * cannot be resolved statically. Submodules with multiple Lambdas may share the same
 * module-call input refs when resource-level expressions omit SGs.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import { terraformModulePrefixForAddress } from "./terraformTopologyIamLinks";

type UnknownRecord = Record<string, unknown>;

function isPlainObject(v: unknown): v is UnknownRecord {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function flattenRefs(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenRefs(item, out);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      flattenRefs(v, out);
    }
  }
}

export function hasTerraformPlanConfiguration(plan: unknown): boolean {
  if (!plan || typeof plan !== "object") {
    return false;
  }
  const c = (plan as UnknownRecord).configuration;
  if (!c || typeof c !== "object") {
    return false;
  }
  const rm = (c as UnknownRecord).root_module;
  return Boolean(rm && typeof rm === "object");
}

/** `module.a.module.b` → `module.a` (drop trailing `module.NAME`). */
function stripLastTerraformModuleSegment(modulePrefix: string): string {
  if (!modulePrefix || !modulePrefix.startsWith("module.")) {
    return "";
  }
  const parts = modulePrefix.split(".");
  if (parts.length <= 2) {
    return "";
  }
  return parts.slice(0, -2).join(".");
}

/** `module.a.module.b` → `["a","b"]`. */
export function moduleCallSegmentsFromPrefix(modulePrefix: string): string[] {
  if (!modulePrefix.startsWith("module.")) {
    return [];
  }
  const rest = modulePrefix.slice("module.".length);
  return rest.split(".module.").filter(Boolean);
}

/**
 * Name of the last `module.NAME` segment in a full module prefix
 * (`module.a.module.b` → `b`; `module.a` → `a`).
 */
export function lastModuleCallSegmentFromPrefix(modulePrefix: string): string {
  if (!modulePrefix.startsWith("module.")) {
    return "";
  }
  const i = modulePrefix.lastIndexOf(".module.");
  if (i === -1) {
    return modulePrefix.slice("module.".length);
  }
  return modulePrefix.slice(i + ".module.".length);
}

function stripTrailingPlanRefSuffix(addr: string): string {
  let s = addr.trim();
  const suffixes = [
    ".security_group_id",
    ".id",
    ".arn",
    ".vpc_id",
    ".name",
  ];
  for (const suf of suffixes) {
    if (s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
    }
  }
  return s;
}

/** Prefix `caller` (`module.stack`) + relative ref (`module.sg[0].x`). */
function qualifyConfigurationReference(callerPrefix: string, ref: string): string {
  const r = ref.trim();
  if (!r) {
    return r;
  }
  if (r.startsWith("module.")) {
    return callerPrefix ? `${callerPrefix}.${r}` : r;
  }
  if (r.startsWith("aws_") || r.startsWith("data.")) {
    return callerPrefix ? `${callerPrefix}.${r}` : r;
  }
  return r;
}

function shouldUsePlanReference(ref: string): boolean {
  if (!ref || ref.startsWith("var.") || ref.startsWith("local.") || ref.startsWith("each.")) {
    return false;
  }
  if (ref.startsWith("count.") || ref === "terraform.workspace" || ref.startsWith("path.")) {
    return false;
  }
  return ref.startsWith("module.") || ref.startsWith("aws_") || ref.startsWith("data.");
}

function getResourceTypeFromNodePath(
  nodes: TerraformPlanNodesMap,
  path: string,
): string {
  const node = nodes[path] as TerraformPlanGraphNode | undefined;
  const first = Object.values(node?.resources || {})[0] as { type?: string } | undefined;
  if (first && typeof first.type === "string") {
    return first.type;
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

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

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
    if (getResourceTypeFromNodePath(nodes, key) !== "aws_security_group") {
      continue;
    }
    out.push(key);
  }
  return out.sort();
}

function resolveQualifiedRefToSgPaths(
  nodes: TerraformPlanNodesMap,
  qualified: string,
): string[] {
  const graph = nodes as Record<string, TerraformPlanGraphNode>;
  const stripped = stripTrailingPlanRefSuffix(qualified);
  for (const candidate of [stripped, stripIndexes(stripped)]) {
    const k = resolveTerraformPlanNodeKey(graph, candidate);
    if (k && getResourceTypeFromNodePath(nodes, k) === "aws_security_group") {
      return [k];
    }
  }
  if (stripped.startsWith("module.")) {
    const prefix = stripped.endsWith(".") ? stripped : `${stripped}.`;
    return listAwsSecurityGroupPathsUnderPrefix(nodes, prefix);
  }
  return [];
}

/** Full Terraform address for a resource block under `modulePrefix` (may already be absolute). */
function configurationResourceFullAddress(
  modulePrefix: string,
  resourceAddress: string,
): string {
  const ra = resourceAddress.trim();
  if (ra.startsWith("module.")) {
    return ra;
  }
  return modulePrefix ? `${modulePrefix}.${ra}` : ra;
}

/**
 * Collect `references` strings from `aws_lambda_function` expressions only under
 * `vpc_security_group_ids` or `vpc_config` → `security_group_ids`.
 */
function collectVpcSgRefsFromLambdaExpressions(expressions: UnknownRecord): string[] {
  const out: string[] = [];

  function walk(node: unknown, parentKey: string | null, inVpcConfig: boolean): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, parentKey, inVpcConfig);
      }
      return;
    }
    if (!isPlainObject(node)) {
      return;
    }

    const refsVal = node.references;
    if (refsVal !== undefined && parentKey !== null) {
      const collect =
        parentKey === "vpc_security_group_ids" ||
        (inVpcConfig && parentKey === "security_group_ids");
      if (collect) {
        flattenRefs(refsVal, out);
      }
    }

    for (const [k, v] of Object.entries(node)) {
      if (k === "references") {
        continue;
      }
      walk(v, k, inVpcConfig || k === "vpc_config");
    }
  }

  walk(expressions, null, false);
  return out;
}

/** Top-level module-call inputs only (not a deep walk of the whole call object). */
function readModuleCallVpcSecurityGroupInputRefs(call: UnknownRecord): string[] {
  const expressions = call.expressions as UnknownRecord | undefined;
  if (!expressions || typeof expressions !== "object") {
    return [];
  }
  const vpcSg =
    expressions.vpc_security_group_ids ?? expressions.security_group_ids;
  if (!vpcSg || typeof vpcSg !== "object" || Array.isArray(vpcSg)) {
    return [];
  }
  const rawRefs = (vpcSg as UnknownRecord).references;
  const out: string[] = [];
  flattenRefs(rawRefs, out);
  return out;
}

export type LambdaSgPlanConfigIndexes = {
  /** Normalized (`stripIndexes`) full Lambda config address → raw ref strings. */
  lambdaResourceRefs: Map<string, string[]>;
  /** Child module instance prefix (e.g. `module.stack.module.lambda`) → raw ref strings from that module call. */
  moduleCallVpcSgRefs: Map<string, string[]>;
};

function appendRefs(map: Map<string, string[]>, key: string, refs: readonly string[]): void {
  if (refs.length === 0) {
    return;
  }
  const cur = map.get(key);
  if (cur) {
    cur.push(...refs);
  } else {
    map.set(key, [...refs]);
  }
}

function walkConfigurationModule(
  mod: UnknownRecord,
  modulePrefix: string,
  lambdaResourceRefs: Map<string, string[]>,
  moduleCallVpcSgRefs: Map<string, string[]>,
): void {
  const resources = mod.resources as unknown;
  if (Array.isArray(resources)) {
    for (const raw of resources) {
      if (!isPlainObject(raw)) {
        continue;
      }
      const res = raw as UnknownRecord;
      if (res.type !== "aws_lambda_function") {
        continue;
      }
      const addr = typeof res.address === "string" ? res.address : "";
      if (!addr) {
        continue;
      }
      const expressions = res.expressions;
      if (!expressions || typeof expressions !== "object" || Array.isArray(expressions)) {
        continue;
      }
      const full = configurationResourceFullAddress(modulePrefix, addr);
      const norm = stripIndexes(full);
      const refs = collectVpcSgRefsFromLambdaExpressions(expressions as UnknownRecord);
      appendRefs(lambdaResourceRefs, norm, refs);
    }
  }

  const moduleCalls = mod.module_calls as UnknownRecord | undefined;
  if (moduleCalls && typeof moduleCalls === "object" && !Array.isArray(moduleCalls)) {
    for (const name of Object.keys(moduleCalls)) {
      const call = moduleCalls[name] as UnknownRecord | undefined;
      if (!call || typeof call !== "object" || Array.isArray(call)) {
        continue;
      }
      const childPrefix = modulePrefix ? `${modulePrefix}.module.${name}` : `module.${name}`;
      const callRefs = readModuleCallVpcSecurityGroupInputRefs(call);
      appendRefs(moduleCallVpcSgRefs, childPrefix, callRefs);

      const inner = call.module as UnknownRecord | undefined;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        walkConfigurationModule(inner, childPrefix, lambdaResourceRefs, moduleCallVpcSgRefs);
      }
    }
  }
}

function buildLambdaSgPlanConfigIndexes(plan: unknown): LambdaSgPlanConfigIndexes | null {
  if (!hasTerraformPlanConfiguration(plan)) {
    return null;
  }
  const rootModule = (plan as UnknownRecord).configuration as UnknownRecord;
  const rm = rootModule.root_module as UnknownRecord | undefined;
  if (!rm || typeof rm !== "object") {
    return null;
  }
  const lambdaResourceRefs = new Map<string, string[]>();
  const moduleCallVpcSgRefs = new Map<string, string[]>();
  walkConfigurationModule(rm, "", lambdaResourceRefs, moduleCallVpcSgRefs);
  return { lambdaResourceRefs, moduleCallVpcSgRefs };
}

const planConfigIndexCache = new WeakMap<object, LambdaSgPlanConfigIndexes>();

function getLambdaSgPlanConfigIndexes(plan: unknown): LambdaSgPlanConfigIndexes | null {
  if (!plan || typeof plan !== "object") {
    return null;
  }
  const o = plan as object;
  const hit = planConfigIndexCache.get(o);
  if (hit) {
    return hit;
  }
  const built = buildLambdaSgPlanConfigIndexes(plan);
  if (built) {
    planConfigIndexCache.set(o, built);
  }
  return built;
}

/**
 * Returns Terraform addresses of `aws_security_group` resources for this Lambda using
 * `configuration` (resource expressions + module call inputs).
 *
 * - `null` if the plan has no usable `configuration` (caller may fall back).
 * - `[]` if configuration was indexed but produced no resolvable SG addresses.
 */
export function collectLambdaVpcSecurityGroupRefsFromPlanConfiguration(
  plan: unknown,
  lambdaAddress: string,
  nodes: TerraformPlanNodesMap,
): string[] | null {
  const idx = getLambdaSgPlanConfigIndexes(plan);
  if (!idx) {
    return null;
  }

  const lambdaMod = terraformModulePrefixForAddress(lambdaAddress);
  const normLambda = stripIndexes(lambdaAddress);

  const fromResource = idx.lambdaResourceRefs.get(normLambda) ?? [];
  const fromModuleCall =
    fromResource.length === 0 ? idx.moduleCallVpcSgRefs.get(lambdaMod) ?? [] : [];

  const seen = new Set<string>();
  const out: string[] = [];

  const qualifyResource = lambdaMod;
  const qualifyModuleCall = stripLastTerraformModuleSegment(lambdaMod);

  for (const ref of fromResource) {
    if (!shouldUsePlanReference(ref)) {
      continue;
    }
    const qualified = qualifyConfigurationReference(qualifyResource, ref);
    for (const sg of resolveQualifiedRefToSgPaths(nodes, qualified)) {
      if (!seen.has(sg)) {
        seen.add(sg);
        out.push(sg);
      }
    }
  }
  for (const ref of fromModuleCall) {
    if (!shouldUsePlanReference(ref)) {
      continue;
    }
    const qualified = qualifyConfigurationReference(qualifyModuleCall, ref);
    for (const sg of resolveQualifiedRefToSgPaths(nodes, qualified)) {
      if (!seen.has(sg)) {
        seen.add(sg);
        out.push(sg);
      }
    }
  }

  return out;
}

/** Test / tooling: expose index build without relying on WeakMap from other plan objects. */
export function buildLambdaSgPlanConfigIndexesForTests(
  plan: unknown,
): LambdaSgPlanConfigIndexes | null {
  return buildLambdaSgPlanConfigIndexes(plan);
}
