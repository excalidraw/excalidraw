/**
 * Semantic topology: ECS workload and EC2 capacity satellites under `aws_ecs_service`.
 *
 * ## AWS model (combinatorics)
 *
 * - `aws_ecs_cluster` is **regional**, not VPC-bound — a logical namespace for services/tasks.
 * - **Fargate** tasks bind to VPC subnets via `aws_ecs_service.network_configuration`.
 * - **EC2 capacity path** (per capacity provider): CP → ASG → launch template → instance profile;
 *   ASG `vpc_zone_identifier` is subnets in **one** VPC per ASG.
 * - A service may reference **N** capacity providers via `capacity_provider_strategy` (N parallel chains).
 * - `aws_ecs_cluster_capacity_providers` registers CP names on a cluster (binding resource, optional satellite).
 *
 * The importer resolves what the plan links; it does not assume one ASG per cluster or one VPC per diagram.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";
import { pickResourceValuesForTopologyPlacement } from "./terraformTopologyExtract";
import { getCloudWatchAttachmentIndex } from "./terraformTopologyCloudWatchLinks";
import {
  topologyModuleScopeForAddress,
  type TopologyModuleScope,
} from "./terraformTopologyApiGatewayLinks";
import {
  mergeTerraformPlanResourceValues,
  resolveEcsTaskDefinitionPath,
  terraformModulePrefixForAddress,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import { parseStackAddress, prefixStackAddress } from "./terraformStackAddress";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

type PlanRc = {
  address?: string;
  type?: string;
  mode?: string;
  change?: { after?: unknown; before?: unknown };
};

export const ECS_TOPOLOGY_SATELLITE_TYPES = new Set([
  "aws_ecs_task_definition",
]);

export const ECS_EC2_TOPOLOGY_SATELLITE_TYPES = new Set([
  "aws_ecs_capacity_provider",
  "aws_autoscaling_group",
  "aws_launch_template",
  "aws_iam_instance_profile",
  "aws_ecs_cluster_capacity_providers",
]);

export const ECS_CLUSTER_SATELLITE_TYPES = new Set(["aws_ecs_cluster"]);

export function isEcsTopologySatelliteResourceType(
  resourceType: string,
): boolean {
  return (
    ECS_TOPOLOGY_SATELLITE_TYPES.has(resourceType) ||
    ECS_EC2_TOPOLOGY_SATELLITE_TYPES.has(resourceType) ||
    ECS_CLUSTER_SATELLITE_TYPES.has(resourceType)
  );
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

function moduleScopesMatch(
  a: TopologyModuleScope,
  b: TopologyModuleScope,
): boolean {
  return a.stackId === b.stackId && a.modulePrefix === b.modulePrefix;
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

function planChangesFromPlan(plan?: unknown): readonly PlanRc[] {
  const changes = (plan as { resource_changes?: PlanRc[] } | undefined)
    ?.resource_changes;
  return Array.isArray(changes) ? changes : [];
}

function stripTerraformAttributeSuffix(ref: string): string {
  return ref.replace(/\.(name|id|arn)$/, "");
}

function resolveNodePathForRef(
  nodes: TerraformPlanNodesMap,
  modulePrefix: string,
  ref: string,
  acceptType: string,
): string | null {
  const trimmed = ref.trim();
  if (!trimmed) {
    return null;
  }
  const graph = nodes as Record<string, TerraformPlanGraphNode>;
  for (const candidate of [
    trimmed,
    stripIndexes(trimmed),
    stripTerraformAttributeSuffix(trimmed),
    stripIndexes(stripTerraformAttributeSuffix(trimmed)),
  ]) {
    const direct = resolveTerraformPlanNodeKey(graph, candidate);
    if (direct && getResourceType(direct, nodes[direct]) === acceptType) {
      return direct;
    }
  }
  const bareRef = stripTerraformAttributeSuffix(trimmed);
  const qualified =
    bareRef.startsWith("module.") || bareRef.startsWith("aws_")
      ? bareRef
      : modulePrefix
      ? `${modulePrefix}.${bareRef}`
      : bareRef;
  const resolved = resolveTerraformPlanNodeKey(graph, stripIndexes(qualified));
  if (resolved && getResourceType(resolved, nodes[resolved]) === acceptType) {
    return resolved;
  }
  return null;
}

function findResourceAddressForPlanRef(
  ref: string,
  changes: readonly PlanRc[],
  resourceType: string,
): string | null {
  const t = ref.trim();
  if (!t) {
    return null;
  }
  if (t.endsWith(".arn")) {
    const withoutArn = findResourceAddressForPlanRef(
      t.slice(0, -4),
      changes,
      resourceType,
    );
    if (withoutArn) {
      return withoutArn;
    }
  }
  for (const rc of changes) {
    if (rc.type !== resourceType || !rc.address) {
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
    const id = typeof pv.id === "string" ? pv.id : "";
    if ((arn && t === arn) || (name && t === name) || (id && t === id)) {
      return rc.address;
    }
  }
  if (!t.includes("::")) {
    const stackIds = new Set<string>();
    for (const rc of changes) {
      const parsed = parseStackAddress(rc.address ?? "");
      if (parsed) {
        stackIds.add(parsed.stackId);
      }
    }
    const qualifiedMatches: string[] = [];
    for (const stackId of stackIds) {
      const qualified = prefixStackAddress(stackId, stripIndexes(t));
      for (const rc of changes) {
        if (rc.type === resourceType && rc.address === qualified) {
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

function findSingletonInModuleScope(
  nodes: TerraformPlanNodesMap,
  scope: TopologyModuleScope,
  resourceType: string,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const matches: string[] = [];
  for (const path of candidatesForType(nodesByType, resourceType, nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (getResourceType(path, nodes[path]) !== resourceType) {
      continue;
    }
    if (moduleScopesMatch(topologyModuleScopeForAddress(path), scope)) {
      matches.push(path);
    }
  }
  return matches.length === 1 ? matches[0]! : null;
}

function capacityProviderStrategyBlocks(
  values: Record<string, unknown>,
): Record<string, unknown>[] {
  const raw = values.capacity_provider_strategy;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((b): b is Record<string, unknown> => isPlainObject(b));
}

function autoScalingGroupProviderBlock(
  cpValues: Record<string, unknown>,
): Record<string, unknown> | null {
  const raw = cpValues.auto_scaling_group_provider;
  if (isPlainObject(raw)) {
    return raw;
  }
  if (Array.isArray(raw) && isPlainObject(raw[0])) {
    return raw[0];
  }
  return null;
}

function launchTemplateBlocks(
  asgValues: Record<string, unknown>,
): Record<string, unknown>[] {
  const raw = asgValues.launch_template;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((b): b is Record<string, unknown> => isPlainObject(b));
}

function iamInstanceProfileBlocks(
  ltValues: Record<string, unknown>,
): Record<string, unknown>[] {
  const raw = ltValues.iam_instance_profile;
  if (isPlainObject(raw)) {
    return [raw];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((b): b is Record<string, unknown> => isPlainObject(b));
}

function resolveCapacityProviderByName(
  nodes: TerraformPlanNodesMap,
  scope: TopologyModuleScope,
  cpName: string,
  changes: readonly PlanRc[],
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const name = cpName.trim();
  if (!name) {
    return null;
  }
  for (const path of candidatesForType(
    nodesByType,
    "aws_ecs_capacity_provider",
    nodes,
  )) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (getResourceType(path, nodes[path]) !== "aws_ecs_capacity_provider") {
      continue;
    }
    if (!moduleScopesMatch(topologyModuleScopeForAddress(path), scope)) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(
      getPrimaryResource(nodes[path])!,
    );
    if (typeof values.name === "string" && values.name === name) {
      return path;
    }
  }
  for (const rc of changes) {
    if (rc.type !== "aws_ecs_capacity_provider" || !rc.address) {
      continue;
    }
    if (!moduleScopesMatch(topologyModuleScopeForAddress(rc.address), scope)) {
      continue;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (pv && typeof pv.name === "string" && pv.name === name) {
      return rc.address;
    }
  }
  return findResourceAddressForPlanRef(
    name,
    changes,
    "aws_ecs_capacity_provider",
  );
}

export type EcsEc2CapacityChain = {
  capacityProvider: string;
  autoscalingGroup: string | null;
  launchTemplate: string | null;
  instanceProfile: string | null;
};

export function isEc2BackedEcsService(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  serviceValues?: Record<string, unknown>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): boolean {
  const node = nodes[serviceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_ecs_service") {
    return false;
  }
  const values = serviceValues ?? mergeTerraformPlanResourceValues(primary);
  if (values.launch_type === "FARGATE") {
    return false;
  }
  if (capacityProviderStrategyBlocks(values).length > 0) {
    return true;
  }
  const taskDefPath = resolveEcsTaskDefinitionPath(
    nodes,
    serviceAddress,
    values.task_definition,
    arnIndex,
    nodesByType,
  );
  if (!taskDefPath) {
    return false;
  }
  const taskDefPrimary = getPrimaryResource(nodes[taskDefPath]);
  if (!taskDefPrimary) {
    return false;
  }
  const taskDefValues = mergeTerraformPlanResourceValues(taskDefPrimary);
  const compat = taskDefValues.requires_compatibilities;
  if (Array.isArray(compat) && compat.includes("EC2")) {
    return true;
  }
  return false;
}

function resolveAutoscalingGroupFromCp(
  nodes: TerraformPlanNodesMap,
  cpPath: string,
  scope: TopologyModuleScope,
  changes: readonly PlanRc[],
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const cpPrimary = getPrimaryResource(nodes[cpPath]);
  if (!cpPrimary) {
    return null;
  }
  const cpValues = mergeTerraformPlanResourceValues(cpPrimary);
  const asgProvider = autoScalingGroupProviderBlock(cpValues);
  if (!asgProvider) {
    return null;
  }
  const refs: string[] = [];
  flattenStringish(asgProvider.auto_scaling_group_arn, refs);
  const modulePrefix = terraformModulePrefixForAddress(cpPath);
  for (const ref of refs) {
    const fromNode = resolveNodePathForRef(
      nodes,
      modulePrefix,
      ref,
      "aws_autoscaling_group",
    );
    if (fromNode) {
      return fromNode;
    }
    const fromPlan = findResourceAddressForPlanRef(
      ref,
      changes,
      "aws_autoscaling_group",
    );
    if (fromPlan) {
      return fromPlan;
    }
  }
  return findSingletonInModuleScope(
    nodes,
    scope,
    "aws_autoscaling_group",
    nodesByType,
  );
}

function resolveLaunchTemplateFromAsg(
  nodes: TerraformPlanNodesMap,
  asgPath: string,
  scope: TopologyModuleScope,
  changes: readonly PlanRc[],
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const asgPrimary = getPrimaryResource(nodes[asgPath]);
  if (!asgPrimary) {
    return null;
  }
  const asgValues = mergeTerraformPlanResourceValues(asgPrimary);
  const modulePrefix = terraformModulePrefixForAddress(asgPath);
  for (const block of launchTemplateBlocks(asgValues)) {
    const refs: string[] = [];
    flattenStringish(block.id, refs);
    for (const ref of refs) {
      const fromNode = resolveNodePathForRef(
        nodes,
        modulePrefix,
        ref,
        "aws_launch_template",
      );
      if (fromNode) {
        return fromNode;
      }
      const fromPlan = findResourceAddressForPlanRef(
        ref,
        changes,
        "aws_launch_template",
      );
      if (fromPlan) {
        return fromPlan;
      }
    }
  }
  return findSingletonInModuleScope(
    nodes,
    scope,
    "aws_launch_template",
    nodesByType,
  );
}

function resolveInstanceProfileFromLaunchTemplate(
  nodes: TerraformPlanNodesMap,
  ltPath: string,
  scope: TopologyModuleScope,
  changes: readonly PlanRc[],
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const ltPrimary = getPrimaryResource(nodes[ltPath]);
  if (!ltPrimary) {
    return null;
  }
  const ltValues = mergeTerraformPlanResourceValues(ltPrimary);
  const modulePrefix = terraformModulePrefixForAddress(ltPath);
  for (const block of iamInstanceProfileBlocks(ltValues)) {
    const refs: string[] = [];
    flattenStringish(block.name, refs);
    flattenStringish(block.arn, refs);
    for (const ref of refs) {
      const fromNode = resolveNodePathForRef(
        nodes,
        modulePrefix,
        ref,
        "aws_iam_instance_profile",
      );
      if (fromNode) {
        return fromNode;
      }
      const fromPlan = findResourceAddressForPlanRef(
        ref,
        changes,
        "aws_iam_instance_profile",
      );
      if (fromPlan) {
        return fromPlan;
      }
    }
  }
  return findSingletonInModuleScope(
    nodes,
    scope,
    "aws_iam_instance_profile",
    nodesByType,
  );
}

export function buildEcsEc2CapacityChainsForService(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): EcsEc2CapacityChain[] {
  const node = nodes[serviceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_ecs_service") {
    return [];
  }
  const serviceValues = mergeTerraformPlanResourceValues(primary);
  if (
    !isEc2BackedEcsService(
      nodes,
      serviceAddress,
      arnIndex,
      serviceValues,
      nodesByType,
    )
  ) {
    return [];
  }

  const scope = topologyModuleScopeForAddress(serviceAddress);
  const changes = planChangesFromPlan(plan);
  const strategies = capacityProviderStrategyBlocks(serviceValues);
  const chains: EcsEc2CapacityChain[] = [];

  const buildChainForCp = (cpPath: string): void => {
    const asgPath = resolveAutoscalingGroupFromCp(
      nodes,
      cpPath,
      scope,
      changes,
      nodesByType,
    );
    const ltPath = asgPath
      ? resolveLaunchTemplateFromAsg(nodes, asgPath, scope, changes, nodesByType)
      : null;
    const profilePath = ltPath
      ? resolveInstanceProfileFromLaunchTemplate(
          nodes,
          ltPath,
          scope,
          changes,
          nodesByType,
        )
      : null;
    chains.push({
      capacityProvider: cpPath,
      autoscalingGroup: asgPath,
      launchTemplate: ltPath,
      instanceProfile: profilePath,
    });
  };

  if (strategies.length === 0) {
    const singletonCp = findSingletonInModuleScope(
      nodes,
      scope,
      "aws_ecs_capacity_provider",
      nodesByType,
    );
    if (singletonCp) {
      buildChainForCp(singletonCp);
    }
    return chains;
  }

  const seenCp = new Set<string>();
  for (const block of strategies) {
    const cpRefs: string[] = [];
    flattenStringish(block.capacity_provider, cpRefs);
    let cpPath: string | null = null;
    for (const ref of cpRefs) {
      cpPath =
        resolveNodePathForRef(
          nodes,
          scope.modulePrefix,
          ref,
          "aws_ecs_capacity_provider",
        ) ??
        resolveCapacityProviderByName(nodes, scope, ref, changes, nodesByType);
      if (cpPath) {
        break;
      }
    }
    if (!cpPath) {
      cpPath = findSingletonInModuleScope(
        nodes,
        scope,
        "aws_ecs_capacity_provider",
        nodesByType,
      );
    }
    if (!cpPath || seenCp.has(cpPath)) {
      continue;
    }
    seenCp.add(cpPath);
    buildChainForCp(cpPath);
  }

  return chains;
}

export function resolveEcsClusterPathFromService(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const node = nodes[serviceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_ecs_service") {
    return null;
  }
  const serviceValues = mergeTerraformPlanResourceValues(primary);
  const refs: string[] = [];
  flattenStringish(serviceValues.cluster, refs);
  const scope = topologyModuleScopeForAddress(serviceAddress);
  const changes = planChangesFromPlan(plan);
  const modulePrefix = scope.modulePrefix;

  for (const ref of refs) {
    const fromNode = resolveNodePathForRef(
      nodes,
      modulePrefix,
      ref,
      "aws_ecs_cluster",
    );
    if (fromNode) {
      return fromNode;
    }
    const fromPlan = findResourceAddressForPlanRef(
      ref,
      changes,
      "aws_ecs_cluster",
    );
    if (fromPlan) {
      return fromPlan;
    }
    const bare = stripTerraformAttributeSuffix(ref);
    for (const path of candidatesForType(nodesByType, "aws_ecs_cluster", nodes)) {
      if (getResourceType(path, nodes[path]) !== "aws_ecs_cluster") {
        continue;
      }
      if (!moduleScopesMatch(topologyModuleScopeForAddress(path), scope)) {
        continue;
      }
      const cv = mergeTerraformPlanResourceValues(
        getPrimaryResource(nodes[path])!,
      );
      if (
        (typeof cv.name === "string" && cv.name === bare) ||
        (typeof cv.id === "string" && cv.id === bare) ||
        (typeof cv.arn === "string" && cv.arn === bare)
      ) {
        return path;
      }
    }
  }

  return findSingletonInModuleScope(nodes, scope, "aws_ecs_cluster", nodesByType);
}

function resolveClusterCapacityProvidersPath(
  nodes: TerraformPlanNodesMap,
  clusterPath: string,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const clusterPrimary = getPrimaryResource(nodes[clusterPath]);
  if (!clusterPrimary) {
    return null;
  }
  const clusterValues = mergeTerraformPlanResourceValues(clusterPrimary);
  const clusterName =
    typeof clusterValues.name === "string" ? clusterValues.name : "";
  const scope = topologyModuleScopeForAddress(clusterPath);
  const changes = planChangesFromPlan(plan);

  for (const path of candidatesForType(
    nodesByType,
    "aws_ecs_cluster_capacity_providers",
    nodes,
  )) {
    if (
      getResourceType(path, nodes[path]) !==
      "aws_ecs_cluster_capacity_providers"
    ) {
      continue;
    }
    if (!moduleScopesMatch(topologyModuleScopeForAddress(path), scope)) {
      continue;
    }
    const pv = mergeTerraformPlanResourceValues(
      getPrimaryResource(nodes[path])!,
    );
    const cn = typeof pv.cluster_name === "string" ? pv.cluster_name : "";
    if (clusterName && cn === clusterName) {
      return path;
    }
  }

  for (const rc of changes) {
    if (rc.type !== "aws_ecs_cluster_capacity_providers" || !rc.address) {
      continue;
    }
    if (!moduleScopesMatch(topologyModuleScopeForAddress(rc.address), scope)) {
      continue;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (pv && clusterName && pv.cluster_name === clusterName) {
      return rc.address;
    }
  }

  return findSingletonInModuleScope(
    nodes,
    scope,
    "aws_ecs_cluster_capacity_providers",
    nodesByType,
  );
}

export type EcsClusterCompanionCluster = {
  service: string;
  clusterPath: string | null;
  clusterCapacityProvidersPath: string | null;
};

export function buildEcsClusterCompanionCluster(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: EcsClusterCompanionCluster | null; edges: TopologyIamEdge[] } {
  const clusterPath = resolveEcsClusterPathFromService(
    nodes,
    serviceAddress,
    plan,
    nodesByType,
  );
  if (!clusterPath) {
    return { cluster: null, edges: [] };
  }
  const cpRegistration = resolveClusterCapacityProvidersPath(
    nodes,
    clusterPath,
    plan,
    nodesByType,
  );
  const edges: TopologyIamEdge[] = [
    {
      source: serviceAddress,
      target: clusterPath,
      type: "ecs_cluster",
      label: "cluster",
    },
  ];
  if (cpRegistration) {
    edges.push({
      source: clusterPath,
      target: cpRegistration,
      type: "ecs_cluster_capacity_providers",
      label: "capacity providers",
    });
  }
  return {
    cluster: {
      service: serviceAddress,
      clusterPath,
      clusterCapacityProvidersPath: cpRegistration,
    },
    edges,
  };
}

export type EcsEc2CapacityCompanionCluster = {
  service: string;
  chains: EcsEc2CapacityChain[];
};

export function buildEcsEc2CapacityCompanionCluster(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): {
  cluster: EcsEc2CapacityCompanionCluster | null;
  edges: TopologyIamEdge[];
} {
  const chains = buildEcsEc2CapacityChainsForService(
    nodes,
    serviceAddress,
    arnIndex,
    plan,
    nodesByType,
  );
  if (chains.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [];
  for (const chain of chains) {
    edges.push({
      source: serviceAddress,
      target: chain.capacityProvider,
      type: "ecs_capacity_provider",
      label: "capacity provider",
    });
    if (chain.autoscalingGroup) {
      edges.push({
        source: chain.capacityProvider,
        target: chain.autoscalingGroup,
        type: "autoscaling_group",
        label: "ASG",
      });
    }
    if (chain.launchTemplate) {
      edges.push({
        source: chain.autoscalingGroup ?? chain.capacityProvider,
        target: chain.launchTemplate,
        type: "launch_template",
        label: "launch template",
      });
    }
    if (chain.instanceProfile) {
      edges.push({
        source: chain.launchTemplate ?? chain.capacityProvider,
        target: chain.instanceProfile,
        type: "iam_instance_profile",
        label: "instance profile",
      });
    }
  }

  return {
    cluster: { service: serviceAddress, chains },
    edges,
  };
}

// --- workload band (task definition + logs) ---

function parseContainerDefinitions(value: unknown): Record<string, unknown>[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((entry): entry is Record<string, unknown> =>
    Boolean(entry && typeof entry === "object" && !Array.isArray(entry)),
  );
}

function resolveLogGroupPathFromText(
  nodes: TerraformPlanNodesMap,
  modulePrefix: string,
  text: string,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const graph = nodes as Record<string, TerraformPlanGraphNode>;
  for (const candidate of [
    trimmed,
    stripIndexes(trimmed),
    stripTerraformAttributeSuffix(trimmed),
    stripIndexes(stripTerraformAttributeSuffix(trimmed)),
  ]) {
    const direct = resolveTerraformPlanNodeKey(graph, candidate);
    if (
      direct &&
      getResourceType(direct, nodes[direct]) === "aws_cloudwatch_log_group"
    ) {
      return direct;
    }
  }
  const bareRef = stripTerraformAttributeSuffix(trimmed);
  const qualified =
    bareRef.startsWith("module.") || bareRef.startsWith("aws_")
      ? bareRef
      : modulePrefix
      ? `${modulePrefix}.${bareRef}`
      : bareRef;
  const resolved = resolveTerraformPlanNodeKey(graph, stripIndexes(qualified));
  if (
    resolved &&
    getResourceType(resolved, nodes[resolved]) === "aws_cloudwatch_log_group"
  ) {
    return resolved;
  }
  return null;
}

/** Log groups referenced from `container_definitions` (`awslogs-group`). */
export function collectLogGroupPathsForTaskDefinition(
  nodes: TerraformPlanNodesMap,
  taskDefPath: string | null,
): string[] {
  if (!taskDefPath) {
    return [];
  }
  const node = nodes[taskDefPath] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary) {
    return [];
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const modulePrefix = terraformModulePrefixForAddress(taskDefPath);
  const out = new Set<string>();

  for (const container of parseContainerDefinitions(
    values.container_definitions,
  )) {
    const logConfiguration = container.logConfiguration;
    if (!isPlainObject(logConfiguration)) {
      continue;
    }
    const options = logConfiguration.options;
    if (!isPlainObject(options)) {
      continue;
    }
    const refs: string[] = [];
    flattenStringish(options["awslogs-group"], refs);
    flattenStringish(options.awslogs_group, refs);
    for (const ref of refs) {
      const path = resolveLogGroupPathFromText(nodes, modulePrefix, ref);
      if (path) {
        out.add(path);
      }
    }
  }

  return [...out].sort();
}

