/**
 * Semantic topology: resolve Lambda execution IAM roles and attached policies from the
 * Terraform plan-shaped `nodes` map (no backend pipeline).
 */

import { buildEcsEc2CapacityChainsForService } from "./terraformTopologyEcsLinks";
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";
import {
  groupIamStackIntoRoleStacks,
  nestedIamRoleStacksExtraHeightPx,
} from "./terraformTopologySatelliteLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

/**
 * Candidate paths for a single type: indexed lookup if available, else the full scan.
 * A missing bucket (no nodes of that type) is NOT a fallback — it's a correct empty
 * result from the index. Only the absence of `nodesByType` itself counts as a fallback.
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

export function getResourceTypeFromPath(
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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  if (!roleIdentifier) {
    return null;
  }
  const wantMod = modulePrefix;
  for (const path of candidatesForType(nodesByType, "aws_iam_role", nodes)) {
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
    if (roleIdentifier === awsRoleName || roleIdentifier === tfBlockName) {
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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const rolePaths: string[] = [];
  for (const path of candidatesForType(nodesByType, "aws_iam_role", nodes)) {
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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(roleValue, strings);
  const modulePrefix = terraformModulePrefixForAddress(lambdaAddress);

  if (strings.length === 0) {
    return inferLambdaExecutionRoleFromModuleContext(
      nodes,
      lambdaAddress,
      modulePrefix,
      nodesByType,
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

    const byName = findIamRoleInModuleByRoleField(
      nodes,
      modulePrefix,
      text,
      nodesByType,
    );
    if (byName) {
      return byName;
    }
  }

  return inferLambdaExecutionRoleFromModuleContext(
    nodes,
    lambdaAddress,
    modulePrefix,
    nodesByType,
  );
}

function resolveRoleReferenceOnPolicyNode(
  nodes: TerraformPlanNodesMap,
  policyAddress: string,
  roleRef: unknown,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
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
    const byName = findIamRoleInModuleByRoleField(
      nodes,
      modulePrefix,
      text,
      nodesByType,
    );
    if (byName) {
      return byName;
    }
  }
  return null;
}

/**
 * Inline `aws_iam_role_policy`, `aws_iam_role_policy_attachment`, and managed `aws_iam_policy`
 * (when the policy resource is in the plan) attached to `rolePath`.
 */
/** `data.aws_iam_policy_document` addresses referenced from merged IAM role policy blobs. */
export function collectDataIamPolicyDocumentsForRole(
  nodes: TerraformPlanNodesMap,
  rolePath: string,
): string[] {
  const node = nodes[rolePath] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_iam_role") {
    return [];
  }
  const modPrefix = terraformModulePrefixForAddress(rolePath);
  const v = mergeTerraformPlanResourceValues(primary);
  const blobs: unknown[] = [
    v.assume_role_policy,
    v.inline_policy,
    v.permissions_boundary,
  ];
  const strings: string[] = [];
  for (const b of blobs) {
    flattenStringish(b, strings);
  }
  const out = new Set<string>();
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;
  for (const chunk of strings) {
    const re =
      /\b((?:module\.[a-zA-Z0-9_.-]+\.)*data\.aws_iam_policy_document\.[a-zA-Z0-9_.-]+(?:\[[^\]]+\])?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      const raw = m[1]!;
      const qualified =
        raw.startsWith("module.") || raw.startsWith("data.")
          ? raw
          : modPrefix
          ? `${modPrefix}.${raw}`
          : raw;
      const key =
        resolveTerraformPlanNodeKey(graphNodes, qualified) ||
        resolveTerraformPlanNodeKey(graphNodes, stripIndexes(qualified));
      if (
        key &&
        getResourceTypeFromPath(key, nodes[key]) === "aws_iam_policy_document"
      ) {
        out.add(key);
      }
    }
  }
  return [...out].sort();
}

