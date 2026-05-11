/**
 * Semantic topology: attach `aws_kms_key_policy` satellites to parent `aws_kms_key` primaries.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import {
  mergeTerraformPlanResourceValues,
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
 * Resolve `aws_kms_key_policy.key_id` (id string, key ARN, or Terraform reference) to a `nodes` key.
 */
export function resolveKmsKeyIdToNodePath(
  nodes: TerraformPlanNodesMap,
  keyIdRef: unknown,
  arnIndex: Map<string, string>,
): string | null {
  const strings: string[] = [];
  flattenStringish(keyIdRef, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }

    const byStrip = resolveTerraformPlanNodeKey(graphNodes, stripIndexes(s));
    if (byStrip) {
      return byStrip;
    }
    const byFull = resolveTerraformPlanNodeKey(graphNodes, s);
    if (byFull) {
      return byFull;
    }

    const byArn = arnIndex.get(s);
    if (byArn) {
      return byArn;
    }

    for (const [path, node] of Object.entries(nodes)) {
      if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
        continue;
      }
      const primary = getPrimaryResource(node as TerraformPlanGraphNode);
      if (!primary || primary.type !== "aws_kms_key") {
        continue;
      }
      const v = mergeTerraformPlanResourceValues(primary);
      if (typeof v.id === "string" && v.id === s) {
        return path;
      }
      if (typeof v.arn === "string" && v.arn === s) {
        return path;
      }
    }
  }

  return null;
}

/** Terraform addresses of `aws_kms_key_policy` rows whose `key_id` resolves to `kmsAddress`. */
export function collectKmsKeyPoliciesForKey(
  nodes: TerraformPlanNodesMap,
  kmsAddress: string,
  arnIndex: Map<string, string>,
): string[] {
  const out = new Set<string>();

  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const node = nodes[path] as TerraformPlanGraphNode | undefined;
    if (getResourceTypeFromPath(path, node) !== "aws_kms_key_policy") {
      continue;
    }
    const primary = getPrimaryResource(node);
    if (!primary) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(primary);
    const parent = resolveKmsKeyIdToNodePath(nodes, values.key_id, arnIndex);
    if (parent === kmsAddress) {
      out.add(path);
    }
  }

  return [...out].sort();
}

export type KmsKeyPolicyCluster = {
  kms: string;
  policies: string[];
};

/**
 * Ordered policy tiles under a KMS key primary, plus key→policy data-flow edges.
 */
export function buildKmsKeyPolicyCluster(
  nodes: TerraformPlanNodesMap,
  kmsAddress: string,
  arnIndex: Map<string, string>,
): { cluster: KmsKeyPolicyCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[kmsAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_kms_key") {
    return { cluster: null, edges: [] };
  }

  const policies = collectKmsKeyPoliciesForKey(nodes, kmsAddress, arnIndex);
  if (policies.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = policies.map((p) => ({
    source: kmsAddress,
    target: p,
    type: "kms_key_policy",
    label: "policy",
  }));

  return { cluster: { kms: kmsAddress, policies }, edges };
}

/** Per-primary-address KMS policy stack height in pixels (0 when no policies). */
export function kmsPolicySatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  satelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildKmsKeyPolicyCluster(nodes, address, arnIndex);
  if (!cluster || cluster.policies.length === 0) {
    return 0;
  }
  return satelliteGap + cluster.policies.length * (satelliteH + satelliteGap);
}
