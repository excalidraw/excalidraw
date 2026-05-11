/**
 * Semantic topology: resolve Lambda CloudWatch alarms and log groups from the
 * Terraform plan-shaped `nodes` map.
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

function addUnique(map: Map<string, string>, key: string, path: string): void {
  const k = key.trim();
  if (!k || map.has(k)) {
    return;
  }
  map.set(k, path);
}

function buildLambdaNameIndex(nodes: TerraformPlanNodesMap): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, node] of Object.entries(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (getResourceTypeFromPath(path, node as TerraformPlanGraphNode) !== "aws_lambda_function") {
      continue;
    }
    const primary = getPrimaryResource(node as TerraformPlanGraphNode);
    if (!primary) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(primary);
    if (typeof values.function_name === "string") {
      addUnique(map, values.function_name, path);
    }
    if (typeof values.id === "string") {
      addUnique(map, values.id, path);
    }
    if (typeof primary.name === "string") {
      addUnique(map, primary.name, path);
    }
    addUnique(map, path, path);
    addUnique(map, stripIndexes(path), path);
  }
  return map;
}

function lambdaPathFromText(
  nodes: TerraformPlanNodesMap,
  lambdaIndex: Map<string, string>,
  text: string,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const directName = lambdaIndex.get(trimmed);
  if (directName) {
    return directName;
  }
  const graph = nodes as Record<string, TerraformPlanGraphNode>;
  for (const candidate of [trimmed, stripIndexes(trimmed)]) {
    const key = resolveTerraformPlanNodeKey(graph, candidate);
    if (
      key &&
      getResourceTypeFromPath(key, nodes[key] as TerraformPlanGraphNode) ===
        "aws_lambda_function"
    ) {
      return key;
    }
  }
  return null;
}

function inferSoleLambdaInModuleFamily(
  nodes: TerraformPlanNodesMap,
  sourceAddress: string,
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
    if (getResourceTypeFromPath(path, node as TerraformPlanGraphNode) !== "aws_lambda_function") {
      continue;
    }
    const lambdaPrefix = terraformModulePrefixForAddress(path);
    if (
      lambdaPrefix === sourcePrefix ||
      lambdaPrefix.startsWith(`${sourcePrefix}.`) ||
      sourcePrefix.startsWith(`${lambdaPrefix}.`)
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
  lambdaIndex: Map<string, string>,
): string | null {
  if (values.namespace !== "AWS/Lambda") {
    return null;
  }
  const dimensions = isPlainObject(values.dimensions) ? values.dimensions : {};
  const candidates: string[] = [];
  collectStringish(dimensions.FunctionName, candidates);
  for (const candidate of candidates) {
    const path = lambdaPathFromText(nodes, lambdaIndex, candidate);
    if (path) {
      return path;
    }
  }
  return inferSoleLambdaInModuleFamily(nodes, alarmPath);
}

function resolveLogGroupLambdaPath(
  nodes: TerraformPlanNodesMap,
  logGroupPath: string,
  values: Record<string, unknown>,
  lambdaIndex: Map<string, string>,
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
    const path = lambdaPathFromText(nodes, lambdaIndex, lambdaName);
    if (path) {
      return path;
    }
  }

  return inferSoleLambdaInModuleFamily(nodes, logGroupPath);
}

export type LambdaCloudWatchCluster = {
  lambda: string;
  alarms: string[];
  logGroups: string[];
};

export function buildLambdaCloudWatchCluster(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
): { cluster: LambdaCloudWatchCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[lambdaAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_lambda_function") {
    return { cluster: null, edges: [] };
  }

  const lambdaIndex = buildLambdaNameIndex(nodes);
  const alarms = new Set<string>();
  const logGroups = new Set<string>();

  for (const [path, candidateNode] of Object.entries(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const candidatePrimary = getPrimaryResource(candidateNode as TerraformPlanGraphNode);
    if (!candidatePrimary) {
      continue;
    }
    const type = typeof candidatePrimary.type === "string" ? candidatePrimary.type : "";
    const values = mergeTerraformPlanResourceValues(candidatePrimary);
    if (
      type === "aws_cloudwatch_metric_alarm" &&
      resolveMetricAlarmLambdaPath(nodes, path, values, lambdaIndex) === lambdaAddress
    ) {
      alarms.add(path);
    } else if (
      type === "aws_cloudwatch_log_group" &&
      resolveLogGroupLambdaPath(nodes, path, values, lambdaIndex) === lambdaAddress
    ) {
      logGroups.add(path);
    }
  }

  const sortedAlarms = [...alarms].sort();
  const sortedLogGroups = [...logGroups].sort();
  if (sortedAlarms.length === 0 && sortedLogGroups.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [
    ...sortedAlarms.map((alarmPath) => ({
      source: alarmPath,
      target: lambdaAddress,
      type: "cloudwatch_alarm",
      label: "alarm",
    })),
    ...sortedLogGroups.map((logGroupPath) => ({
      source: logGroupPath,
      target: lambdaAddress,
      type: "cloudwatch_log_group",
      label: "log group",
    })),
  ];

  return {
    cluster: {
      lambda: lambdaAddress,
      alarms: sortedAlarms,
      logGroups: sortedLogGroups,
    },
    edges,
  };
}

export function cloudWatchSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  satelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildLambdaCloudWatchCluster(nodes, address);
  if (!cluster) {
    return 0;
  }
  const stackCount = Math.max(cluster.alarms.length, cluster.logGroups.length);
  return stackCount > 0
    ? satelliteGap + stackCount * (satelliteH + satelliteGap) + satelliteH
    : 0;
}
