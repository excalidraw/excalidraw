/**
 * Worker-safe Terraform layout: merge plans, run semantic / module / pipeline layout,
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
  computeNatGatewayZonePlacements,
  collectRouteAddressesFromBottomPlacements,
  computeRouteTableBottomEdgePlacements,
  extractInterfaceEndpointSecurityGroupBuckets,
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
  extractRouteTablesByVpc,
  extractSupplementarySubnetZones,
  extractVpcDefaultPlumbingBuckets,
  extractVpcEndpointsByVpc,
  extractVpcFlowLogBundles,
  filterVpcEndpointBucketsRemovingZonePlacedAddresses,
  mergePrimaryTopologyZonesByTier,
  reconcileTopologyPlacementZonesAfterEnrich,
  mergeSupplementarySubnetZonesByTier,
  mergeSupplementarySubnetZonesSharedRouteTable,
} from "./terraformTopologyPlacement";
import { enrichTopologyPlacementsWithManagedResources } from "./terraformTopologyPlacementEnrich";
import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";
import { buildTerraformPipelineExcalidrawScene } from "./terraformPipelineLayout";
import {
  DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE,
  DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE,
} from "./terraformPipelineLayoutMode";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
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

function collectSemanticRepresentedResourceAddresses(
  elements: Array<{ customData?: Record<string, any> }>,
  plan: { resource_changes?: Array<{ address?: string; type?: string }> },
): Set<string> {
  const represented = new Set<string>();
  const representedSubnetIds = new Set<string>();
  for (const element of elements) {
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
        const address = resource?.address;
        if (typeof address === "string") {
          represented.add(address);
        }
      }
    }
  }
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
  return represented;
}

function formatImportWarnings(
  warnings: TerraformImportWarning[],
  tfdWarnings: string[],
): TerraformImportWarning[] {
  const out = [...warnings];
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

/** Sequential layout (main-thread fallback and pipeline / single-bundle paths). */
export async function layoutTerraformFromSources(
  sources: TerraformPlanParsingSources,
  options?: TerraformLayoutOptions,
): Promise<LayoutTerraformResult> {
  const semanticLayout =
    options?.semanticLayout === true && options?.pipelineLayout !== true;
  const pipelineLayout = options?.pipelineLayout === true;
  const pipelineLayoutMode =
    options?.pipelineLayoutMode ?? DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE;
  const pipelineVerticalSolverMode =
    options?.pipelineVerticalSolverMode ??
    DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE;
  const importWarnings: TerraformImportWarning[] = [];
  let plan: unknown;
  let adjacency: Record<string, string[]>;
  let importSource: "plan" | "state-only" = "plan";
  let sourcePlans: unknown[] = [];
  let stackIds: string[] = [];
  let addressToStack: Record<string, string> = {};
  const states = sources.states ?? [];

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

  if (semanticLayout || pipelineLayout) {
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
        error:
          "Semantic and pipeline layout require at least one managed resource in the plan or state file.",
      };
    }
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

  const nodes5 = buildTerraformLocalImportNodesMap(plan, graph, states, {
    adjacency,
    priorStatePlans: sourcePlans,
    stackIds,
  });

  const tfdWarnings = applyTfdOverlayToNodes(
    nodes5,
    sources.tfdTexts,
    sources.tfdLabels,
    options?.dataflowLinks,
  );

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

  emitLocalParseDebug({
    phase: "planParsed_through_moduleTree",
    nodes: nodes5,
    moduleTree: nodes5[TERRAFORM_MODULE_TREE_KEY],
  });

  let sceneBody: Record<string, unknown>;

  if (pipelineLayout) {
    const declared = nodes5[DECLARED_DATAFLOW_ORDERED_KEY];
    if (!declared || declared.length === 0) {
      return {
        ok: false,
        status: 400,
        error:
          "Pipeline layout requires a `.tfd` file with at least one resolved dataflow edge.",
      };
    }
    const atomGraph = buildPipelineAtomGraph(nodes5, plan, tfdTexts);
    if (!atomGraph || atomGraph.atoms.size === 0) {
      return {
        ok: false,
        status: 400,
        error:
          "Pipeline layout could not resolve any layout atoms from the `.tfd` binds.",
      };
    }

    const pipelineScene = await buildTerraformPipelineExcalidrawScene(
      nodes5,
      plan,
      tfdTexts,
      { pipelineLayoutMode, pipelineVerticalSolverMode },
    );
    emitLocalParseDebug({
      phase: "pipelineLayout",
      meta: pipelineScene.meta,
      elementCount: pipelineScene.elements.length,
    });
    sceneBody = {
      ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
      elements: pipelineScene.elements,
      ...(pipelineScene.files ? { files: pipelineScene.files } : {}),
      meta: appendImportMeta(
        {
          ...pipelineScene.meta,
          importSource,
          plannedChanges: importSource !== "state-only",
          representedResourceCount: pipelineScene.meta.atomCount,
          omittedResourceCount: 0,
        },
        sources,
        formatImportWarnings(importWarnings, tfdWarnings),
        { stackIds, addressToStack },
      ),
    };
  } else if (semanticLayout) {
    type SemanticPlan = Parameters<typeof extractTerraformTopologyFromPlan>[0];
    const semPlan = plan as SemanticPlan;
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
      const primaryZones = mergePrimaryTopologyZonesByTier(
        extractPrimaryTopologyZones(awsPlan).map((z) => ({
          ...z,
          topologyZoneSource: "primary" as const,
        })),
        awsPlan,
      );
      const supplementaryZones = extractSupplementarySubnetZones(
        awsPlan,
        primaryZones,
      ).map((z) => ({
        ...z,
        topologyZoneSource: "supplementary" as const,
      }));
      const zones = mergeSupplementarySubnetZonesByTier(
        mergeSupplementarySubnetZonesSharedRouteTable(
          [...primaryZones, ...supplementaryZones].sort((a, b) => {
            if (a.accountId !== b.accountId) {
              return a.accountId.localeCompare(b.accountId);
            }
            if (a.region !== b.region) {
              return a.region.localeCompare(b.region);
            }
            if (a.vpcId !== b.vpcId) {
              return a.vpcId.localeCompare(b.vpcId);
            }
            return a.subnetSignature.localeCompare(b.subnetSignature);
          }),
          awsPlan,
        ),
        awsPlan,
      );
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
      const rawVpcDefaultPlumbingBuckets =
        extractVpcDefaultPlumbingBuckets(awsPlan);
      const natZonePlacements = computeNatGatewayZonePlacements(awsPlan, zones);
      const vpcDefaultPlumbingBuckets =
        natZonePlacements.consumedAddresses.size === 0
          ? rawVpcDefaultPlumbingBuckets
          : rawVpcDefaultPlumbingBuckets
              .map((b) => ({
                ...b,
                addresses: b.addresses.filter(
                  (a) => !natZonePlacements.consumedAddresses.has(a),
                ),
              }))
              .filter((b) => b.addresses.length > 0);
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
      mergeTopologyModelWithRouteTables(
        topoModel,
        endpointSecurityGroupBuckets,
      );

      const enrichPreplaced = new Set<string>();
      for (const z of zones) {
        for (const a of z.addresses) {
          enrichPreplaced.add(a);
        }
      }
      for (const b of regionalBuckets) {
        for (const a of b.addresses) {
          enrichPreplaced.add(a);
        }
      }
      for (const b of vpcEndpointBuckets) {
        for (const a of b.addresses) {
          enrichPreplaced.add(a);
        }
      }
      for (const b of routeTableBuckets) {
        for (const a of b.addresses) {
          enrichPreplaced.add(a);
        }
      }
      for (const b of vpcDefaultPlumbingBuckets) {
        for (const a of b.addresses) {
          enrichPreplaced.add(a);
        }
      }
      for (const b of vpcFlowLogBuckets) {
        for (const a of b.addresses) {
          enrichPreplaced.add(a);
        }
      }
      for (const b of endpointSecurityGroupBuckets) {
        for (const a of b.addresses) {
          enrichPreplaced.add(a);
        }
      }
      for (const a of natZonePlacements.consumedAddresses) {
        enrichPreplaced.add(a);
      }
      for (const p of zonePlacedAddresses) {
        enrichPreplaced.add(p);
      }
      for (const a of collectRouteAddressesFromBottomPlacements(
        routeTableBottomPlacements,
      )) {
        enrichPreplaced.add(a);
      }
      enrichTopologyPlacementsWithManagedResources(
        awsPlan,
        zones,
        regionalBuckets,
        {
          nodes: nodes5,
          plan: awsPlan,
          preplacedAddresses: enrichPreplaced,
        },
      );
      reconcileTopologyPlacementZonesAfterEnrich(zones, awsPlan);

      if (topoModel.accounts.size > 0) {
        const topoScene = await buildTerraformTopologyExcalidrawScene(
          topoModel,
          zones,
          regionalBuckets,
          nodes5,
          awsPlan,
          vpcEndpointBuckets,
          routeTableBottomPlacements,
          vpcDefaultPlumbingBuckets,
          vpcFlowLogBuckets,
          endpointSecurityGroupBuckets,
          natZonePlacements,
          interfaceVpcEndpointZonePlacements,
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
        nodes5,
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

    const composedElements = composeMultiProviderTopologyScene(providerBlocks);
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
    sceneBody = {
      ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
      elements: composedElements,
      ...(layoutFiles ? { files: layoutFiles } : {}),
      meta: appendImportMeta(
        {
          ...topoMeta,
          importSource,
          plannedChanges: importSource !== "state-only",
          representedResourceCount: represented.size,
          omittedResourceCount: omittedSemanticResources.length,
          providerBlockCount: providerBlocks.length,
        },
        sources,
        formatImportWarnings(importWarnings, tfdWarnings),
        { stackIds, addressToStack },
      ),
    };
  } else {
    const elkScene = await buildTerraformElkExcalidrawScene(
      nodes5,
      plan,
      options?.moduleLayoutOptions,
    );
    emitLocalParseDebug({
      phase: "elkLayout",
      meta: elkScene.meta,
      elementCount: elkScene.elements.length,
    });
    sceneBody = {
      ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
      elements: elkScene.elements,
      meta: appendImportMeta(
        {
          ...elkScene.meta,
          importSource,
          plannedChanges: importSource !== "state-only",
        },
        sources,
        formatImportWarnings(importWarnings, tfdWarnings),
      ),
    };
  }

  return { ok: true, scene: sceneBody };
}

export type { TerraformModuleLayoutOptions };
