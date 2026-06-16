/**
 * Worker-safe Terraform layout: merge plans, run semantic / module layout,
 * return a plain scene payload (no Response, no DOM).
 */
import graphlibDot from "@dagrejs/graphlib-dot";

import { buildTerraformElkExcalidrawScene } from "./terraformElkLayout";
import {
  extractTerraformTopologyFromPlan,
  mergeTopologyModelWithPlacementZones,
  mergeTopologyModelWithRegionalBuckets,
  mergeTopologyModelWithVpcEndpoints,
  mergeTopologyModelWithRouteTables,
  mergeTopologyModelWithVpcDefaults,
  pickResourceValuesForTopologyPlacement,
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
  buildTerraformCompoundPipelineExcalidrawScene,
  buildTerraformPipelineExcalidrawScene,
} from "./terraformPipelineLayout";
import { buildTerraformPipelineV2ExcalidrawScene } from "./terraformPipelineLayoutV2";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
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
  type TerraformPlanParsingOptions,
  type TerraformPlanParsingSources,
} from "./terraformPlanParsing";
import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import {
  buildTerraformImportPrepCache,
  clearTerraformImportPrepCache,
  getTerraformImportPrepCache,
  terraformImportPrepFingerprint,
} from "./terraformImportPrepCache";
import {
  terraformImportProfilerMeasure,
  terraformImportProfilerMeasureAsync,
} from "./terraformImportProfiler";

import {
  TERRAFORM_COLOR_MODE_DEFAULT,
  withTerraformLayoutColorModeAsync,
  type TerraformColorMode,
} from "./terraformPrimaryVisibility";

import type { TerraformModuleLayoutOptions } from "./terraformModuleLayoutOptions";

export type TerraformLayoutOptions = TerraformPlanParsingOptions;

export type { TerraformPlanParsingSources } from "./terraformPlanParsing";

export type LayoutTerraformResult =
  | { ok: true; scene: Record<string, unknown> }
  | { ok: false; error: string; status?: number };

const EMPTY_TERRAFORM_EXCALIDRAW_SCENE = {
  type: "excalidraw" as const,
  version: 2,
  source: "terraform-local-parse",
  elements: [] as unknown[],
  appState: {
    viewBackgroundColor: "#ffffff",
    gridSize: null as number | null,
  },
};

const DEBUG_PREFIX = "[terraform:local-parse]";
const SEMANTIC_LAYOUT_OMITTED_TYPES = new Set(["terraform_data"]);

function emitLocalParseDebug(payload: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return;
  }
  // eslint-disable-next-line no-console -- intentional dev-only parse tracing
  console.log(DEBUG_PREFIX, payload);
}

function addRepresentedAddressesFromElement(
  represented: Set<string>,
  representedSubnetIds: Set<string>,
  element: { customData?: Record<string, unknown> },
) {
  const cd = element.customData || {};
  if (typeof cd.nodePath === "string") {
    represented.add(cd.nodePath);
  }
  if (Array.isArray(cd.terraformMergedSubnetAddresses)) {
    for (const addr of cd.terraformMergedSubnetAddresses) {
      if (typeof addr === "string") {
        represented.add(addr);
      }
    }
  }
  if (Array.isArray(cd.terraformSubnetIds)) {
    for (const subnetId of cd.terraformSubnetIds) {
      if (typeof subnetId === "string") {
        representedSubnetIds.add(subnetId);
      }
    }
  }
  if (Array.isArray(cd.terraformResources)) {
    for (const resource of cd.terraformResources) {
      const address = (resource as { address?: unknown })?.address;
      if (typeof address === "string") {
        represented.add(address);
      }
    }
  }
}

function addRepresentedAddressesFromPlan(
  represented: Set<string>,
  representedSubnetIds: Set<string>,
  plan: { resource_changes?: Array<{ address?: string; type?: string }> },
) {
  for (const rc of plan.resource_changes || []) {
    if (rc.type === "aws_vpc" && typeof rc.address === "string") {
      represented.add(rc.address);
    }
    if (rc.type === "aws_subnet" && typeof rc.address === "string") {
      const values = pickResourceValuesForTopologyPlacement(rc as any);
      const subnetId =
        values && typeof values.id === "string" ? values.id : null;
      if (subnetId && representedSubnetIds.has(subnetId)) {
        represented.add(rc.address);
      }
    }
    if (
      rc.type === "aws_iam_policy_document" &&
      typeof rc.address === "string"
    ) {
      represented.add(rc.address);
    }
  }
}

