import graphlibDot from "@dagrejs/graphlib-dot";

import {
  extractTerraformTopologyFromPlan,
  mergeTopologyModelWithPlacementZones,
  mergeTopologyModelWithRegionalBuckets,
  mergeTopologyModelWithVpcEndpoints,
  mergeTopologyModelWithRouteTables,
  mergeTopologyModelWithVpcDefaults,
} from "./terraformTopologyExtract";
import {
  computeInterfaceVpcEndpointZonePlacements,
  collectRouteAddressesFromBottomPlacements,
  computeRouteTableBottomEdgePlacements,
  extractInterfaceEndpointSecurityGroupBuckets,
  extractRegionalTopologyPrimaries,
  extractRouteTablesByVpc,
  extractVpcEndpointsByVpc,
  extractVpcFlowLogBundles,
  filterVpcEndpointBucketsRemovingZonePlacedAddresses,
} from "./terraformTopologyPlacement";
import {
  buildMergedTopologyZones,
  buildVpcDefaultPlumbingWithNat,
  collectTopologyPreplacedAddresses,
  enrichAndReconcileTopologyPlacements,
} from "./terraformTopologyPlacementBuild";
import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";
import {
  filterPlanByProviderFamily,
  getProviderFamilyLabel,
  hasManagedResourcesForSemantic,
  partitionResourceChangesByProviderFamily,
  sortedNonAwsProviderFamilies,
} from "./terraformProviderClassification";
import {
  buildProviderFamilyScene,
  composeMultiProviderTopologyScene,
  type ProviderTopologyBlock,
} from "./terraformProviderLayout";
import {
  mergeDotAdjacency,
  mergePlanJsons,
  mergePlanWithStates,
  mergeSyntheticPlans,
  namespacePlanDotBundles,
  type TerraformImportWarning,
} from "./terraformImportMerge";
import {
  applyTfdOverlayToNodes,
  buildTerraformLocalImportNodesMap,
} from "./terraformPlanParsing";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";

import type { LayoutTerraformResult } from "./terraformLayoutCore";
import type {
  SemanticAwsLayoutPrep,
  TerraformLayoutProgress,
  TerraformLayoutWorkerJobResult,
} from "./terraformLayoutWorkerTypes";
import type { TerraformPlanParsingSources } from "./terraformPlanParsing";
import type { TerraformLayoutOptions } from "./terraformLayoutCore";
import type { TerraformProviderFamily } from "./terraformProviderClassification";
import {
  terraformImportProfilerMeasure,
  terraformImportProfilerMeasureAsync,
} from "./terraformImportProfiler";

