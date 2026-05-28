/**
 * Semantic topology: stack `aws_ecs_task_definition` and linked CloudWatch log groups
 * under their `aws_ecs_service` primary (same box pattern as ALB companions).
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import { getCloudWatchAttachmentIndex } from "./terraformTopologyCloudWatchLinks";
import {
  mergeTerraformPlanResourceValues,
  resolveEcsTaskDefinitionPath,
  terraformModulePrefixForAddress,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

export const ECS_TOPOLOGY_SATELLITE_TYPES = new Set([
  "aws_ecs_task_definition",
]);

export function isEcsTopologySatelliteResourceType(
  resourceType: string,
): boolean {
  return ECS_TOPOLOGY_SATELLITE_TYPES.has(resourceType);
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

function stripTerraformAttributeSuffix(ref: string): string {
  return ref.replace(/\.(name|id|arn)$/, "");
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
  );
  const logGroups = ecsServiceCompanionLogGroupPaths(
    nodes,
    serviceAddress,
    arnIndex,
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

export function collectEcsClusterSatelliteAddressesForTopologyList(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
): Set<string> {
  const consumed = new Set<string>();
  for (const addr of addresses) {
    const n = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_ecs_service") {
      continue;
    }
    const { cluster } = buildEcsServiceCompanionCluster(nodes, addr, arnIndex);
    if (cluster) {
      for (const s of cluster.stack) {
        consumed.add(s);
      }
    }
  }
  return consumed;
}

export function filterTopologyAddressesExcludingEcsSatellites(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
): string[] {
  const consumed = collectEcsClusterSatelliteAddressesForTopologyList(
    nodes,
    arnIndex,
    addresses,
  );
  return addresses.filter((addr) => !consumed.has(addr));
}

export function isEcsCompanionConsumedAsSatellite(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  address: string,
): boolean {
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_ecs_service") {
      continue;
    }
    const { cluster } = buildEcsServiceCompanionCluster(nodes, path, arnIndex);
    if (cluster?.stack.includes(address)) {
      return true;
    }
  }
  return false;
}