function collectSemanticRepresentedResourceAddresses(
  elements: Array<{ customData?: Record<string, any> }>,
  plan: { resource_changes?: Array<{ address?: string; type?: string }> },
): Set<string> {
  const represented = new Set<string>();
  const representedSubnetIds = new Set<string>();
  for (const element of elements) {
    addRepresentedAddressesFromElement(
      represented,
      representedSubnetIds,
      element,
    );
  }
  addRepresentedAddressesFromPlan(represented, representedSubnetIds, plan);
  return represented;
}

function formatImportWarnings(
  warnings: TerraformImportWarning[],
  tfdWarnings: string[],
  tfdErrors: string[] = [],
): TerraformImportWarning[] {
  const out = [...warnings];
  for (const message of tfdErrors) {
    out.push({ code: "tfd_error", message });
  }
  for (const message of tfdWarnings) {
    out.push({ code: "duplicate_tfd_bind", message });
  }
  return out;
}

function appendImportMeta(
  meta: Record<string, unknown>,
  sources: TerraformPlanParsingSources,
  importWarnings: TerraformImportWarning[],
  stackMeta?: { stackIds: string[]; addressToStack: Record<string, string> },
) {
  return {
    ...meta,
    importBundleCount: sources.planDotBundles.length,
    importStateCount: sources.states.length,
    importTfdCount: sources.tfdTexts.filter((t) => t.trim()).length,
    ...(stackMeta?.stackIds.length
      ? {
          stackIds: stackMeta.stackIds,
          addressToStack: stackMeta.addressToStack,
        }
      : {}),
    ...(importWarnings.length > 0 ? { importWarnings } : {}),
  };
}

function applyTfdCompositionToLayoutSources(
  sources: TerraformPlanParsingSources,
  options?: TerraformLayoutOptions,
):
  | { ok: false; error: string; status?: number }
  | { sources: TerraformPlanParsingSources } {
  const hasTfd = sources.tfdTexts.some((text) => text?.trim());
  if (!hasTfd) {
    return { sources };
  }

  const resolved = resolveSourcesWithTfdComposition(
    {
      planDotBundles: sources.planDotBundles,
      states: sources.states ?? [],
      stateLabels: (sources.stateLabels ?? []).map((label) => String(label)),
      tfdTexts: sources.tfdTexts,
      tfdLabels: (sources.tfdLabels ?? []).map((label) => String(label)),
      warnings: sources.warnings ?? [],
      repoName: sources.repoName,
      stackCatalog: sources.stackCatalog,
    },
    options?.artifactLoader,
  );

  if (resolved.compositionErrors?.length) {
    return {
      ok: false,
      status: 400,
      error: resolved.compositionErrors.join("\n"),
    };
  }

  return {
    sources: {
      ...sources,
      planDotBundles: resolved.planDotBundles,
      states: resolved.states,
      stateLabels: resolved.stateLabels,
      warnings: resolved.warnings,
    },
  };
}

type LayoutPlanResolution =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      plan: unknown;
      adjacency: Record<string, string[]>;
      importSource: "plan" | "state-only";
      sourcePlans: unknown[];
      stackIds: string[];
      addressToStack: Record<string, string>;
      importWarnings: TerraformImportWarning[];
    };