export function ecsServiceCompanionLogGroupPaths(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const node = nodes[serviceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_ecs_service") {
    return [];
  }
  const serviceValues = mergeTerraformPlanResourceValues(primary);
  const taskDefPath = resolveEcsTaskDefinitionPath(
    nodes,
    serviceAddress,
    serviceValues.task_definition,
    arnIndex,
    nodesByType,
  );
  const out = new Set<string>();
  for (const path of collectLogGroupPathsForTaskDefinition(
    nodes,
    taskDefPath,
  )) {
    out.add(path);
  }
  const attachment = getCloudWatchAttachmentIndex(nodes).get(serviceAddress);
  for (const path of attachment?.logGroups ?? []) {
    out.add(path);
  }
  return [...out].sort();
}

export type EcsServiceCompanionCluster = {
  service: string;
  /** `[taskDefinition, ...logGroups]` */
  stack: string[];
};

export function buildEcsServiceCompanionCluster(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: EcsServiceCompanionCluster | null; edges: TopologyIamEdge[] } {
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
  const logGroups = ecsServiceCompanionLogGroupPaths(
    nodes,
    serviceAddress,
    arnIndex,
    nodesByType,
  );
  if (!taskDefPath && logGroups.length === 0) {
    return { cluster: null, edges: [] };
  }

  const stack: string[] = [];
  if (taskDefPath) {
    stack.push(taskDefPath);
  }
  for (const lg of logGroups) {
    if (!stack.includes(lg)) {
      stack.push(lg);
    }
  }

  const edges: TopologyIamEdge[] = [];
  if (taskDefPath) {
    edges.push({
      source: serviceAddress,
      target: taskDefPath,
      type: "ecs_task_definition",
      label: "task definition",
    });
  }
  for (const lg of logGroups) {
    edges.push({
      source: taskDefPath ?? serviceAddress,
      target: lg,
      type: "cloudwatch_log_group",
      label: "log group",
    });
  }

  return { cluster: { service: serviceAddress, stack }, edges };
}

