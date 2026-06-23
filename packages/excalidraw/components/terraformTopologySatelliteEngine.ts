/**
 * Interpret satellite-kind catalog attachment rules against a Terraform plan graph.
 */

import catalogJson from "../assets/terraform-topology-satellite-kinds.json";

import { type TopologyIamEdge } from "./terraformTopologyIamLinks";
import { resolveKmsKeyIdToNodePath } from "./terraformTopologyKmsLinks";
import { resolveS3BucketFieldToBucketPath } from "./terraformTopologyS3Links";
import { resolveSqsQueueFieldToQueuePath } from "./terraformTopologySqsLinks";
import {
  getTopologyPrimaryResource,
  getTopologyResourceType,
  iterateTopologyNodePaths,
  resolveRefToPrimaryPath,
  resolveSatelliteLinkToPrimaryAddress,
} from "./terraformTopologySatelliteResolve";
import { mergeTerraformPlanResourceValues as mergeValues } from "./terraformTopologyIamLinks";

import {
  validateTopologySatelliteKindCatalog,
  type TopologyAttachmentRule,
  type TopologyAttachmentRuleCompanions,
  type TopologyAttachmentRuleReverseRef,
  type TopologySatelliteKindCatalogEntry,
} from "./terraformTopologySatelliteRulesTypes";

import type { TopologySatelliteKind } from "./terraformTopologyPrimaryLayoutTypes";
import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export type SatelliteBuildContext = {
  nodes: TerraformPlanNodesMap;
  primaryAddress: string;
  primaryType: string;
  arnIndex: Map<string, string>;
  plan?: unknown;
  planChanges?: Array<{ address?: string; type?: string }>;
  /**
   * Optional pre-index: resource type -> node-path addresses of that type, in the same
   * order they appear in `Object.keys(nodes)` (NOT sorted — some plugin scan sites do
   * order-dependent first-match-by-name lookups on ties, so insertion order is preserved
   * rather than re-sorted). Built once per build (O(N)) by `buildAllSatellitePrimaryMappings`;
   * absent when `ctx` is built by any other call site, in which case every scan site falls
   * back to its original `Object.keys(nodes)` scan.
   */
  nodesByType?: ReadonlyMap<string, readonly string[]>;
};

let fallbackScanCount = 0;

/**
 * Call from a scan site when it falls back to `Object.keys(nodes)` despite `nodesByType`
 * being supplied to the enclosing call — i.e. the index existed but this specific site
 * never received it. Proves the *complexity* claim (not just correctness): a
 * correctness-only equivalence check would still pass even if a site silently kept doing
 * the full O(N) scan.
 */
export function recordNodesByTypeFallbackScan(): void {
  fallbackScanCount += 1;
}

export function resetFallbackScanCount(): void {
  fallbackScanCount = 0;
}

export function getFallbackScanCount(): number {
  return fallbackScanCount;
}

/** One O(N) pass bucketing every real node path by its resolved resource type. */
export function buildNodesByTypeIndex(
  nodes: TerraformPlanNodesMap,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const path of iterateTopologyNodePaths(nodes)) {
    const type = getTopologyResourceType(
      path,
      nodes[path] as TerraformPlanGraphNode | undefined,
    );
    const bucket = out.get(type);
    if (bucket) {
      bucket.push(path);
    } else {
      out.set(type, [path]);
    }
  }
  return out;
}

export type SatelliteClusterBuildResult = {
  cluster: unknown | null;
  edges: TopologyIamEdge[];
};

const CATALOG = validateTopologySatelliteKindCatalog(catalogJson);

const CATALOG_BY_KIND = new Map<
  TopologySatelliteKind,
  TopologySatelliteKindCatalogEntry
>();
for (const entry of CATALOG.kinds) {
  CATALOG_BY_KIND.set(entry.kind, entry);
}