function resolveLayoutPlanFromSources(
  sources: TerraformPlanParsingSources,
): LayoutPlanResolution {
  if (sources.planDotBundles.length > 0) {
    const cache = getTerraformImportPrepCache();
    if (
      cache &&
      cache.fingerprint === terraformImportPrepFingerprint(sources)
    ) {
      return {
        ok: true,
        plan: cache.mergedPlan,
        adjacency: cache.adjacency,
        importSource: "plan",
        sourcePlans: cache.sourcePlans,
        stackIds: cache.stackIds,
        addressToStack: cache.addressToStack,
        importWarnings: cache.importWarnings,
      };
    }
  }

  const importWarnings: TerraformImportWarning[] = [];
  const states = sources.states ?? [];
  let plan: unknown;
  let adjacency: Record<string, string[]> = {};
  let importSource: "plan" | "state-only" = "plan";
  let sourcePlans: unknown[] = [];
  let stackIds: string[] = [];
  let addressToStack: Record<string, string> = {};

  if (sources.planDotBundles.length === 0) {
    if (states.length === 0) {
      return {
        ok: false,
        status: 400,
        error:
          "Upload at least one plan JSON + graph DOT pair, or one or more raw Terraform state files.",
      };
    }
    const merged = mergeSyntheticPlans(
      states,
      sources.stateLabels ?? states.map((_, i) => `state ${i + 1}`),
    );
    plan = merged.plan;
    importWarnings.push(...merged.warnings);
    sourcePlans = merged.sourcePlans;
    adjacency = {};
    importSource = "state-only";
  } else {
    let bundles = sources.planDotBundles;
    if (bundles.length > 1) {
      const namespaced = namespacePlanDotBundles(bundles);
      bundles = namespaced.bundles;
      stackIds = namespaced.stackIds;
      addressToStack = namespaced.addressToStack;
    }
    const plans = bundles.map((b) => b.plan);
    const labels = bundles.map((b) => b.label);
    const merged = mergePlanJsons(plans, labels);
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

  return {
    ok: true,
    plan,
    adjacency,
    importSource,
    sourcePlans,
    stackIds,
    addressToStack,
    importWarnings,
  };
}

function validateLayoutPlanForMode(
  plan: unknown,
  semanticLayout: boolean,
  pipelineLayout: boolean,
): { ok: false; status: number; error: string } | { ok: true } {
  if (!semanticLayout && !pipelineLayout) {
    return { ok: true };
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
      ok: false,
      status: 400,
      error: pipelineLayout
        ? "Pipeline view requires at least one managed resource in the plan or state file."
        : "Semantic layout requires at least one managed resource in the plan or state file.",
    };
  }
  return { ok: true };
}

type LayoutSceneContext = {
  sources: TerraformPlanParsingSources;
  plan: unknown;
  nodes5: ReturnType<typeof buildTerraformLocalImportNodesMap>;
  importSource: "plan" | "state-only";
  importWarnings: TerraformImportWarning[];
  tfdErrors: string[];
  tfdWarnings: string[];
  stackIds: string[];
  addressToStack: Record<string, string>;
  deferDecorations?: boolean;
  pipelineCompact?: boolean;
  pipelineLayoutVariant?: import("./terraformImportDialogUtils").PipelineLayoutVariant;
  pipelinePacked?: boolean;
  pipelinePackedPullLeft?: boolean;
  pipelineIncludeAncillary?: boolean;
  pipelineSemanticPlacement?: boolean;
  pipelineExperimentalLayout?: boolean;
  colorMode?: TerraformColorMode;
};

async function buildPipelineLayoutSceneBody(
  ctx: LayoutSceneContext,
): Promise<Record<string, unknown>> {
  return withTerraformLayoutColorModeAsync(
    ctx.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
    async () => {
      // Shared as a variable (not a literal) so v2 — which reads only `compact`
      // / `includeAncillary` — tolerates the extra classic/compound keys.
      const pipelineOptions = {
        compact: ctx.pipelineCompact !== false,
        includeAncillary: ctx.pipelineIncludeAncillary === true,
        packed: ctx.pipelinePacked === true,
        packedPullLeft: ctx.pipelinePackedPullLeft === true,
        semanticPlacement: ctx.pipelineSemanticPlacement === true,
        experimentalLayout: ctx.pipelineExperimentalLayout === true,
      };
      const buildPipeline =
        ctx.pipelineLayoutVariant === "v2"
          ? buildTerraformPipelineV2ExcalidrawScene
          : ctx.pipelineLayoutVariant === "compound"
          ? buildTerraformCompoundPipelineExcalidrawScene
          : buildTerraformPipelineExcalidrawScene;
      const pipelineScene = await buildPipeline(
        ctx.nodes5,
        ctx.plan,
        pipelineOptions,
      );
      emitLocalParseDebug({
        phase: "pipelineLayout",
        meta: pipelineScene.meta,
        elementCount: pipelineScene.elements.length,
      });
      return {
        ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
        elements: pipelineScene.elements,
        meta: appendImportMeta(
          {
            ...pipelineScene.meta,
            ...(ctx.pipelinePacked ? { pipelinePacked: true } : {}),
            ...(ctx.pipelinePacked && ctx.pipelinePackedPullLeft
              ? { pipelinePackedPullLeft: true }
              : {}),
            ...(ctx.pipelineIncludeAncillary
              ? { pipelineIncludeAncillary: true }
              : {}),
            ...(ctx.pipelineSemanticPlacement
              ? { pipelineSemanticPlacement: true }
              : {}),
            ...(ctx.pipelineExperimentalLayout
              ? { pipelineExperimentalLayout: true }
              : {}),
            importSource: ctx.importSource,
            plannedChanges: ctx.importSource !== "state-only",
          },
          ctx.sources,
          formatImportWarnings(
            [...ctx.importWarnings, ...pipelineScene.warnings],
            ctx.tfdWarnings,
            ctx.tfdErrors,
          ),
          { stackIds: ctx.stackIds, addressToStack: ctx.addressToStack },
        ),
      };
    },
  );
}