function chainStackHeightPx(
  chains: EcsEc2CapacityChain[],
  tier1H: number,
  tier2H: number,
  gap: number,
): number {
  if (chains.length === 0) {
    return 0;
  }
  let h = gap;
  for (const chain of chains) {
    h += tier1H + gap;
    const tier2Count = [
      chain.autoscalingGroup,
      chain.launchTemplate,
      chain.instanceProfile,
    ].filter(Boolean).length;
    h += tier2Count * (tier2H + gap);
  }
  return h;
}

export function ecsEc2SatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
  satelliteGap: number,
  plan?: unknown,
): number {
  const chains = buildEcsEc2CapacityChainsForService(
    nodes,
    serviceAddress,
    arnIndex,
    plan,
  );
  return chainStackHeightPx(
    chains,
    tier1SatelliteH,
    tier2SatelliteH,
    satelliteGap,
  );
}

export function ecsClusterSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
  satelliteGap: number,
  plan?: unknown,
): number {
  const { cluster } = buildEcsClusterCompanionCluster(
    nodes,
    serviceAddress,
    plan,
  );
  if (!cluster?.clusterPath) {
    return 0;
  }
  let h = satelliteGap + tier1SatelliteH + satelliteGap;
  if (cluster.clusterCapacityProvidersPath) {
    h += tier2SatelliteH + satelliteGap;
  }
  return h;
}

