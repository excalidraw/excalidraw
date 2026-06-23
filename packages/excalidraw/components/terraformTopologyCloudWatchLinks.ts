/**
 * Semantic topology: resolve CloudWatch alarms and Lambda log groups from the
 * Terraform plan-shaped `nodes` map.
 */

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
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

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

function collectStringish(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringish(item, out);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      collectStringish(v, out);
    }
  }
}

function addUnique(
  map: Map<string, Set<string>>,
  key: string,
  path: string,
): void {
  const k = key.trim();
  if (!k) {
    return;
  }
  if (!map.has(k)) {
    map.set(k, new Set());
  }
  map.get(k)!.add(path);
}

function isCloudWatchSatelliteType(type: string): boolean {
  return (
    type === "aws_cloudwatch_metric_alarm" ||
    type === "aws_cloudwatch_log_group"
  );
}

const CW_SATELLITE_TYPES = new Set([
  "aws_cloudwatch_metric_alarm",
  "aws_cloudwatch_log_group",
]);

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

function buildResourceIdentityIndex(
  nodes: TerraformPlanNodesMap,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [path, node] of Object.entries(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const type = getResourceTypeFromPath(path, node as TerraformPlanGraphNode);
    if (isCloudWatchSatelliteType(type)) {
      continue;
    }
    const primary = getPrimaryResource(node as TerraformPlanGraphNode);
    if (!primary) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(primary);
    addUnique(map, path, path);
    addUnique(map, stripIndexes(path), path);
    for (const field of [
      "arn",
      "id",
      "name",
      "bucket",
      "function_name",
      "queue_name",
      "table_name",
      "identifier",
      "cluster_identifier",
    ]) {
      const value = values[field];
      if (typeof value === "string") {
        addUnique(map, value, path);
      }
    }
  }
  return map;
}

function uniquePathForIdentity(
  identityIndex: Map<string, Set<string>>,
  text: string,
  nodes: TerraformPlanNodesMap,
  expectedType?: string,
): string | null {
  const paths = identityIndex.get(text);
  if (!paths) {
    return null;
  }
  const candidates = expectedType
    ? [...paths].filter(
        (path) => getResourceTypeFromPath(path, nodes[path]) === expectedType,
      )
    : [...paths];
  return candidates.length === 1 ? candidates[0]! : null;
}

function resourcePathFromText(
  nodes: TerraformPlanNodesMap,
  identityIndex: Map<string, Set<string>>,
  text: string,
  expectedType?: string,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const directName = uniquePathForIdentity(
    identityIndex,
    trimmed,
    nodes,
    expectedType,
  );
  if (directName) {
    return directName;
  }
  const graph = nodes as Record<string, TerraformPlanGraphNode>;
  for (const candidate of [trimmed, stripIndexes(trimmed)]) {
    const key = resolveTerraformPlanNodeKey(graph, candidate);
    if (
      key &&
      !isCloudWatchSatelliteType(getResourceTypeFromPath(key, nodes[key])) &&
      (!expectedType ||
        getResourceTypeFromPath(key, nodes[key]) === expectedType)
    ) {
      return key;
    }
  }
  return null;
}