async function buildSemanticLayoutSceneBody(
  ctx: LayoutSceneContext,
): Promise<Record<string, unknown>> {
  return withTerraformLayoutColorModeAsync(
    ctx.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
    async () => {
      type SemanticPlan = Parameters<
        typeof extractTerraformTopologyFromPlan
      >[0];
      const semPlan = ctx.plan as SemanticPlan;
      const awsPlan = filterPlanByProviderFamily(semPlan, "aws");
      const providerBuckets = partitionResourceChangesByProviderFamily(semPlan);

      const providerBlocks: ProviderTopologyBlock[] = [];
      let topoMeta: Record<string, unknown> = {
        layoutEngine: "topology",
        accountCount: 0,
        regionCount: 0,
        vpcCount: 0,
        subnetCount: 0,
        primaryResourceCount: 0,
        regionalPrimaryCount: 0,
        vpcEndpointCount: 0,
        routeTableCount: 0,
        dependencyEdgeCount: 0,
      };
      let layoutFiles: Record<string, unknown> | undefined;

      const awsChanges = providerBuckets.get("aws") ?? [];
      if (awsChanges.length > 0) {
        const topoModel = extractTerraformTopologyFromPlan(awsPlan);
        const zones = buildMergedTopologyZones(awsPlan);
        const regionalBuckets = extractRegionalTopologyPrimaries(awsPlan);
        const vpcEndpointBucketsRaw = extractVpcEndpointsByVpc(awsPlan);
        const {
          byZone: interfaceVpcEndpointZonePlacements,
          zonePlacedAddresses,
        } = computeInterfaceVpcEndpointZonePlacements(awsPlan, zones);
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
        const routeTableBottomPlacements =
          computeRouteTableBottomEdgePlacements(zones, awsPlan);
        mergeTopologyModelWithPlacementZones(topoModel, zones);
        mergeTopologyModelWithRegionalBuckets(topoModel, regionalBuckets);
        mergeTopologyModelWithVpcEndpoints(topoModel, vpcEndpointBuckets);
        mergeTopologyModelWithRouteTables(topoModel, routeTableBuckets);
        mergeTopologyModelWithVpcDefaults(topoModel, vpcDefaultPlumbingBuckets);
        mergeTopologyModelWithRouteTables(topoModel, vpcFlowLogBuckets);
        mergeTopologyModelWithRouteTables(
          topoModel,
          endpointSecurityGroupBuckets,
        );

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
          ctx.nodes5,
          enrichPreplaced,
        );

        if (topoModel.accounts.size > 0) {
          const topoScene = await buildTerraformTopologyExcalidrawScene(
            topoModel,
            zones,
            regionalBuckets,
            ctx.nodes5,
            awsPlan,
            vpcEndpointBuckets,
            routeTableBottomPlacements,
            vpcDefaultPlumbingBuckets,
            vpcFlowLogBuckets,
            endpointSecurityGroupBuckets,
            natZonePlacements,
            interfaceVpcEndpointZonePlacements,
            ctx.deferDecorations,
          );
          if (topoScene.elements.length > 0) {
            providerBlocks.push({
              family: "aws",
              label: "AWS",
              elements: topoScene.elements,
            });
          }
          topoMeta = { ...topoScene.meta };
          if (topoScene.files && Object.keys(topoScene.files).length > 0) {
            layoutFiles = topoScene.files;
          }
        }
      }

      for (const family of sortedNonAwsProviderFamilies(providerBuckets)) {
        const changes = providerBuckets.get(family)!;
        const providerScene = await buildProviderFamilyScene(
          family,
          getProviderFamilyLabel(family),
          changes,
          ctx.nodes5,
          semPlan,
        );
        if (providerScene.elements.length > 0) {
          providerBlocks.push({
            family,
            label: getProviderFamilyLabel(family),
            elements: providerScene.elements,
          });
        }
      }

      const composedElements =
        composeMultiProviderTopologyScene(providerBlocks);
      const represented = collectSemanticRepresentedResourceAddresses(
        composedElements as Array<{ customData?: Record<string, any> }>,
        semPlan as {
          resource_changes?: Array<{ address?: string; type?: string }>;
        },
      );
      const omittedSemanticResources = (semPlan.resource_changes || []).filter(
        (rc: { address?: string; type?: string }) =>
          typeof rc.address === "string" &&
          !represented.has(rc.address) &&
          SEMANTIC_LAYOUT_OMITTED_TYPES.has(rc.type || ""),
      );
      emitLocalParseDebug({
        phase: "topologyLayout",
        meta: topoMeta,
        elementCount: composedElements.length,
        providerBlockCount: providerBlocks.length,
      });
      return {
        ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
        elements: composedElements,
        ...(layoutFiles ? { files: layoutFiles } : {}),
        meta: appendImportMeta(
          {
            ...topoMeta,
            importSource: ctx.importSource,
            plannedChanges: ctx.importSource !== "state-only",
            representedResourceCount: represented.size,
            omittedResourceCount: omittedSemanticResources.length,
            providerBlockCount: providerBlocks.length,
          },
          ctx.sources,
          formatImportWarnings(
            ctx.importWarnings,
            ctx.tfdWarnings,
            ctx.tfdErrors,
          ),
          { stackIds: ctx.stackIds, addressToStack: ctx.addressToStack },
        ),
      };
    },
  );
}

