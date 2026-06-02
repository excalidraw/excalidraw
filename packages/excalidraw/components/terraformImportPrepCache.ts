import graphlibDot from "@dagrejs/graphlib-dot";

import { mergeDotAdjacency, mergePlanJsons, namespacePlanDotBundles } from "./terraformImportMerge";
import {
  applyTfdOverlayToNodes,
  buildTerraformLocalImportNodesMap,
  type TerraformPlanParsingSources,
} from "./terraformPlanParsing";
import { buildAwsLayoutContext, type AwsLayoutContext } from "./terraformAwsLayoutContext";
import {
  buildEnrichedTopologyPlacements,
  type EnrichedTopologyPlacements,
} from "./terraformTopologyPlacementBuild";
import { filterPlanByProviderFamily } from "./terraformProviderClassification";

import type { TerraformLayoutOptions } from "./terraformLayoutCore";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

export type TerraformImportPrepCache = {
  fingerprint: string;
  mergedPlan: unknown;
  adjacency: Record<string, string[]>;
  stackIds: string[];
  addressToStack: Record<string, string>;
  importWarnings: import("./terraformImportMerge").TerraformImportWarning[];
  sourcePlans: unknown[];
  nodes: TerraformPlanNodesMap;
  awsContext: AwsLayoutContext;
  enrichedPlacements: EnrichedTopologyPlacements;
};

let sessionCache: TerraformImportPrepCache | null = null;

export function terraformImportPrepFingerprint(
  sources: TerraformPlanParsingSources,
): string {
  const parts: string[] = [];
  for (const b of sources.planDotBundles) {
    const label = b.label ?? "";
    const rc = (b.plan as { resource_changes?: unknown[] })?.resource_changes;
    const n = Array.isArray(rc) ? rc.length : 0;
    const first =
      Array.isArray(rc) && rc[0] && typeof rc[0] === "object"
        ? String((rc[0] as { address?: string }).address ?? "")
        : "";
    const last =
      Array.isArray(rc) && rc.length > 0 && rc[rc.length - 1]
        ? String((rc[rc.length - 1] as { address?: string }).address ?? "")
        : "";
    parts.push(`${label}:${n}:${first}:${last}`);
  }
  for (const t of sources.tfdTexts) {
    parts.push(`tfd:${t.length}:${t.slice(0, 40)}`);
  }
  return parts.join("|");
}

export function getTerraformImportPrepCache():
  | TerraformImportPrepCache
  | null {
  return sessionCache;
}

export function clearTerraformImportPrepCache(): void {
  sessionCache = null;
}

export function buildTerraformImportPrepCache(
  sources: TerraformPlanParsingSources,
  options?: TerraformLayoutOptions,
): TerraformImportPrepCache {
  const fingerprint = terraformImportPrepFingerprint(sources);
  if (sessionCache?.fingerprint === fingerprint) {
    return sessionCache;
  }

  let bundles = sources.planDotBundles;
  let stackIds: string[] = [];
  let addressToStack: Record<string, string> = {};
  if (bundles.length > 1) {
    const namespaced = namespacePlanDotBundles(bundles);
    bundles = namespaced.bundles;
    stackIds = namespaced.stackIds;
    addressToStack = namespaced.addressToStack;
  }

  const merged = mergePlanJsons(
    bundles.map((b) => b.plan),
    bundles.map((b) => b.label),
  );
  const adjacency = mergeDotAdjacency(
    bundles.map((b) => b.dotText),
    stackIds.length > 0 ? stackIds : undefined,
  );

  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
    adjacency,
    priorStatePlans: merged.sourcePlans,
    stackIds,
  });

  applyTfdOverlayToNodes(
    nodes,
    sources.tfdTexts,
    sources.tfdLabels,
    options?.dataflowLinks,
  );

  const awsPlan = filterPlanByProviderFamily(
    merged.plan as Parameters<typeof filterPlanByProviderFamily>[0],
    "aws",
  );
  const awsContext = buildAwsLayoutContext(awsPlan);
  const enrichedPlacements = buildEnrichedTopologyPlacements(awsPlan, nodes);

  sessionCache = {
    fingerprint,
    mergedPlan: merged.plan,
    adjacency,
    stackIds,
    addressToStack,
    importWarnings: merged.warnings,
    sourcePlans: merged.sourcePlans,
    nodes,
    awsContext,
    enrichedPlacements,
  };
  return sessionCache;
}