export function getSatelliteKindCatalogEntry(
  kind: TopologySatelliteKind,
): TopologySatelliteKindCatalogEntry | undefined {
  return CATALOG_BY_KIND.get(kind);
}

export function getSatelliteAttachmentRule(
  kind: TopologySatelliteKind,
): TopologyAttachmentRule | undefined {
  return CATALOG_BY_KIND.get(kind)?.attachment;
}

export function getAllCatalogPluginIds(): string[] {
  const ids = new Set<string>();
  for (const entry of CATALOG.kinds) {
    if (entry.attachment.mode === "plugin") {
      ids.add(entry.attachment.plugin);
    }
  }
  return [...ids].sort();
}

function buildReverseRefCluster(
  rule: TopologyAttachmentRuleReverseRef,
  ctx: SatelliteBuildContext,
): SatelliteClusterBuildResult {
  const primaryType = rule.primaryTypes[0]!;
  const node = ctx.nodes[ctx.primaryAddress] as
    | TerraformPlanGraphNode
    | undefined;
  const pr = getTopologyPrimaryResource(node);
  if (!pr || pr.type !== primaryType) {
    return { cluster: null, edges: [] };
  }

  const match = rule.match ?? ["arn", "planAddress"];
  const paths: string[] = [];

  for (const path of iterateTopologyNodePaths(ctx.nodes)) {
    const n = ctx.nodes[path] as TerraformPlanGraphNode | undefined;
    const sat = getTopologyPrimaryResource(n);
    if (!sat || !rule.satelliteTypes.includes(String(sat.type))) {
      continue;
    }
    const values = mergeValues(sat);
    const linkVal = values[rule.linkField];
    const resolved = resolveSatelliteLinkToPrimaryAddress(
      ctx.nodes,
      path,
      linkVal,
      ctx.arnIndex,
      primaryType,
      match,
      ctx.plan,
    );
    if (resolved === ctx.primaryAddress) {
      paths.push(path);
    }
  }

  paths.sort((a, b) => a.localeCompare(b));
  if (paths.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edgeType = rule.edgeType ?? rule.satelliteTypes[0] ?? "link";
  const edgeLabel = rule.edgeLabel ?? edgeType;
  const edges: TopologyIamEdge[] = paths.map((p) => ({
    source: ctx.primaryAddress,
    target: p,
    type: edgeType,
    label: edgeLabel,
  }));

  if (primaryType === "aws_lambda_function") {
    return {
      cluster: { lambda: ctx.primaryAddress, stack: paths },
      edges,
    };
  }

  return { cluster: { primary: ctx.primaryAddress, stack: paths }, edges };
}

function resolveCompanionPrimary(
  nodes: TerraformPlanNodesMap,
  primaryType: string,
  ref: unknown,
  arnIndex: Map<string, string>,
): string | null {
  if (primaryType === "aws_s3_bucket") {
    return resolveS3BucketFieldToBucketPath(nodes, ref, arnIndex);
  }
  if (primaryType === "aws_sqs_queue") {
    return resolveSqsQueueFieldToQueuePath(nodes, ref, arnIndex);
  }
  if (primaryType === "aws_kms_key") {
    return resolveKmsKeyIdToNodePath(nodes, ref, arnIndex);
  }
  return resolveRefToPrimaryPath(nodes, ref, arnIndex, primaryType);
}

function buildCompanionsCluster(
  rule: TopologyAttachmentRuleCompanions,
  ctx: SatelliteBuildContext,
): SatelliteClusterBuildResult {
  const primaryType = rule.primaryTypes[0]!;
  const node = ctx.nodes[ctx.primaryAddress] as
    | TerraformPlanGraphNode
    | undefined;
  const pr = getTopologyPrimaryResource(node);
  if (!pr || !rule.primaryTypes.includes(String(pr.type))) {
    return { cluster: null, edges: [] };
  }

  const companions = new Set<string>();

  for (const path of iterateTopologyNodePaths(ctx.nodes)) {
    const n = ctx.nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getTopologyPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    if (!rule.satelliteTypes.includes(t)) {
      continue;
    }
    const values = mergeValues(p);
    let resolved: string | null = null;
    for (const field of rule.linkFields) {
      if (values[field] !== undefined) {
        resolved = resolveCompanionPrimary(
          ctx.nodes,
          primaryType,
          values[field],
          ctx.arnIndex,
        );
        if (resolved) {
          break;
        }
      }
    }
    if (resolved !== ctx.primaryAddress) {
      continue;
    }
    companions.add(path);
  }

  const stack = [...companions].sort((a, b) => {
    const ta = getTopologyResourceType(a, ctx.nodes[a]);
    const tb = getTopologyResourceType(b, ctx.nodes[b]);
    if (ta !== tb) {
      return ta.localeCompare(tb);
    }
    return a.localeCompare(b);
  });

  if (stack.length === 0) {
    return { cluster: null, edges: [] };
  }

  const edgeType = rule.edgeType ?? "companion";
  const edgeLabel = rule.edgeLabel ?? edgeType;
  const edges: TopologyIamEdge[] = stack.map((addr) => ({
    source: ctx.primaryAddress,
    target: addr,
    type: edgeType,
    label: edgeLabel,
  }));

  if (primaryType === "aws_kms_key") {
    return {
      cluster: { kms: ctx.primaryAddress, policies: stack },
      edges,
    };
  }
  if (primaryType === "aws_s3_bucket") {
    return { cluster: { bucket: ctx.primaryAddress, stack }, edges };
  }
  if (primaryType === "aws_sqs_queue") {
    return { cluster: { queue: ctx.primaryAddress, stack }, edges };
  }

  return { cluster: { primary: ctx.primaryAddress, stack }, edges };
}

export type SatellitePluginFn = (
  kind: TopologySatelliteKind,
  ctx: SatelliteBuildContext,
) => SatelliteClusterBuildResult;

let pluginRegistry: Map<string, SatellitePluginFn> | null = null;

export function registerSatellitePlugins(
  plugins: Record<string, SatellitePluginFn>,
): void {
  pluginRegistry = new Map(Object.entries(plugins));
}

function getPlugins(): Map<string, SatellitePluginFn> {
  if (!pluginRegistry) {
    // Lazy: plugins module imports this file; static import would cycle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { installSatellitePlugins } =
      require("./terraformTopologySatellitePlugins") as typeof import("./terraformTopologySatellitePlugins");
    installSatellitePlugins();
  }
  if (!pluginRegistry) {
    throw new Error("terraformTopologySatelliteEngine: plugins not registered");
  }
  return pluginRegistry;
}

export function buildSatelliteClusterForKind(
  kind: TopologySatelliteKind,
  ctx: SatelliteBuildContext,
): SatelliteClusterBuildResult {
  const entry = CATALOG_BY_KIND.get(kind);
  if (!entry) {
    return { cluster: null, edges: [] };
  }

  const rule = entry.attachment;
  switch (rule.mode) {
    case "reverseRef":
      return buildReverseRefCluster(rule, ctx);
    case "companions":
      return buildCompanionsCluster(rule, ctx);
    case "forwardRef":
      return buildCompanionsCluster(
        {
          mode: "companions",
          primaryTypes: rule.primaryTypes,
          satelliteTypes: rule.satelliteTypes,
          linkFields: [rule.primaryField],
          edgeType: rule.edgeType,
          edgeLabel: rule.edgeLabel,
        },
        ctx,
      );
    case "plugin": {
      const fn = getPlugins().get(rule.plugin);
      if (!fn) {
        throw new Error(
          `terraformTopologySatelliteEngine: unregistered plugin ${rule.plugin}`,
        );
      }
      return fn(kind, ctx);
    }
    default:
      return { cluster: null, edges: [] };
  }
}

export function collectSatelliteAddressesForKind(
  kind: TopologySatelliteKind,
  primaryAddresses: readonly string[],
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const out = new Set<string>();
  const planChanges = Array.isArray(
    (plan as { resource_changes?: unknown })?.resource_changes,
  )
    ? (plan as { resource_changes: Array<{ address?: string; type?: string }> })
        .resource_changes ?? []
    : undefined;

  for (const primaryAddress of primaryAddresses) {
    const node = nodes[primaryAddress] as TerraformPlanGraphNode | undefined;
    const pr = getTopologyPrimaryResource(node);
    const primaryType = typeof pr?.type === "string" ? pr.type : "";
    const ctx: SatelliteBuildContext = {
      nodes,
      primaryAddress,
      primaryType,
      arnIndex,
      plan,
      planChanges,
      nodesByType,
    };
    const { cluster } = buildSatelliteClusterForKind(kind, ctx);
    if (!cluster) {
      continue;
    }
    const c = cluster as Record<string, unknown>;
    if (kind === "cloudwatch_alarms" && Array.isArray(c.alarms)) {
      for (const a of c.alarms) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    } else if (kind === "cloudwatch_log_groups" && Array.isArray(c.logGroups)) {
      for (const a of c.logGroups) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    } else if (Array.isArray(c.stack)) {
      for (const a of c.stack) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
    if (Array.isArray(c.instances)) {
      for (const a of c.instances) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
    if (typeof c.subnetGroup === "string") {
      out.add(c.subnetGroup);
    }
    if (typeof c.secret === "string") {
      out.add(c.secret);
    }
    if (typeof c.secretVersion === "string") {
      out.add(c.secretVersion);
    }
    if (Array.isArray(c.policies)) {
      for (const a of c.policies) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
    if (Array.isArray(c.groups)) {
      for (const g of c.groups as Array<{
        sgPath?: string;
        rules?: string[];
      }>) {
        if (g.sgPath) {
          out.add(g.sgPath);
        }
        for (const r of g.rules ?? []) {
          out.add(r);
        }
      }
    }
    if (Array.isArray(c.chains)) {
      for (const chain of c.chains as Array<Record<string, string | null>>) {
        for (const v of Object.values(chain)) {
          if (typeof v === "string") {
            out.add(v);
          }
        }
      }
    }
    if (typeof c.clusterPath === "string") {
      out.add(c.clusterPath);
    }
    if (typeof c.clusterCapacityProvidersPath === "string") {
      out.add(c.clusterCapacityProvidersPath);
    }
    if (Array.isArray(c.stages)) {
      for (const s of c.stages as Array<Record<string, string | undefined>>) {
        for (const v of Object.values(s)) {
          if (typeof v === "string") {
            out.add(v);
          }
        }
      }
    }
    if (Array.isArray(c.methodSettings)) {
      for (const m of c.methodSettings) {
        if (typeof m === "string") {
          out.add(m);
        }
      }
    }
    if (Array.isArray(c.alarms)) {
      for (const a of c.alarms) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
    if (Array.isArray(c.logGroups)) {
      for (const a of c.logGroups) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
    if (Array.isArray(c.vpcAttachments)) {
      for (const a of c.vpcAttachments) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
    if (Array.isArray(c.peering)) {
      for (const p of c.peering as Array<Record<string, unknown>>) {
        if (typeof p.peering === "string") {
          out.add(p.peering);
        }
        if (typeof p.accepter === "string") {
          out.add(p.accepter);
        }
        for (const r of (p.routes as string[]) ?? []) {
          out.add(r);
        }
      }
    }
    if (Array.isArray(c.routeTables)) {
      for (const a of c.routeTables) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
    if (Array.isArray(c.standaloneRoutes)) {
      for (const a of c.standaloneRoutes) {
        if (typeof a === "string") {
          out.add(a);
        }
      }
    }
  }

  return [...out];
}

/** @internal tests */
export const __satelliteKindCatalogForTest = CATALOG;