function inferSoleResourceInModuleFamily(
  nodes: TerraformPlanNodesMap,
  sourceAddress: string,
  expectedType?: string,
): string | null {
  const sourcePrefix = terraformModulePrefixForAddress(sourceAddress);
  if (!sourcePrefix) {
    return null;
  }

  const matches: string[] = [];
  for (const [path, node] of Object.entries(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const type = getResourceTypeFromPath(path, node as TerraformPlanGraphNode);
    if (
      isCloudWatchSatelliteType(type) ||
      (expectedType && type !== expectedType)
    ) {
      continue;
    }
    const resourcePrefix = terraformModulePrefixForAddress(path);
    if (
      resourcePrefix === sourcePrefix ||
      resourcePrefix.startsWith(`${sourcePrefix}.`) ||
      sourcePrefix.startsWith(`${resourcePrefix}.`)
    ) {
      matches.push(path);
    }
  }

  const unique = [...new Set(matches)].sort();
  return unique.length === 1 ? unique[0]! : null;
}

function resolveMetricAlarmLambdaPath(
  nodes: TerraformPlanNodesMap,
  alarmPath: string,
  values: Record<string, unknown>,
  identityIndex: Map<string, Set<string>>,
): string | null {
  if (values.namespace !== "AWS/Lambda") {
    return null;
  }
  const dimensions = isPlainObject(values.dimensions) ? values.dimensions : {};
  const candidates: string[] = [];
  collectStringish(dimensions.FunctionName, candidates);
  for (const candidate of candidates) {
    const path = resourcePathFromText(
      nodes,
      identityIndex,
      candidate,
      "aws_lambda_function",
    );
    if (path) {
      return path;
    }
  }
  return inferSoleResourceInModuleFamily(
    nodes,
    alarmPath,
    "aws_lambda_function",
  );
}

function expectedResourceTypesForCloudWatchNamespace(
  namespace: unknown,
): string[] {
  if (namespace === "AWS/Lambda") {
    return ["aws_lambda_function"];
  }
  if (namespace === "AWS/S3") {
    return ["aws_s3_bucket"];
  }
  if (namespace === "AWS/SQS") {
    return ["aws_sqs_queue"];
  }
  if (namespace === "AWS/DynamoDB") {
    return ["aws_dynamodb_table"];
  }
  if (namespace === "AWS/SNS") {
    return ["aws_sns_topic"];
  }
  if (namespace === "AWS/Kinesis") {
    return ["aws_kinesis_stream"];
  }
  if (namespace === "AWS/RDS") {
    return ["aws_db_instance", "aws_rds_cluster"];
  }
  if (namespace === "AWS/ECS") {
    return ["aws_ecs_cluster", "aws_ecs_service"];
  }
  return [];
}

function resolveMetricAlarmResourcePath(
  nodes: TerraformPlanNodesMap,
  values: Record<string, unknown>,
  identityIndex: Map<string, Set<string>>,
): string | null {
  const dimensions = isPlainObject(values.dimensions) ? values.dimensions : {};
  const matches = new Set<string>();
  const expectedTypes = expectedResourceTypesForCloudWatchNamespace(
    values.namespace,
  );

  for (const value of Object.values(dimensions)) {
    const candidates: string[] = [];
    collectStringish(value, candidates);
    for (const candidate of candidates) {
      if (expectedTypes.length > 0) {
        for (const expectedType of expectedTypes) {
          const path = resourcePathFromText(
            nodes,
            identityIndex,
            candidate,
            expectedType,
          );
          if (path) {
            matches.add(path);
          }
        }
      } else {
        const path = resourcePathFromText(nodes, identityIndex, candidate);
        if (path) {
          matches.add(path);
        }
      }
    }
  }

  return matches.size === 1 ? [...matches][0]! : null;
}

function resolveLogGroupLambdaPath(
  nodes: TerraformPlanNodesMap,
  logGroupPath: string,
  values: Record<string, unknown>,
  identityIndex: Map<string, Set<string>>,
): string | null {
  const names: string[] = [];
  collectStringish(values.name, names);
  collectStringish(values.name_prefix, names);

  for (const raw of names) {
    const text = raw.trim();
    if (!text.startsWith("/aws/lambda/")) {
      continue;
    }
    const lambdaName = text.slice("/aws/lambda/".length).replace(/[:*]+$/g, "");
    const path = resourcePathFromText(
      nodes,
      identityIndex,
      lambdaName,
      "aws_lambda_function",
    );
    if (path) {
      return path;
    }
  }

  return inferSoleResourceInModuleFamily(
    nodes,
    logGroupPath,
    "aws_lambda_function",
  );
}

function resolveLogGroupEcsServicePath(
  nodes: TerraformPlanNodesMap,
  logGroupPath: string,
  values: Record<string, unknown>,
  identityIndex: Map<string, Set<string>>,
): string | null {
  const names: string[] = [];
  collectStringish(values.name, names);
  collectStringish(values.name_prefix, names);

  for (const raw of names) {
    const text = raw.trim();
    if (!text.startsWith("/aws/ecs/")) {
      continue;
    }
    const suffix = text.slice("/aws/ecs/".length).replace(/[:*]+$/g, "");
    const path = resourcePathFromText(
      nodes,
      identityIndex,
      suffix,
      "aws_ecs_service",
    );
    if (path) {
      return path;
    }
  }

  return inferSoleResourceInModuleFamily(
    nodes,
    logGroupPath,
    "aws_ecs_service",
  );
}

export type ResourceCloudWatchCluster = {
  resource: string;
  alarms: string[];
  logGroups: string[];
};

type CloudWatchAttachmentIndex = Map<
  string,
  { alarms: Set<string>; logGroups: Set<string> }
>;

const cloudWatchAttachmentIndexCache = new WeakMap<
  TerraformPlanNodesMap,
  CloudWatchAttachmentIndex
>();

function addAttachment(
  index: CloudWatchAttachmentIndex,
  targetPath: string,
  kind: "alarms" | "logGroups",
  sourcePath: string,
): void {
  if (!index.has(targetPath)) {
    index.set(targetPath, { alarms: new Set(), logGroups: new Set() });
  }
  index.get(targetPath)![kind].add(sourcePath);
}

function buildCloudWatchAttachmentIndex(
  nodes: TerraformPlanNodesMap,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): CloudWatchAttachmentIndex {
  const identityIndex = buildResourceIdentityIndex(nodes);
  const attachmentIndex: CloudWatchAttachmentIndex = new Map();

  for (const path of candidatesForTypes(
    nodesByType,
    CW_SATELLITE_TYPES,
    nodes,
  )) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const candidatePrimary = getPrimaryResource(
      nodes[path] as TerraformPlanGraphNode,
    );
    if (!candidatePrimary) {
      continue;
    }
    const type =
      typeof candidatePrimary.type === "string" ? candidatePrimary.type : "";
    const values = mergeTerraformPlanResourceValues(candidatePrimary);
    const target =
      type === "aws_cloudwatch_metric_alarm"
        ? values.namespace === "AWS/Lambda"
          ? resolveMetricAlarmLambdaPath(nodes, path, values, identityIndex) ??
            resolveMetricAlarmResourcePath(nodes, values, identityIndex)
          : resolveMetricAlarmResourcePath(nodes, values, identityIndex)
        : null;
    if (type === "aws_cloudwatch_metric_alarm" && target) {
      addAttachment(attachmentIndex, target, "alarms", path);
    } else if (type === "aws_cloudwatch_log_group") {
      const logGroupTarget =
        resolveLogGroupLambdaPath(nodes, path, values, identityIndex) ??
        resolveLogGroupEcsServicePath(nodes, path, values, identityIndex);
      if (logGroupTarget) {
        addAttachment(attachmentIndex, logGroupTarget, "logGroups", path);
      }
    }
  }

  return attachmentIndex;
}