export function prepareSemanticAwsLayoutPrep(
  sources: TerraformPlanParsingSources,
  options: TerraformLayoutOptions,
): {
  prep: SemanticAwsLayoutPrep | null;
  semPlan: unknown;
  providerBuckets: Map<string, unknown[]>;
  nodes: ReturnType<typeof buildTerraformLocalImportNodesMap>;
  stackIds: string[];
  addressToStack: Record<string, string>;
  importWarnings: TerraformImportWarning[];
  importSource: "plan" | "state-only";
} {
  const importWarnings: TerraformImportWarning[] = [];
  let plan: unknown;
  let adjacency: Record<string, string[]> = {};
  let importSource: "plan" | "state-only" = "plan";
  let sourcePlans: unknown[] = [];
  let stackIds: string[] = [];
  let addressToStack: Record<string, string> = {};
  const states = sources.states ?? [];

  if (sources.planDotBundles.length === 0) {
    if (states.length === 0) {
      return {
        prep: null,
        semPlan: null,
        providerBuckets: new Map(),
        nodes: {} as ReturnType<typeof buildTerraformLocalImportNodesMap>,
        stackIds,
        addressToStack,
        importWarnings,
        importSource,
      };
    }
    const merged = mergeSyntheticPlans(
      states,
      sources.stateLabels ?? states.map((_, i) => `state ${i + 1}`),
    );
    plan = merged.plan;
    importWarnings.push(...merged.warnings);
    sourcePlans = merged.sourcePlans;
    importSource = "state-only";
  } else {
    let bundles = sources.planDotBundles;
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
    plan = merged.plan;
    importWarnings.push(...merged.warnings);
    sourcePlans = merged.sourcePlans;
    adjacency = mergeDotAdjacency(
      bundles.map((b) => b.dotText),
      stackIds.length > 0 ? stackIds : undefined,
    );
    if (states.length > 0 && sources.planDotBundles.length === 1) {
      const mergedWithState = mergePlanWithStates(
        plan as Parameters<typeof mergePlanWithStates>[0],
        sourcePlans,
        states,
        sources.stateLabels ?? states.map((_, i) => `state ${i + 1}`),
        importWarnings,
      );
      plan = mergedWithState.plan;
      sourcePlans = mergedWithState.sourcePlans;
    }
  }

  const rc = (plan as { resource_changes?: unknown[] }).resource_changes;
  if (
    !Array.isArray(rc) ||
    rc.length === 0 ||
    !hasManagedResourcesForSemantic(
      plan as { resource_changes?: Array<{ mode?: string; type?: string }> },
    )
  ) {
    return {
      prep: null,
      semPlan: plan,
      providerBuckets: new Map(),
      nodes: {} as ReturnType<typeof buildTerraformLocalImportNodesMap>,
      stackIds,
      addressToStack,
      importWarnings,
      importSource,
    };
  }

  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(plan, graph, states, {
    adjacency,
    priorStatePlans: sourcePlans,
    stackIds,
  });
  applyTfdOverlayToNodes(
    nodes,
    sources.tfdTexts,
    sources.tfdLabels,
    options?.dataflowLinks,
  );

  const semPlan = plan;
  type SemanticPlan = Parameters<typeof extractTerraformTopologyFromPlan>[0];
  const awsPlan = filterPlanByProviderFamily(semPlan as SemanticPlan, "aws");
  const providerBuckets = partitionResourceChangesByProviderFamily(
    semPlan as SemanticPlan,
  );

  const awsChanges = providerBuckets.get("aws") ?? [];
  if (awsChanges.length === 0) {
    return {
      prep: null,
      semPlan,
      providerBuckets,
      nodes,
      stackIds,
      addressToStack,
      importWarnings,
      importSource,
    };
  }

  const topoModel = extractTerraformTopologyFromPlan(awsPlan);
  const zones = buildMergedTopologyZones(awsPlan);
  const regionalBuckets = extractRegionalTopologyPrimaries(awsPlan);
  const vpcEndpointBucketsRaw = extractVpcEndpointsByVpc(awsPlan);
  const { byZone: interfaceVpcEndpointZonePlacements, zonePlacedAddresses } =
    computeInterfaceVpcEndpointZonePlacements(awsPlan, zones);
  const vpcEndpointBuckets =
    filterVpcEndpointBucketsRemovingZonePlacedAddresses(
      vpcEndpointBucketsRaw,
      zonePlacedAddresses,
    );
  const routeTableBuckets = extractRouteTablesByVpc(awsPlan);
  const { vpcDefaultPlumbingBuckets, natZonePlacements } =
    buildVpcDefaultPlumbingWithNat(awsPlan, zones);
  const vpcFlowLogBuckets = extractVpcFlowLogBundles(awsPlan);
  const endpointSecurityGroupBuckets =
    extractInterfaceEndpointSecurityGroupBuckets(
      awsPlan,
      vpcEndpointBucketsRaw,
    );
  const routeTableBottomPlacements = computeRouteTableBottomEdgePlacements(
    zones,
    awsPlan,
  );
  mergeTopologyModelWithPlacementZones(topoModel, zones);
  mergeTopologyModelWithRegionalBuckets(topoModel, regionalBuckets);
  mergeTopologyModelWithVpcEndpoints(topoModel, vpcEndpointBuckets);
  mergeTopologyModelWithRouteTables(topoModel, routeTableBuckets);
  mergeTopologyModelWithVpcDefaults(topoModel, vpcDefaultPlumbingBuckets);
  mergeTopologyModelWithRouteTables(topoModel, vpcFlowLogBuckets);
  mergeTopologyModelWithRouteTables(topoModel, endpointSecurityGroupBuckets);

  const enrichPreplaced = collectTopologyPreplacedAddresses([
    ...zones,
    ...regionalBuckets,
    ...vpcEndpointBuckets,
    ...routeTableBuckets,
    ...vpcDefaultPlumbingBuckets,
    ...vpcFlowLogBuckets,
    ...endpointSecurityGroupBuckets,
  ]);
  for (const address of natZonePlacements.consumedAddresses) {
    enrichPreplaced.add(address);
  }
  for (const address of zonePlacedAddresses) {
    enrichPreplaced.add(address);
  }
  for (const address of collectRouteAddressesFromBottomPlacements(
    routeTableBottomPlacements,
  )) {
    enrichPreplaced.add(address);
  }
  enrichAndReconcileTopologyPlacements(
    {
      zones,
      regionalBuckets,
      vpcDefaultPlumbingBuckets,
      natZonePlacements,
    },
    awsPlan,
    nodes,
    enrichPreplaced,
  );

  if (topoModel.accounts.size === 0) {
    return {
      prep: null,
      semPlan,
      providerBuckets,
      nodes,
      stackIds,
      addressToStack,
      importWarnings,
      importSource,
    };
  }

  const prep: SemanticAwsLayoutPrep = {
    topoModel,
    zones,
    regionalBuckets,
    nodes,
    awsPlan,
    vpcEndpointBuckets,
    routeTableBottomPlacements,
    vpcDefaultPlumbingBuckets,
    vpcFlowLogBuckets,
    endpointSecurityGroupBuckets,
    natZonePlacements,
    interfaceVpcEndpointZonePlacements,
  };

  return {
    prep,
    semPlan,
    providerBuckets,
    nodes,
    stackIds,
    addressToStack,
    importWarnings,
    importSource,
  };
}

