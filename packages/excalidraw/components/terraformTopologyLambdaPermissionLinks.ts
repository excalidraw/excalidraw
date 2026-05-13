/**
 * Semantic topology: `aws_lambda_permission` resources as satellites of their target
 * `aws_lambda_function` (left column, tier-2 tiles).
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
import { pickResourceValuesForTopologyPlacement } from "./terraformTopologyExtract";

type PlanRc = Parameters<typeof pickResourceValuesForTopologyPlacement>[0];

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

function isLambdaNode(nodes: TerraformPlanNodesMap, path: string): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_lambda_function";
}

/**
 * Resolve `function_name` on `aws_lambda_permission` to a `nodes` key for `aws_lambda_function`.
 */
export function resolveLambdaPermissionTargetLambdaAddress(
  nodes: TerraformPlanNodesMap,
  permissionAddress: string,
  arnIndex: Map<string, string>,
): string | null {
  const node = nodes[permissionAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_lambda_permission") {
    return null;
  }
  const values = mergeTerraformPlanResourceValues(primary);
  return resolveLambdaPermissionFromFunctionNameField(
    nodes,
    values.function_name,
    arnIndex,
    terraformModulePrefixForAddress(permissionAddress),
  );
}

function resolveLambdaPermissionFromFunctionNameField(
  nodes: TerraformPlanNodesMap,
  functionNameField: unknown,
  arnIndex: Map<string, string>,
  permissionModulePrefix: string,
): string | null {
  const strings: string[] = [];
  flattenStringish(functionNameField, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const raw of strings) {
    const t = raw.trim();
    if (!t) {
      continue;
    }
    if (t.startsWith("arn:aws:lambda:")) {
      const byArn = arnIndex.get(t);
      if (byArn && isLambdaNode(nodes, byArn)) {
        return byArn;
      }
    }
    const byStrip = resolveTerraformPlanNodeKey(graphNodes, stripIndexes(t));
    if (byStrip && isLambdaNode(nodes, byStrip)) {
      return byStrip;
    }
    const byFull = resolveTerraformPlanNodeKey(graphNodes, t);
    if (byFull && isLambdaNode(nodes, byFull)) {
      return byFull;
    }

    /** Parity with {@link resolveLambdaPermissionTargetLambdaAddressFromPlan}: any-module ARN / address / `function_name` match. */
    for (const path of Object.keys(nodes)) {
      if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
        continue;
      }
      const pr = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
      if (!pr || pr.type !== "aws_lambda_function") {
        continue;
      }
      const mv = mergeTerraformPlanResourceValues(pr);
      const arn = typeof mv.arn === "string" ? mv.arn : "";
      const fnName =
        typeof mv.function_name === "string" ? mv.function_name : "";
      if (t === arn || t === path || (fnName !== "" && t === fnName)) {
        return path;
      }
    }
  }

  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (terraformModulePrefixForAddress(path) !== permissionModulePrefix) {
      continue;
    }
    const pr = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!pr || pr.type !== "aws_lambda_function") {
      continue;
    }
    const mv = mergeTerraformPlanResourceValues(pr);
    const fnName =
      typeof mv.function_name === "string" ? mv.function_name : null;
    if (!fnName) {
      continue;
    }
    for (const s of strings) {
      if (fnName === s.trim()) {
        return path;
      }
    }
  }

  return null;
}

/**
 * Plan-only resolver for [`extractPrimaryTopologyZones`](terraformTopologyPlacement.ts)
 * (no `nodes` map yet).
 */
export function resolveLambdaPermissionTargetLambdaAddressFromPlan(
  permissionRc: PlanRc,
  changes: readonly PlanRc[],
): string | null {
  const pv = pickResourceValuesForTopologyPlacement(permissionRc);
  if (!pv) {
    return null;
  }
  const strings: string[] = [];
  flattenStringish(pv.function_name, strings);
  const permAddr =
    typeof permissionRc.address === "string" ? permissionRc.address : "";
  const permMod = terraformModulePrefixForAddress(permAddr);

  for (const raw of strings) {
    const t = raw.trim();
    if (!t) {
      continue;
    }
    for (const rc of changes) {
      if (rc.type !== "aws_lambda_function" || !rc.address) {
        continue;
      }
      const lv = pickResourceValuesForTopologyPlacement(rc);
      if (!lv) {
        continue;
      }
      const arn = typeof lv.arn === "string" ? lv.arn : "";
      const fnName =
        typeof lv.function_name === "string" ? lv.function_name : "";
      if (t === arn || t === rc.address || (fnName && t === fnName)) {
        return rc.address;
      }
    }
  }

  for (const s of strings) {
    const want = s.trim();
    if (!want) {
      continue;
    }
    for (const rc of changes) {
      if (rc.type !== "aws_lambda_function" || !rc.address) {
        continue;
      }
      if (terraformModulePrefixForAddress(rc.address) !== permMod) {
        continue;
      }
      const lv = pickResourceValuesForTopologyPlacement(rc);
      if (!lv) {
        continue;
      }
      const fnName =
        typeof lv.function_name === "string" ? lv.function_name : "";
      if (fnName && fnName === want) {
        return rc.address;
      }
    }
  }

  return null;
}

export type LambdaPermissionCluster = {
  lambda: string;
  stack: string[];
};

export function buildLambdaPermissionCluster(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  arnIndex: Map<string, string>,
): { cluster: LambdaPermissionCluster | null; edges: TopologyIamEdge[] } {
  const ln = nodes[lambdaAddress] as TerraformPlanGraphNode | undefined;
  const lp = getPrimaryResource(ln);
  if (!lp || lp.type !== "aws_lambda_function") {
    return { cluster: null, edges: [] };
  }

  const paths: string[] = [];
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const resolved = resolveLambdaPermissionTargetLambdaAddress(
      nodes,
      path,
      arnIndex,
    );
    if (resolved === lambdaAddress) {
      paths.push(path);
    }
  }
  paths.sort((a, b) => a.localeCompare(b));
  if (paths.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = paths.map((p) => ({
    source: lambdaAddress,
    target: p,
    type: "lambda_permission",
    label: "permission",
  }));

  return { cluster: { lambda: lambdaAddress, stack: paths }, edges };
}

export function lambdaPermissionSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  lambdaAddress: string,
  arnIndex: Map<string, string>,
  tier2SatelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildLambdaPermissionCluster(
    nodes,
    lambdaAddress,
    arnIndex,
  );
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  return satelliteGap + cluster.stack.length * (tier2SatelliteH + satelliteGap);
}

export function collectLambdaPermissionSatelliteAddressesForTopologyList(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
): Set<string> {
  const consumed = new Set<string>();
  for (const addr of addresses) {
    const n = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_lambda_function") {
      continue;
    }
    const { cluster } = buildLambdaPermissionCluster(nodes, addr, arnIndex);
    if (!cluster) {
      continue;
    }
    for (const s of cluster.stack) {
      consumed.add(s);
    }
  }
  return consumed;
}

export function filterTopologyAddressesExcludingLambdaPermissionSatellites(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
): string[] {
  const consumed = collectLambdaPermissionSatelliteAddressesForTopologyList(
    nodes,
    arnIndex,
    addresses,
  );
  return [...addresses].filter((a) => !consumed.has(a));
}