export function collectPoliciesForIamRole(
  nodes: TerraformPlanNodesMap,
  rolePath: string,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const out = new Set<string>();

  let candidates: readonly string[];
  if (nodesByType) {
    candidates = [
      ...(nodesByType.get("aws_iam_role_policy") ?? []),
      ...(nodesByType.get("aws_iam_role_policy_attachment") ?? []),
    ];
  } else {
    recordNodesByTypeFallbackScan();
    candidates = Object.keys(nodes);
  }

  for (const path of candidates) {
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
      const resolved = resolveRoleReferenceOnPolicyNode(
        nodes,
        path,
        values.role,
        arnIndex,
        nodesByType,
      );
      if (resolved === rolePath) {
        out.add(path);
      }
    } else if (type === "aws_iam_role_policy_attachment") {
      const resolved = resolveRoleReferenceOnPolicyNode(
        nodes,
        path,
        values.role,
        arnIndex,
        nodesByType,
      );
      if (resolved !== rolePath) {
        continue;
      }
      out.add(path);
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
  nodesByType?: ReadonlyMap<string, readonly string[]>,
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
    nodesByType,
  );
  if (!rolePath) {
    return { cluster: null, edges: [] };
  }

  const policies = collectPoliciesForIamRole(
    nodes,
    rolePath,
    arnIndex,
    nodesByType,
  );
  const policyDocs = collectDataIamPolicyDocumentsForRole(nodes, rolePath);
  const stack = [rolePath, ...policies, ...policyDocs];
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
  for (const d of policyDocs) {
    edges.push({
      source: rolePath,
      target: d,
      type: "iam_policy_document",
      label: "policy document",
    });
  }

  return { cluster: { lambda: lambdaAddress, stack }, edges };
}

export function resolveEcsTaskDefinitionPath(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  taskDefinitionValue: unknown,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(taskDefinitionValue, strings);
  const modulePrefix = terraformModulePrefixForAddress(serviceAddress);

  for (const raw of strings) {
    const text = raw.trim();
    if (!text) {
      continue;
    }

    for (const candidate of [text, stripIndexes(text)]) {
      const direct = resolveTerraformPlanNodeKey(
        nodes as Record<string, TerraformPlanGraphNode>,
        candidate,
      );
      if (
        direct &&
        getResourceTypeFromPath(direct, nodes[direct]) ===
          "aws_ecs_task_definition"
      ) {
        return direct;
      }
    }

    if (text.startsWith("arn:aws:ecs:") && text.includes(":task-definition/")) {
      const byArn = arnIndex.get(text);
      if (
        byArn &&
        getResourceTypeFromPath(byArn, nodes[byArn]) ===
          "aws_ecs_task_definition"
      ) {
        return byArn;
      }
    }

    const qualified =
      text.startsWith("module.") || text.startsWith("aws_")
        ? text
        : modulePrefix
        ? `${modulePrefix}.${text}`
        : text;
    const resolved = resolveTerraformPlanNodeKey(
      nodes as Record<string, TerraformPlanGraphNode>,
      stripIndexes(qualified),
    );
    if (
      resolved &&
      getResourceTypeFromPath(resolved, nodes[resolved]) ===
        "aws_ecs_task_definition"
    ) {
      return resolved;
    }
  }

  const taskDefPaths: string[] = [];
  for (const path of candidatesForType(
    nodesByType,
    "aws_ecs_task_definition",
    nodes,
  )) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (terraformModulePrefixForAddress(path) !== modulePrefix) {
      continue;
    }
    if (
      getResourceTypeFromPath(path, nodes[path]) === "aws_ecs_task_definition"
    ) {
      taskDefPaths.push(path);
    }
  }
  return taskDefPaths.length === 1 ? taskDefPaths[0]! : null;
}

/**
 * Build IAM stack for Fargate ECS: task execution role + task role from the linked task definition.
 */
