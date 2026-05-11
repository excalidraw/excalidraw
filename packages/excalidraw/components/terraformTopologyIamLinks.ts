/**
 * Semantic topology: resolve Lambda execution IAM roles and attached policies from the
 * Terraform plan-shaped `nodes` map (no backend pipeline).
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function isEmptyObject(rec: Record<string, unknown>): boolean {
  return Object.keys(rec).length === 0;
}

/** Mirrors topology placement: prefer `before` on delete / empty `after`. */
export function mergeTerraformPlanResourceValues(
  resource: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!resource) {
    return {};
  }
  const change = resource.change as
    | { actions?: string[]; before?: unknown; after?: unknown }
    | undefined;
  if (!change || typeof change !== "object") {
    const values = resource.values;
    return isPlainObject(values) ? { ...values } : {};
  }
  const actions = Array.isArray(change.actions) ? change.actions : [];
  const before = isPlainObject(change.before) ? change.before : null;
  const after = isPlainObject(change.after) ? change.after : null;

  if (actions.includes("delete") && before) {
    if (after && !isEmptyObject(after)) {
      return { ...before, ...after };
    }
    return { ...before };
  }

  if (after && isEmptyObject(after) && before) {
    return { ...before };
  }

  if (after) {
    return { ...after };
  }
  if (before) {
    return { ...before };
  }

  const values = resource.values;
  return isPlainObject(values) ? { ...values } : {};
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function getResourceTypeFromPath(nodePath: string, node?: TerraformPlanGraphNode): string {
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

/** Terraform module prefix for a resource address, e.g. `module.a.module.b` or `""` for root. */
export function terraformModulePrefixForAddress(address: string): string {
  const parts = address.split(".");
  const segments: string[] = [];
  for (let i = 0; i < parts.length - 1; ) {
    if (parts[i] === "module" && parts[i + 1]) {
      segments.push("module", parts[i + 1]!);
      i += 2;
    } else {
      break;
    }
  }
  return segments.join(".");
}

function buildArnToNodePath(nodes: TerraformPlanNodesMap): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, node] of Object.entries(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const primary = getPrimaryResource(node as TerraformPlanGraphNode);
    if (!primary) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(primary);
    const arn = values.arn;
    if (typeof arn === "string" && arn.startsWith("arn:")) {
      map.set(arn, path);
    }
  }
  return map;
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
 * `aws_iam_role_policy.role` / attachment `role` is the **AWS IAM role name** (e.g. `test-reader`),
 * not the Terraform resource block name (`lambda`). Match `merge…Values(primary).name` first,
 * then Terraform `resource.name` as a fallback.
 */
function findIamRoleInModuleByRoleField(
  nodes: TerraformPlanNodesMap,
  modulePrefix: string,
  roleIdentifier: string,
): string | null {
  if (!roleIdentifier) {
    return null;
  }
  const wantMod = modulePrefix;
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (terraformModulePrefixForAddress(path) !== wantMod) {
      continue;
    }
    if (getResourceTypeFromPath(path, nodes[path]) !== "aws_iam_role") {
      continue;
    }
    const primary = getPrimaryResource(nodes[path]);
    if (!primary) {
      continue;
    }
    const merged = mergeTerraformPlanResourceValues(primary);
    const awsRoleName = typeof merged.name === "string" ? merged.name : null;
    const tfBlockName = typeof primary.name === "string" ? primary.name : null;
    if (
      roleIdentifier === awsRoleName ||
      roleIdentifier === tfBlockName
    ) {
      return path;
    }
  }
  return null;
}

/** When Lambda `role` is unknown at create time, infer role in the same module. */
function inferLambdaExecutionRoleFromModuleContext(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  modulePrefix: string,
): string | null {
  const rolePaths: string[] = [];
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (terraformModulePrefixForAddress(path) !== modulePrefix) {
      continue;
    }
    if (getResourceTypeFromPath(path, nodes[path]) !== "aws_iam_role") {
      continue;
    }
    rolePaths.push(path);
  }
  if (rolePaths.length === 1) {
    return rolePaths[0]!;
  }
  const lambdaPrimary = getPrimaryResource(nodes[lambdaAddress]);
  if (!lambdaPrimary) {
    return null;
  }
  const lambdaVals = mergeTerraformPlanResourceValues(lambdaPrimary);
  const fnName =
    typeof lambdaVals.function_name === "string"
      ? lambdaVals.function_name
      : null;
  if (!fnName) {
    return null;
  }
  for (const path of rolePaths) {
    const rp = getPrimaryResource(nodes[path]);
    if (!rp) {
      continue;
    }
    const rv = mergeTerraformPlanResourceValues(rp);
    if (typeof rv.name === "string" && rv.name === fnName) {
      return path;
    }
  }
  return null;
}

/**
 * Resolve `role` attribute (string / ARN / Terraform-ish reference) to a `nodes` key.
 */