async function buildModuleLayoutSceneBody(
  ctx: LayoutSceneContext,
  moduleLayoutOptions?: TerraformLayoutOptions["moduleLayoutOptions"],
): Promise<Record<string, unknown>> {
  const elkScene = await buildTerraformElkExcalidrawScene(
    ctx.nodes5,
    ctx.plan,
    moduleLayoutOptions,
  );
  emitLocalParseDebug({
    phase: "elkLayout",
    meta: elkScene.meta,
    elementCount: elkScene.elements.length,
  });
  return {
    ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
    elements: elkScene.elements,
    meta: appendImportMeta(
      {
        ...elkScene.meta,
        importSource: ctx.importSource,
        plannedChanges: ctx.importSource !== "state-only",
      },
      ctx.sources,
      formatImportWarnings(ctx.importWarnings, ctx.tfdWarnings, ctx.tfdErrors),
    ),
  };
}

/** Sequential layout (main-thread fallback and single-bundle paths). */
export async function layoutTerraformFromSources(
  sources: TerraformPlanParsingSources,
  options?: TerraformLayoutOptions,
): Promise<LayoutTerraformResult> {
  const compositionResult = applyTfdCompositionToLayoutSources(
    sources,
    options,
  );
  if ("ok" in compositionResult) {
    return compositionResult;
  }
  sources = compositionResult.sources;

  const layoutMode =
    options?.layoutMode ??
    (options?.semanticLayout === true ? "semantic" : "module");
  const semanticLayout = layoutMode === "semantic";
  // Experimental view rides the pipeline builder (needs TFD edges, same
  // validation + routing) with the Phase A/B engine enabled.
  const pipelineLayout =
    layoutMode === "pipeline" || layoutMode === "experimental";
  if (sources.planDotBundles.length > 0) {
    terraformImportProfilerMeasure("prep.cache", () => {
      buildTerraformImportPrepCache(sources, options);
    });
  } else {
    clearTerraformImportPrepCache();
  }

  const planResolution = terraformImportProfilerMeasure("merge.plans", () =>
    resolveLayoutPlanFromSources(sources),
  );
  if (!planResolution.ok) {
    return planResolution;
  }
  const {
    plan,
    adjacency,
    importSource,
    sourcePlans,
    stackIds,
    addressToStack,
    importWarnings,
  } = planResolution;
  const states = sources.states ?? [];

  const layoutValidation = validateLayoutPlanForMode(
    plan,
    semanticLayout,
    pipelineLayout,
  );
  if (!layoutValidation.ok) {
    return layoutValidation;
  }

  const graph = graphlibDot.read("digraph G {}\n");

  emitLocalParseDebug({
    phase: "init",
    plan,
    states,
    bundleCount: sources.planDotBundles.length,
  });

  const tfdTexts = [
    ...sources.tfdTexts.filter((t) => t.trim()),
    ...(options?.dataflowLinks?.trim() ? [options.dataflowLinks] : []),
  ];

  const prepCache = getTerraformImportPrepCache();
  const useCachedNodes =
    prepCache &&
    prepCache.fingerprint === terraformImportPrepFingerprint(sources) &&
    states.length === 0;

  let nodes5: ReturnType<typeof buildTerraformLocalImportNodesMap>;
  let tfdErrors: string[] = [];
  let tfdWarnings: string[] = [];
  if (useCachedNodes) {
    nodes5 = prepCache.nodes;
  } else {
    nodes5 = terraformImportProfilerMeasure("parse.nodes", () =>
      buildTerraformLocalImportNodesMap(plan, graph, states, {
        adjacency,
        priorStatePlans: sourcePlans,
        stackIds,
      }),
    );
    ({ errors: tfdErrors, warnings: tfdWarnings } =
      terraformImportProfilerMeasure("parse.tfd", () =>
        applyTfdOverlayToNodes(
          nodes5,
          sources.tfdTexts,
          sources.tfdLabels,
          options?.dataflowLinks,
        ),
      ));
  }

  const hasTfdEdgeSyntax = tfdTexts.some((t) => /\S+\s*->\s*\S+/.test(t));
  const declaredEdges = nodes5[DECLARED_DATAFLOW_ORDERED_KEY];
  if (hasTfdEdgeSyntax && (!declaredEdges || declaredEdges.length === 0)) {
    return {
      ok: false,
      status: 400,
      error:
        "Dataflow links (.tfd) could not be resolved to any resources in the merged import.",
    };
  }
  if (pipelineLayout && (!declaredEdges || declaredEdges.length === 0)) {
    return {
      ok: false,
      status: 400,
      error: "Pipeline view requires at least one resolved .tfd dataflow edge.",
    };
  }

  emitLocalParseDebug({
    phase: "planParsed_through_moduleTree",
    nodes: nodes5,
    moduleTree: nodes5[TERRAFORM_MODULE_TREE_KEY],
  });

  const sceneContext: LayoutSceneContext = {
    sources,
    plan,
    nodes5,
    importSource,
    importWarnings,
    tfdErrors,
    tfdWarnings,
    stackIds,
    addressToStack,
    deferDecorations: options?.deferDecorations === true,
    pipelineCompact: options?.pipelineCompact,
    pipelineLayoutVariant: options?.pipelineLayoutVariant,
    pipelinePacked: options?.pipelinePacked === true,
    pipelinePackedPullLeft: options?.pipelinePackedPullLeft === true,
    pipelineIncludeAncillary: options?.pipelineIncludeAncillary === true,
    pipelineSemanticPlacement: options?.pipelineSemanticPlacement === true,
    pipelineExperimentalLayout: layoutMode === "experimental",
    colorMode: options?.colorMode,
  };

  const sceneBody = pipelineLayout
    ? await terraformImportProfilerMeasureAsync("layout.pipeline", () =>
        buildPipelineLayoutSceneBody(sceneContext),
      )
    : semanticLayout
    ? await terraformImportProfilerMeasureAsync("layout.semantic", () =>
        buildSemanticLayoutSceneBody(sceneContext),
      )
    : await terraformImportProfilerMeasureAsync("layout.elk", () =>
        buildModuleLayoutSceneBody(sceneContext, options?.moduleLayoutOptions),
      );

  return { ok: true, scene: sceneBody };
}

export type { TerraformModuleLayoutOptions };
