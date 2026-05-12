/**
 * Semantic topology: SQS queue companion resources (queue policies, redrive policies).
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

/** Resolve queue URL / ARN / Terraform ref to an `aws_sqs_queue` node path. */
export function resolveSqsQueueFieldToQueuePath(
  nodes: TerraformPlanNodesMap,
  queueRef: unknown,
  arnIndex: Map<string, string>,
): string | null {
  const strings: string[] = [];
  flattenStringish(queueRef, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    const byStrip = resolveTerraformPlanNodeKey(graphNodes, stripIndexes(s));
    if (byStrip && isAwsSqsQueueNode(nodes, byStrip)) {
      return byStrip;
    }
    const byFull = resolveTerraformPlanNodeKey(graphNodes, s);
    if (byFull && isAwsSqsQueueNode(nodes, byFull)) {
      return byFull;
    }
    const byArn = arnIndex.get(s);
    if (byArn && isAwsSqsQueueNode(nodes, byArn)) {
      return byArn;
    }
    if (s.includes("amazonaws.com/") && s.includes("sqs.")) {
      for (const [path, node] of Object.entries(nodes)) {
        if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
          continue;
        }
        const primary = getPrimaryResource(node as TerraformPlanGraphNode);
        if (primary?.type !== "aws_sqs_queue") {
          continue;
        }
        const v = mergeTerraformPlanResourceValues(primary);
        const url = typeof v.url === "string" ? v.url : null;
        const id = typeof v.id === "string" ? v.id : null;
        if (url && s.includes(url.replace(/^https:/, ""))) {
          return path;
        }
        if (id && s.endsWith(id)) {
          return path;
        }
      }
    }
  }
  return null;
}

function isAwsSqsQueueNode(
  nodes: TerraformPlanNodesMap,
  path: string,
): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_sqs_queue";
}

const SQS_COMPANION_TYPES = new Set([
  "aws_sqs_queue_policy",
  "aws_sqs_queue_redrive_policy",
  "aws_sqs_queue_redrive_allow_policy",
]);

function collectIamPolicyDocumentRefsFromSqsPolicy(
  nodes: TerraformPlanNodesMap,
  policyAddress: string,
  policyField: unknown,
): string[] {
  const out = new Set<string>();
  const modPrefix = terraformModulePrefixForAddress(policyAddress);
  const strings: string[] = [];
  flattenStringish(policyField, strings);
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
        getResourceType(key, nodes[key]) === "aws_iam_policy_document"
      ) {
        out.add(key);
      }
    }
  }
  return [...out].sort();
}

export type SqsCompanionCluster = {
  queue: string;
  stack: string[];
};

export function buildSqsCompanionCluster(
  nodes: TerraformPlanNodesMap,
  queueAddress: string,
  arnIndex: Map<string, string>,
): { cluster: SqsCompanionCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[queueAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_sqs_queue") {
    return { cluster: null, edges: [] };
  }

  const companions = new Set<string>();
  const docToPolicy = new Map<string, string>();

  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    if (!SQS_COMPANION_TYPES.has(t)) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(p);
    const qUrl = values.queue_url ?? values.source_queue_url;
    const redriveSource = values.source_queue_arn ?? values.queue_arn;
    const ref = qUrl ?? redriveSource;
    const resolved = resolveSqsQueueFieldToQueuePath(nodes, ref, arnIndex);
    if (resolved !== queueAddress) {
      continue;
    }
    companions.add(path);
    if (t === "aws_sqs_queue_policy") {
      for (const doc of collectIamPolicyDocumentRefsFromSqsPolicy(
        nodes,
        path,
        values.policy,
      )) {
        if (nodes[doc]) {
          companions.add(doc);
          docToPolicy.set(doc, path);
        }
      }
    }
  }

  const stack = [...companions].sort((a, b) => {
    const ta = getResourceType(a, nodes[a]);
    const tb = getResourceType(b, nodes[b]);
    if (ta !== tb) {
      return ta.localeCompare(tb);
    }
    return a.localeCompare(b);
  });

  if (stack.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [];
  for (const addr of stack) {
    if (getResourceType(addr, nodes[addr]) === "aws_iam_policy_document") {
      const pol = docToPolicy.get(addr);
      if (pol) {
        edges.push({
          source: pol,
          target: addr,
          type: "sqs_policy_document",
          label: "policy document",
        });
      }
      continue;
    }
    edges.push({
      source: queueAddress,
      target: addr,
      type: "sqs_companion",
      label: "queue config",
    });
  }

  return { cluster: { queue: queueAddress, stack }, edges };
}

export function sqsSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  tier1H: number,
  tier2H: number,
  satelliteGap: number,
): number {
  const { cluster } = buildSqsCompanionCluster(nodes, address, arnIndex);
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  let h = satelliteGap;
  for (const addr of cluster.stack) {
    const t = getResourceType(addr, nodes[addr]);
    const tileH = t === "aws_iam_policy_document" ? tier2H : tier1H;
    h += tileH + satelliteGap;
  }
  return h;
}