export function buildEcsServiceIamCluster(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: LambdaIamCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[serviceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_ecs_service") {
    return { cluster: null, edges: [] };
  }
  const serviceValues = mergeTerraformPlanResourceValues(primary);
  const taskDefPath = resolveEcsTaskDefinitionPath(
    nodes,
    serviceAddress,
    serviceValues.task_definition,
    arnIndex,
    nodesByType,
  );
  if (!taskDefPath) {
    return { cluster: null, edges: [] };
  }

  const taskDefPrimary = getPrimaryResource(nodes[taskDefPath]);
  if (!taskDefPrimary) {
    return { cluster: null, edges: [] };
  }
  const taskDefValues = mergeTerraformPlanResourceValues(taskDefPrimary);

  const stack: string[] = [];
  const edges: TopologyIamEdge[] = [];
  const seenRoles = new Set<string>();

  const appendRole = (roleValue: unknown, edgeType: string, label: string) => {
    const rolePath = resolveLambdaExecutionRolePath(
      nodes,
      serviceAddress,
      roleValue,
      arnIndex,
      nodesByType,
    );
    if (!rolePath || seenRoles.has(rolePath)) {
      return;
    }
    seenRoles.add(rolePath);
    stack.push(rolePath);
    edges.push({
      source: serviceAddress,
      target: rolePath,
      type: edgeType,
      label,
    });
    const policies = collectPoliciesForIamRole(
      nodes,
      rolePath,
      arnIndex,
      nodesByType,
    );
    const policyDocs = collectDataIamPolicyDocumentsForRole(nodes, rolePath);
    for (const p of policies) {
      stack.push(p);
      edges.push({
        source: rolePath,
        target: p,
        type: "iam_policy",
        label: "policy",
      });
    }
    for (const d of policyDocs) {
      stack.push(d);
      edges.push({
        source: rolePath,
        target: d,
        type: "iam_policy_document",
        label: "policy document",
      });
    }
  };

  appendRole(
    taskDefValues.execution_role_arn,
    "execution_role",
    "execution role",
  );
  appendRole(taskDefValues.task_role_arn, "task_role", "task role");

  const ec2Chains = buildEcsEc2CapacityChainsForService(
    nodes,
    serviceAddress,
    arnIndex,
    plan,
    nodesByType,
  );
  for (const chain of ec2Chains) {
    if (!chain.instanceProfile) {
      continue;
    }
    const profilePrimary = getPrimaryResource(nodes[chain.instanceProfile]);
    if (!profilePrimary) {
      continue;
    }
    const profileValues = mergeTerraformPlanResourceValues(profilePrimary);
    const hostRolePath = resolveLambdaExecutionRolePath(
      nodes,
      serviceAddress,
      profileValues.role,
      arnIndex,
      nodesByType,
    );
    if (!hostRolePath) {
      continue;
    }
    if (seenRoles.has(hostRolePath)) {
      continue;
    }
    seenRoles.add(hostRolePath);
    stack.push(hostRolePath);
    edges.push({
      source: serviceAddress,
      target: hostRolePath,
      type: "ecs_instance_role",
      label: "instance role",
    });
    const policies = collectPoliciesForIamRole(
      nodes,
      hostRolePath,
      arnIndex,
      nodesByType,
    );
    const policyDocs = collectDataIamPolicyDocumentsForRole(
      nodes,
      hostRolePath,
    );
    for (const p of policies) {
      stack.push(p);
      edges.push({
        source: hostRolePath,
        target: p,
        type: "iam_policy",
        label: "policy",
      });
    }
    for (const d of policyDocs) {
      stack.push(d);
      edges.push({
        source: hostRolePath,
        target: d,
        type: "iam_policy_document",
        label: "policy document",
      });
    }
  }

  if (stack.length === 0) {
    return { cluster: null, edges: [] };
  }

  return { cluster: { lambda: serviceAddress, stack }, edges };
}

/** Lambda or ECS service IAM satellites for topology layout. */
export function buildPrimaryIamCluster(
  nodes: TerraformPlanNodesMap,
  primaryAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: LambdaIamCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[primaryAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  const type = typeof primary?.type === "string" ? primary.type : "";
  if (type === "aws_ecs_service") {
    return buildEcsServiceIamCluster(
      nodes,
      primaryAddress,
      arnIndex,
      plan,
      nodesByType,
    );
  }
  return buildLambdaIamCluster(nodes, primaryAddress, arnIndex, nodesByType);
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
  plan?: unknown,
): number {
  const { cluster } = buildPrimaryIamCluster(nodes, address, arnIndex, plan);
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  const roleStacks = groupIamStackIntoRoleStacks(nodes, cluster.stack);
  let h = satelliteGap;
  for (const stack of roleStacks) {
    for (let i = 0; i < stack.length; i++) {
      const tileH = i === 0 ? tier1SatelliteH : tier2SatelliteH;
      h += tileH + satelliteGap;
    }
  }
  return h + nestedIamRoleStacksExtraHeightPx(roleStacks.length);
}

/**
 * arn→nodePath index, memoized by the `nodes` map reference. The index is a pure
 * function of `nodes` and is used read-only by callers, so it is safe to share.
 * This collapses the redundant full-node scans across one import — notably the
 * pipeline path, which rebuilds it once per cluster (~70×) via
 * `buildTopologyPrimaryClusterSkeletonForPipeline`.
 */
const arnIndexByNodes = new WeakMap<object, Map<string, string>>();

export function buildArnIndexForTopology(
  nodes: TerraformPlanNodesMap,
): Map<string, string> {
  const key = nodes as unknown as object;
  const cached = arnIndexByNodes.get(key);
  if (cached) {
    return cached;
  }
  const index = buildArnToNodePath(nodes);
  arnIndexByNodes.set(key, index);
  return index;
}