export function resolveLambdaExecutionRolePath(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  roleValue: unknown,
  arnIndex: Map<string, string>,
): string | null {
  const strings: string[] = [];
  flattenStringish(roleValue, strings);
  const modulePrefix = terraformModulePrefixForAddress(lambdaAddress);

  if (strings.length === 0) {
    return inferLambdaExecutionRoleFromModuleContext(
      nodes,
      lambdaAddress,
      modulePrefix,
    );
  }

  for (const raw of strings) {
    const text = raw.trim();
    if (!text) {
      continue;
    }

    const direct = resolveTerraformPlanNodeKey(
      nodes as Record<string, TerraformPlanGraphNode>,
      stripIndexes(text),
    );
    if (direct) {
      return direct;
    }

    const directFull = resolveTerraformPlanNodeKey(
      nodes as Record<string, TerraformPlanGraphNode>,
      text,
    );
    if (directFull) {
      return directFull;
    }

    if (text.startsWith("arn:aws:iam::") && text.includes(":role/")) {
      const byArn = arnIndex.get(text);
      if (byArn) {
        return byArn;
      }
    }

    for (const [arn, path] of arnIndex.entries()) {
      if (arn && (text === arn || text.includes(arn))) {
        return path;
      }
    }

    const byName = findIamRoleInModuleByRoleField(nodes, modulePrefix, text);
    if (byName) {
      return byName;
    }
  }

  return inferLambdaExecutionRoleFromModuleContext(
    nodes,
    lambdaAddress,
    modulePrefix,
  );
}

function resolveRoleReferenceOnPolicyNode(
  nodes: TerraformPlanNodesMap,
  policyAddress: string,
  roleRef: unknown,
  arnIndex: Map<string, string>,
): string | null {
  const strings: string[] = [];
  flattenStringish(roleRef, strings);
  const modulePrefix = terraformModulePrefixForAddress(policyAddress);

  for (const text of strings) {
    const direct = resolveTerraformPlanNodeKey(
      nodes as Record<string, TerraformPlanGraphNode>,
      stripIndexes(text),
    );
    if (direct) {
      return direct;
    }
    const directFull = resolveTerraformPlanNodeKey(
      nodes as Record<string, TerraformPlanGraphNode>,
      text,
    );
    if (directFull) {
      return directFull;
    }
    if (text.startsWith("arn:aws:iam::") && text.includes(":role/")) {
      const p = arnIndex.get(text);
      if (p) {
        return p;
      }
    }
    const byName = findIamRoleInModuleByRoleField(nodes, modulePrefix, text);
    if (byName) {
      return byName;
    }
  }
  return null;
}

/**
 * Inline `aws_iam_role_policy` and managed `aws_iam_policy` (via `aws_iam_role_policy_attachment`)
 * attached to `rolePath`.
 */
export function collectPoliciesForIamRole(
  nodes: TerraformPlanNodesMap,
  rolePath: string,
  arnIndex: Map<string, string>,
): string[] {
  const out = new Set<string>();

  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const node = nodes[path] as TerraformPlanGraphNode | undefined;
    const primary = getPrimaryResource(node);
    if (!primary) {
      continue;
    }
    const type = typeof primary.type === "string" ? primary.type : "";
    const values = mergeTerraformPlanResourceValues(primary);

    if (type === "aws_iam_role_policy") {
      const resolved = resolveRoleReferenceOnPolicyNode(nodes, path, values.role, arnIndex);
      if (resolved === rolePath) {
        out.add(path);
      }
    } else if (type === "aws_iam_role_policy_attachment") {
      const resolved = resolveRoleReferenceOnPolicyNode(nodes, path, values.role, arnIndex);
      if (resolved !== rolePath) {
        continue;
      }
      const policyArn = values.policy_arn;
      if (typeof policyArn === "string" && policyArn.startsWith("arn:")) {
        const policyPath = arnIndex.get(policyArn);
        if (policyPath) {
          out.add(policyPath);
        }
      }
    }
  }

  return [...out].sort();
}

export type TopologyIamEdge = {
  source: string;
  target: string;
  type: string;
  label: string;
};

export type LambdaIamCluster = {
  lambda: string;
  /** `[executionRole, ...policies]` — Terraform addresses present in `nodes`. */
  stack: string[];
};

/**
 * Build ordered IAM stack (role, then policies) for one Lambda, plus data-flow edges
 * (Lambda→role, role→each policy).
 */
export function buildLambdaIamCluster(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  arnIndex: Map<string, string>,
): { cluster: LambdaIamCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[lambdaAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_lambda_function") {
    return { cluster: null, edges: [] };
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const rolePath = resolveLambdaExecutionRolePath(
    nodes,
    lambdaAddress,
    values.role,
    arnIndex,
  );
  if (!rolePath) {
    return { cluster: null, edges: [] };
  }

  const policies = collectPoliciesForIamRole(nodes, rolePath, arnIndex);
  const stack = [rolePath, ...policies];
  const edges: TopologyIamEdge[] = [
    {
      source: lambdaAddress,
      target: rolePath,
      type: "execution_role",
      label: "execution role",
    },
  ];
  for (const p of policies) {
    edges.push({
      source: rolePath,
      target: p,
      type: "iam_policy",
      label: "policy",
    });
  }

  return { cluster: { lambda: lambdaAddress, stack }, edges };
}

/**
 * Per-primary-address IAM stack height in pixels (0 when no IAM cluster).
 * First stack entry is the execution role (tier-1 height); remaining entries are policies (tier-2 height).
 */
export function iamSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildLambdaIamCluster(nodes, address, arnIndex);
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  let h = satelliteGap;
  for (let i = 0; i < cluster.stack.length; i++) {
    const tileH = i === 0 ? tier1SatelliteH : tier2SatelliteH;
    h += tileH + satelliteGap;
  }
  return h;
}

export function buildArnIndexForTopology(nodes: TerraformPlanNodesMap): Map<string, string> {
  return buildArnToNodePath(nodes);
}