export function ecsSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  serviceAddress: string,
  arnIndex: Map<string, string>,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildEcsServiceCompanionCluster(
    nodes,
    serviceAddress,
    arnIndex,
  );
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  let h = satelliteGap;
  for (const addr of cluster.stack) {
    const t = getResourceType(addr, nodes[addr] as TerraformPlanGraphNode);
    const tileH =
      t === "aws_ecs_task_definition" ? tier1SatelliteH : tier2SatelliteH;
    h += tileH + satelliteGap;
  }
  return h;
}

function collectAddressesFromEcsClusters(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
  plan?: unknown,
): Set<string> {
  const consumed = new Set<string>();
  for (const addr of addresses) {
    const n = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_ecs_service") {
      continue;
    }
    const { cluster: workload } = buildEcsServiceCompanionCluster(
      nodes,
      addr,
      arnIndex,
    );
    if (workload) {
      for (const s of workload.stack) {
        consumed.add(s);
      }
    }
    const { cluster: ecsCluster } = buildEcsClusterCompanionCluster(
      nodes,
      addr,
      plan,
    );
    if (ecsCluster?.clusterPath) {
      consumed.add(ecsCluster.clusterPath);
    }
    if (ecsCluster?.clusterCapacityProvidersPath) {
      consumed.add(ecsCluster.clusterCapacityProvidersPath);
    }
    const { cluster: ec2 } = buildEcsEc2CapacityCompanionCluster(
      nodes,
      addr,
      arnIndex,
      plan,
    );
    for (const chain of ec2?.chains ?? []) {
      consumed.add(chain.capacityProvider);
      if (chain.autoscalingGroup) {
        consumed.add(chain.autoscalingGroup);
      }
      if (chain.launchTemplate) {
        consumed.add(chain.launchTemplate);
      }
      if (chain.instanceProfile) {
        consumed.add(chain.instanceProfile);
      }
    }
  }
  return consumed;
}