export async function runSemanticAwsLayoutJob(
  prep: SemanticAwsLayoutPrep,
): Promise<Extract<TerraformLayoutWorkerJobResult, { type: "semanticAws" }>> {
  const p = prep as {
    topoModel: Parameters<typeof buildTerraformTopologyExcalidrawScene>[0];
    zones: Parameters<typeof buildTerraformTopologyExcalidrawScene>[1];
    regionalBuckets: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[2];
    nodes: Parameters<typeof buildTerraformTopologyExcalidrawScene>[3];
    awsPlan: Parameters<typeof buildTerraformTopologyExcalidrawScene>[4];
    vpcEndpointBuckets: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[5];
    routeTableBottomPlacements: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[6];
    vpcDefaultPlumbingBuckets: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[7];
    vpcFlowLogBuckets: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[8];
    endpointSecurityGroupBuckets: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[9];
    natZonePlacements: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[10];
    interfaceVpcEndpointZonePlacements: Parameters<
      typeof buildTerraformTopologyExcalidrawScene
    >[11];
  };
  const topoScene = await buildTerraformTopologyExcalidrawScene(
    p.topoModel,
    p.zones,
    p.regionalBuckets,
    p.nodes,
    p.awsPlan,
    p.vpcEndpointBuckets,
    p.routeTableBottomPlacements,
    p.vpcDefaultPlumbingBuckets,
    p.vpcFlowLogBuckets,
    p.endpointSecurityGroupBuckets,
    p.natZonePlacements,
    p.interfaceVpcEndpointZonePlacements,
  );
  return {
    type: "semanticAws",
    elements: topoScene.elements,
    meta: topoScene.meta as Record<string, unknown>,
    files: topoScene.files as Record<string, unknown> | undefined,
  };
}

export async function runSemanticProviderLayoutJob(
  family: TerraformProviderFamily,
  label: string,
  changes: unknown[],
  nodes: Parameters<typeof buildProviderFamilyScene>[3],
  plan: unknown,
): Promise<
  Extract<TerraformLayoutWorkerJobResult, { type: "semanticProvider" }>
> {
  const providerScene = await buildProviderFamilyScene(
    family,
    label,
    changes as Parameters<typeof buildProviderFamilyScene>[2],
    nodes,
    plan,
  );
  return {
    type: "semanticProvider",
    family,
    elements: providerScene.elements,
  };
}

export type RunLayoutWorkerJob = (
  job: import("./terraformLayoutWorkerTypes").TerraformLayoutWorkerJob,
) => Promise<TerraformLayoutWorkerJobResult>;