export function getCloudWatchAttachmentIndex(
  nodes: TerraformPlanNodesMap,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): CloudWatchAttachmentIndex {
  const cached = cloudWatchAttachmentIndexCache.get(nodes);
  if (cached) {
    return cached;
  }
  const built = buildCloudWatchAttachmentIndex(nodes, nodesByType);
  cloudWatchAttachmentIndexCache.set(nodes, built);
  return built;
}

export function buildResourceCloudWatchCluster(
  nodes: TerraformPlanNodesMap,
  resourceAddress: string,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: ResourceCloudWatchCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[resourceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  const resourceType = typeof primary?.type === "string" ? primary.type : "";
  if (!primary || isCloudWatchSatelliteType(resourceType)) {
    return { cluster: null, edges: [] };
  }

  const attachment = getCloudWatchAttachmentIndex(nodes, nodesByType).get(
    resourceAddress,
  );
  const sortedAlarms = [...(attachment?.alarms ?? [])].sort();
  const sortedLogGroups = [...(attachment?.logGroups ?? [])].sort();
  if (sortedAlarms.length === 0 && sortedLogGroups.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [
    ...sortedAlarms.map((alarmPath) => ({
      source: alarmPath,
      target: resourceAddress,
      type: "cloudwatch_alarm",
      label: "alarm",
    })),
    ...sortedLogGroups.map((logGroupPath) => ({
      source: logGroupPath,
      target: resourceAddress,
      type: "cloudwatch_log_group",
      label: "log group",
    })),
  ];

  return {
    cluster: {
      resource: resourceAddress,
      alarms: sortedAlarms,
      logGroups: sortedLogGroups,
    },
    edges,
  };
}

export const buildLambdaCloudWatchCluster = buildResourceCloudWatchCluster;

export function cloudWatchSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  satelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildResourceCloudWatchCluster(nodes, address);
  if (!cluster) {
    return 0;
  }
  const stackCount = Math.max(cluster.alarms.length, cluster.logGroups.length);
  return stackCount > 0
    ? satelliteGap + stackCount * (satelliteH + satelliteGap) + satelliteH
    : 0;
}
