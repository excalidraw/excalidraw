/**
 * Semantic topology: S3 bucket companion resources (policy, PAB, encryption, versioning)
 * and optional `data.aws_iam_policy_document` referenced from bucket policy JSON.
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
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

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

/** Candidate paths for a union of types — used when a scan filters by a Set of types. */
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

/**
 * Resolve `bucket` attribute on S3 companion resources to a `nodes` key for `aws_s3_bucket`.
 */
export function resolveS3BucketFieldToBucketPath(
  nodes: TerraformPlanNodesMap,
  bucketRef: unknown,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(bucketRef, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    const byStrip = resolveTerraformPlanNodeKey(graphNodes, stripIndexes(s));
    if (byStrip && isAwsS3BucketNode(nodes, byStrip)) {
      return byStrip;
    }
    const byFull = resolveTerraformPlanNodeKey(graphNodes, s);
    if (byFull && isAwsS3BucketNode(nodes, byFull)) {
      return byFull;
    }
    const byArn = arnIndex.get(s);
    if (byArn && isAwsS3BucketNode(nodes, byArn)) {
      return byArn;
    }
  }

  for (const path of candidatesForType(nodesByType, "aws_s3_bucket", nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!primary || primary.type !== "aws_s3_bucket") {
      continue;
    }
    const v = mergeTerraformPlanResourceValues(primary);
    if (typeof v.bucket === "string" && v.bucket === strings[0]) {
      return path;
    }
    if (typeof v.id === "string" && strings.some((x) => x === v.id)) {
      return path;
    }
  }

  return null;
}

function isAwsS3BucketNode(
  nodes: TerraformPlanNodesMap,
  path: string,
): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_s3_bucket";
}

const S3_COMPANION_TYPES = new Set([
  "aws_s3_bucket_policy",
  "aws_s3_bucket_public_access_block",
  "aws_s3_bucket_server_side_encryption_configuration",
  "aws_s3_bucket_versioning",
]);

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

/** `data.aws_iam_policy_document` addresses referenced from policy text / structured policy. */
function collectIamPolicyDocumentRefsFromPolicyField(
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
    const candidates: string[] = [];
    const re =
      /\b((?:module\.[a-zA-Z0-9_.-]+\.)*data\.aws_iam_policy_document\.[a-zA-Z0-9_.-]+(?:\[[^\]]+\])?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      candidates.push(m[1]!);
    }
    for (const raw of candidates) {
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

export type S3CompanionCluster = {
  bucket: string;
  /** Companion Terraform addresses (sorted). */
  stack: string[];
};

/**
 * S3 companion tiles + data-flow edges (bucket → each companion; policy → referenced policy docs).
 */
export function buildS3CompanionCluster(
  nodes: TerraformPlanNodesMap,
  bucketAddress: string,
  arnIndex: Map<string, string>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: S3CompanionCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[bucketAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_s3_bucket") {
    return { cluster: null, edges: [] };
  }

  const companions = new Set<string>();
  const docToPolicy = new Map<string, string>();

  for (const path of candidatesForTypes(
    nodesByType,
    S3_COMPANION_TYPES,
    nodes,
  )) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    if (!S3_COMPANION_TYPES.has(t)) {
      continue;
    }
    const values = mergeTerraformPlanResourceValues(p);
    const resolved = resolveS3BucketFieldToBucketPath(
      nodes,
      values.bucket,
      arnIndex,
      nodesByType,
    );
    if (resolved !== bucketAddress) {
      continue;
    }
    companions.add(path);
    if (t === "aws_s3_bucket_policy") {
      for (const doc of collectIamPolicyDocumentRefsFromPolicyField(
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
          type: "s3_policy_document",
          label: "policy document",
        });
      }
      continue;
    }
    edges.push({
      source: bucketAddress,
      target: addr,
      type: "s3_companion",
      label: "bucket config",
    });
  }

  return { cluster: { bucket: bucketAddress, stack }, edges };
}

export function s3SatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  tier1H: number,
  tier2H: number,
  satelliteGap: number,
): number {
  const { cluster } = buildS3CompanionCluster(nodes, address, arnIndex);
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  let h = satelliteGap;
  for (let i = 0; i < cluster.stack.length; i++) {
    const t = getResourceType(cluster.stack[i]!, nodes[cluster.stack[i]!]);
    const tileH = t === "aws_iam_policy_document" ? tier2H : tier1H;
    h += tileH + satelliteGap;
  }
  return h;
}