export async function layoutSemanticViewParallel(
  sources: TerraformPlanParsingSources,
  options: TerraformLayoutOptions,
  runJob: RunLayoutWorkerJob,
  onProgress?: (p: TerraformLayoutProgress) => void,
): Promise<LayoutTerraformResult> {
  onProgress?.({ phase: "prepare semantic", done: 0, total: 1 });
  const prepared = terraformImportProfilerMeasure("prep.semantic", () =>
    prepareSemanticAwsLayoutPrep(sources, options),
  );
  if (!prepared.semPlan) {
    return {
      ok: false,
      status: 400,
      error:
        "Semantic layout requires at least one managed resource in the plan or state file.",
    };
  }

  const tfdTexts = sources.tfdTexts.filter((t) => t.trim());
  const hasTfdEdgeSyntax = tfdTexts.some((t) => /\S+\s*->\s*\S+/.test(t));
  const declaredEdges = prepared.nodes[DECLARED_DATAFLOW_ORDERED_KEY];
  if (hasTfdEdgeSyntax && (!declaredEdges || declaredEdges.length === 0)) {
    return {
      ok: false,
      status: 400,
      error:
        "Dataflow links (.tfd) could not be resolved to any resources in the merged import.",
    };
  }

  const nonAws = sortedNonAwsProviderFamilies(
    prepared.providerBuckets as ReturnType<
      typeof partitionResourceChangesByProviderFamily
    >,
  );
  const jobCount = (prepared.prep ? 1 : 0) + nonAws.length;
  let done = 0;

  const providerBlocks: ProviderTopologyBlock[] = [];
  let topoMeta: Record<string, unknown> = {
    layoutEngine: "topology",
    layoutParallel: "semantic-providers",
  };
  let layoutFiles: Record<string, unknown> | undefined;

  const reportProgress = (phase: string) => {
    done += 1;
    onProgress?.({ phase, done, total: jobCount });
  };

  const jobs: Promise<TerraformLayoutWorkerJobResult>[] = [];
  if (prepared.prep) {
    jobs.push(
      runJob({ type: "semanticAws", prep: prepared.prep }).then((r) => {
        reportProgress("AWS topology");
        return r;
      }),
    );
  }
  jobs.push(
    ...nonAws.map((family) => {
      const changes = (
        prepared.providerBuckets as ReturnType<
          typeof partitionResourceChangesByProviderFamily
        >
      ).get(family)!;
      return runJob({
        type: "semanticProvider",
        family,
        label: getProviderFamilyLabel(family),
        changes,
        nodes: prepared.nodes,
        plan: prepared.semPlan,
      }).then((r) => {
        reportProgress(`provider ${family}`);
        return r;
      });
    }),
  );

  const results = await terraformImportProfilerMeasureAsync(
    "layout.semantic.workers",
    () => Promise.all(jobs),
  );
  for (const result of results) {
    if (result.type === "semanticAws" && result.elements.length > 0) {
      providerBlocks.push({
        family: "aws",
        label: "AWS",
        elements: result.elements,
      });
      topoMeta = { ...topoMeta, ...result.meta };
      if (result.files && Object.keys(result.files).length > 0) {
        layoutFiles = result.files;
      }
    } else if (
      result.type === "semanticProvider" &&
      result.elements.length > 0
    ) {
      providerBlocks.push({
        family: result.family,
        label: getProviderFamilyLabel(result.family),
        elements: result.elements,
      });
    }
  }

  const composedElements = composeMultiProviderTopologyScene(providerBlocks);
  return {
    ok: true,
    scene: {
      type: "excalidraw",
      version: 2,
      source: "terraform-local-parse",
      elements: composedElements,
      appState: { viewBackgroundColor: "#ffffff", gridSize: null },
      ...(layoutFiles ? { files: layoutFiles } : {}),
      meta: {
        ...topoMeta,
        importSource: prepared.importSource,
        plannedChanges: prepared.importSource !== "state-only",
        providerBlockCount: providerBlocks.length,
        importBundleCount: sources.planDotBundles.length,
        stackIds: prepared.stackIds,
        addressToStack: prepared.addressToStack,
        ...(prepared.importWarnings.length > 0
          ? { importWarnings: prepared.importWarnings }
          : {}),
      },
    },
  };
}