export function collectEcsClusterSatelliteAddressesForTopologyList(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
  plan?: unknown,
): Set<string> {
  return collectAddressesFromEcsClusters(nodes, arnIndex, addresses, plan);
}

export function filterTopologyAddressesExcludingEcsSatellites(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
  plan?: unknown,
): string[] {
  const consumed = collectAddressesFromEcsClusters(
    nodes,
    arnIndex,
    addresses,
    plan,
  );
  return addresses.filter((addr) => !consumed.has(addr));
}

export function isEcsCompanionConsumedAsSatellite(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  address: string,
  plan?: unknown,
): boolean {
  const consumed = collectAddressesFromEcsClusters(
    nodes,
    arnIndex,
    Object.keys(nodes).filter(
      (p) => p !== TERRAFORM_MODULE_TREE_KEY && !p.startsWith("__"),
    ),
    plan,
  );
  return consumed.has(address);
}

export function resolveEcsCompanionParentServiceAddressFromPlan(
  companionRc: PlanRc,
  changes: readonly PlanRc[],
): string | null {
  const t = companionRc.type;
  const address = companionRc.address;
  if (!t || !address) {
    return null;
  }

  if (t === "aws_ecs_capacity_provider") {
    const pv = pickResourceValuesForTopologyPlacement(companionRc);
    const cpName = typeof pv?.name === "string" ? pv.name : "";
    for (const rc of changes) {
      if (rc.type !== "aws_ecs_service" || !rc.address) {
        continue;
      }
      const sv = pickResourceValuesForTopologyPlacement(rc);
      if (!sv) {
        continue;
      }
      for (const block of capacityProviderStrategyBlocks(sv)) {
        const refs: string[] = [];
        flattenStringish(block.capacity_provider, refs);
        for (const ref of refs) {
          if (
            planRefMatchesResourceAddress(ref, address) ||
            (cpName && (ref === cpName || ref.endsWith(`.${cpName}`)))
          ) {
            return rc.address;
          }
        }
      }
    }
  }

  if (t === "aws_autoscaling_group") {
    const pv = pickResourceValuesForTopologyPlacement(companionRc);
    const asgArn = typeof pv?.arn === "string" ? pv.arn : "";
    for (const rc of changes) {
      if (rc.type !== "aws_ecs_capacity_provider" || !rc.address) {
        continue;
      }
      const cpv = pickResourceValuesForTopologyPlacement(rc);
      if (!cpv) {
        continue;
      }
      const asgProvider = autoScalingGroupProviderBlock(cpv);
      if (!asgProvider) {
        continue;
      }
      const refs: string[] = [];
      flattenStringish(asgProvider.auto_scaling_group_arn, refs);
      for (const ref of refs) {
        if (
          planRefMatchesResourceAddress(ref, address) ||
          (asgArn && ref === asgArn)
        ) {
          const parent = resolveEcsCompanionParentServiceAddressFromPlan(
            rc,
            changes,
          );
          if (parent) {
            return parent;
          }
        }
      }
    }
  }

  if (t === "aws_launch_template") {
    for (const rc of changes) {
      if (rc.type !== "aws_autoscaling_group" || !rc.address) {
        continue;
      }
      const asgv = pickResourceValuesForTopologyPlacement(rc);
      if (!asgv) {
        continue;
      }
      for (const block of launchTemplateBlocks(asgv)) {
        const refs: string[] = [];
        flattenStringish(block.id, refs);
        for (const ref of refs) {
          if (planRefMatchesResourceAddress(ref, address)) {
            const parent = resolveEcsCompanionParentServiceAddressFromPlan(
              rc,
              changes,
            );
            if (parent) {
              return parent;
            }
          }
        }
      }
    }
  }

  if (t === "aws_iam_instance_profile") {
    for (const rc of changes) {
      if (rc.type !== "aws_launch_template" || !rc.address) {
        continue;
      }
      const ltv = pickResourceValuesForTopologyPlacement(rc);
      if (!ltv) {
        continue;
      }
      for (const block of iamInstanceProfileBlocks(ltv)) {
        const refs: string[] = [];
        flattenStringish(block.name, refs);
        flattenStringish(block.arn, refs);
        for (const ref of refs) {
          if (planRefMatchesResourceAddress(ref, address)) {
            const parent = resolveEcsCompanionParentServiceAddressFromPlan(
              rc,
              changes,
            );
            if (parent) {
              return parent;
            }
          }
        }
      }
    }
  }

  if (t === "aws_ecs_cluster") {
    for (const rc of changes) {
      if (rc.type !== "aws_ecs_service" || !rc.address) {
        continue;
      }
      const sv = pickResourceValuesForTopologyPlacement(rc);
      if (!sv) {
        continue;
      }
      const refs: string[] = [];
      flattenStringish(sv.cluster, refs);
      for (const ref of refs) {
        if (planRefMatchesResourceAddress(ref, address)) {
          return rc.address;
        }
      }
    }
  }

  if (t === "aws_ecs_cluster_capacity_providers") {
    const pv = pickResourceValuesForTopologyPlacement(companionRc);
    const clusterName =
      typeof pv?.cluster_name === "string" ? pv.cluster_name : "";
    for (const rc of changes) {
      if (rc.type !== "aws_ecs_cluster" || !rc.address) {
        continue;
      }
      const cv = pickResourceValuesForTopologyPlacement(rc);
      if (cv && clusterName && cv.name === clusterName) {
        return resolveEcsCompanionParentServiceAddressFromPlan(rc, changes);
      }
    }
  }

  return null;
}
