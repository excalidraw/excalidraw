/**
 * Shared Terraform plan reference resolution for topology satellite attachment rules.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  mergeTerraformPlanResourceValues,
  terraformModulePrefixForAddress,
} from "./terraformTopologyIamLinks";
import { pickResourceValuesForTopologyPlacement } from "./terraformTopologyExtract";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export const stripTopologyIndexes = (address: string) =>
  address.replace(/\[[^\]]+\]/g, "");

export function isPlainTopologyObject(
  v: unknown,
): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

export function flattenTopologyStringish(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenTopologyStringish(item, out);
    }
    return;
  }
  if (isPlainTopologyObject(value)) {
    for (const v of Object.values(value)) {
      flattenTopologyStringish(v, out);
    }
  }
}

export function getTopologyPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

export function getTopologyResourceType(
  path: string,
  node: TerraformPlanGraphNode | undefined,
): string {
  const primary = getTopologyPrimaryResource(node);
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

export function isTopologyNodeType(
  nodes: TerraformPlanNodesMap,
  path: string,
  type: string,
): boolean {
  const node = nodes[path] as TerraformPlanGraphNode | undefined;
  const primary = getTopologyPrimaryResource(node);
  return primary?.type === type;
}

/** Resolve string refs to a node path of an expected primary type. */
export function resolveRefToPrimaryPath(
  nodes: TerraformPlanNodesMap,
  ref: unknown,
  arnIndex: Map<string, string>,
  primaryType: string,
): string | null {
  const strings: string[] = [];
  flattenTopologyStringish(ref, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    const byStrip = resolveTerraformPlanNodeKey(
      graphNodes,
      stripTopologyIndexes(s),
    );
    if (byStrip && isTopologyNodeType(nodes, byStrip, primaryType)) {
      return byStrip;
    }
    const byFull = resolveTerraformPlanNodeKey(graphNodes, s);
    if (byFull && isTopologyNodeType(nodes, byFull, primaryType)) {
      return byFull;
    }
    const byArn = arnIndex.get(s);
    if (byArn && isTopologyNodeType(nodes, byArn, primaryType)) {
      return byArn;
    }
  }

  return null;
}

/** Match satellite link field to a specific primary address (lambda permission semantics). */
export function resolveSatelliteLinkToPrimaryAddress(
  nodes: TerraformPlanNodesMap,
  satellitePath: string,
  linkFieldValue: unknown,
  arnIndex: Map<string, string>,
  primaryType: string,
  match: readonly string[],
  plan?: unknown,
): string | null {
  const strings: string[] = [];
  flattenTopologyStringish(linkFieldValue, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const raw of strings) {
    const t = raw.trim();
    if (!t) {
      continue;
    }
    if (match.includes("arn") && t.startsWith("arn:")) {
      const byArn = arnIndex.get(t);
      if (byArn && isTopologyNodeType(nodes, byArn, primaryType)) {
        return byArn;
      }
    }
    if (match.includes("planAddress")) {
      const byStrip = resolveTerraformPlanNodeKey(
        graphNodes,
        stripTopologyIndexes(t),
      );
      if (byStrip && isTopologyNodeType(nodes, byStrip, primaryType)) {
        return byStrip;
      }
      const byFull = resolveTerraformPlanNodeKey(graphNodes, t);
      if (byFull && isTopologyNodeType(nodes, byFull, primaryType)) {
        return byFull;
      }
    }
  }

  if (match.includes("functionName") && primaryType === "aws_lambda_function") {
    const permMod = terraformModulePrefixForAddress(satellitePath);
    const changes = Array.isArray(
      (plan as { resource_changes?: unknown })?.resource_changes,
    )
      ? (
          plan as {
            resource_changes: Array<{ address?: string; type?: string }>;
          }
        ).resource_changes ?? []
      : undefined;

    if (changes) {
      for (const rc of changes) {
        if (rc.type !== primaryType || !rc.address) {
          continue;
        }
        const lv = pickResourceValuesForTopologyPlacement(rc);
        if (!lv) {
          continue;
        }
        const arn = typeof lv.arn === "string" ? lv.arn : "";
        const fnName =
          typeof lv.function_name === "string" ? lv.function_name : "";
        for (const s of strings) {
          const want = s.trim();
          if (
            want === arn ||
            want === rc.address ||
            (fnName && want === fnName)
          ) {
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
          if (rc.type !== primaryType || !rc.address) {
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
    }

    for (const s of strings) {
      const want = s.trim();
      if (!want) {
        continue;
      }
      for (const path of Object.keys(nodes)) {
        if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
          continue;
        }
        if (!isTopologyNodeType(nodes, path, primaryType)) {
          continue;
        }
        const pr = getTopologyPrimaryResource(
          nodes[path] as TerraformPlanGraphNode,
        );
        if (!pr) {
          continue;
        }
        const mv = mergeTerraformPlanResourceValues(pr);
        const arn = typeof mv.arn === "string" ? mv.arn : "";
        const fnName =
          typeof mv.function_name === "string" ? mv.function_name : "";
        if (want === path || want === arn || (fnName && want === fnName)) {
          return path;
        }
      }
    }
  }

  return resolveRefToPrimaryPath(nodes, linkFieldValue, arnIndex, primaryType);
}

export function iterateTopologyNodePaths(
  nodes: TerraformPlanNodesMap,
): string[] {
  return Object.keys(nodes).filter(
    (p) => p !== TERRAFORM_MODULE_TREE_KEY && !p.startsWith("__"),
  );
}
