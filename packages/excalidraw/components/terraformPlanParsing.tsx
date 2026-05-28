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
  mergeSupplementarySubnetZonesByTier,
  mergeSupplementarySubnetZonesSharedRouteTable,
} from "./terraformTopologyPlacement";
import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  buildDataFlowEdges,
  buildNetworkingEdges,
} from "./terraformDataFlowEdges";
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
  applyDeclaredDataFlow,
  applyDeclaredDataFlowFromMany,
  DECLARED_DATAFLOW_ORDERED_KEY,
  type DeclaredDataFlowEdge,
} from "./terraformDeclaredDataFlow";
import {
  mergeDotAdjacency,
  mergePlanJsons,
  mergePlanWithStates,
  mergeSyntheticPlans,
  namespacePlanDotBundles,
  parseRawStateJson,
} from "./terraformImportMerge";
import {
  collectKnownStackIdsFromNodes,
  isStackQualifiedAddress,
  preferTopologyNodeKeyAmongAliases,
  prefixStackAddress,
  stripStackPrefixForModuleParsing,
  topologyBareAddressKey,
} from "./terraformStackAddress";
import { dedupeTerraformPlanNodesByBareAddress } from "./terraformTopologyAddress";

import type { Graph } from "@dagrejs/graphlib";
import type {
  TerraformImportWarning,
  TerraformPlanDotBundle,
} from "./terraformImportMerge";

export type { TerraformImportWarning, TerraformPlanDotBundle };

export type TerraformPlanParsingSources = {
  planDotBundles: TerraformPlanDotBundle[];
  states: unknown[];
  stateLabels?: (string | undefined)[];
  tfdTexts: string[];
  tfdLabels?: (string | undefined)[];
};

export { TERRAFORM_MODULE_TREE_KEY };

/**
 * Empty Excalidraw v2 scene — same shape as backend `GET …/upload/:id/excalidraw`
 * (`renderUploadAs` → `result.body` from `packages/backend/connectors/excalidraw.js`).
 */
const EMPTY_TERRAFORM_EXCALIDRAW_SCENE = {
  type: "excalidraw" as const,
  version: 2,
  source: "terraform-local-parse",
  elements: [],
  appState: {
    viewBackgroundColor: "#ffffff",
    gridSize: null as number | null,
  },
};

const DEBUG_PREFIX = "[terraform:local-parse]";

const TERRAFORM_MODULE_RESOURCE_TYPE = "terraform_module";

/** One node in the module tree: child modules + resource addresses declared in this module. */
export type TerraformModuleTreeNode = {
  path: string;
  modules: Record<string, TerraformModuleTreeNode>;
  resourceAddresses: string[];
};

/** Nodes map may include {@link TERRAFORM_MODULE_TREE_KEY} alongside per-address graph nodes. */
export type TerraformPlanNodesMap = Record<string, TerraformPlanGraphNode> & {
  [TERRAFORM_MODULE_TREE_KEY]?: TerraformModuleTreeNode;
  [DECLARED_DATAFLOW_ORDERED_KEY]?: DeclaredDataFlowEdge[];
};

/** One semantic data-flow edge (mirrors backend `edges_data_flow` object shape). */
export type TerraformPlanDataFlowEdge = {
  target: string;
  type?: string;
  label?: string;
  origin?: string;
  detail?: string | null;
};

/** Matches backend pipeline nodes: resources plus mutable edge buckets (see `ensureEdgeLists`). */
export type TerraformPlanGraphNode = {
  resources: Record<string, unknown>;
  edges_new?: string[];
  edges_existing?: string[];
  edges_data_flow?: Array<string | TerraformPlanDataFlowEdge>;
  edges_networking?: Array<string | TerraformPlanDataFlowEdge>;
};

/** Subset of `terraform show -json` prior_state.values.root_module shape used by `buildExistingEdges`. */
type TerraformPriorStateModule = {
  resources?: TerraformPriorStateResource[];
  child_modules?: TerraformPriorStateModule[];
};

type TerraformPriorStateResource = {
  address?: string;
  mode?: string;
  type?: string;
  depends_on?: string[];
};

/**
 * Browser-only: logs in dev when local parse runs (`import.meta.env.DEV`).
 * Look in the **browser** DevTools → **Console** (not the terminal where `yarn start` runs).
 * Use `console.log` so lines show at default log levels (`console.debug` is often hidden until
 * you enable “Verbose” in Chrome’s console level filter).
 */
function emitLocalParseDebug(payload: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return;
  }
  // eslint-disable-next-line no-console -- intentional dev-only parse tracing
  console.log(DEBUG_PREFIX, payload);
}

/** Strip `count` / `for_each` instance keys so graph ids match `terraform graph` / `depends_on` variants. */
const stripTerraformAddressIndexes = (address = "") =>
  address.replace(/\[[^\]]+\]/g, "");

export type TerraformPlanParsingOptions = {
  /** When true, emit nested AWS topology frames (local import only); otherwise ELK module graph. */
  semanticLayout?: boolean;
  /** Optional `.tfd` arrow-only dataflow overlay (single file; prefer `tfdTexts` on sources). */
  dataflowLinks?: string;
};

type BuildNodesMapOptions = {
  priorStatePlans?: unknown[];
  adjacency?: Record<string, string[]>;
  /** Parallel to `tfstate` files when multi-stack; used to avoid unqualified ghost nodes. */
  stackIds?: string[];
};

const DATA_SOURCE_GRAPH_ALLOWLIST = new Set(["aws_iam_policy_document"]);
const SEMANTIC_LAYOUT_OMITTED_TYPES = new Set(["terraform_data"]);

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

function isExcludedDataSourceAddressForGraph(address: string): boolean {
  const parts = stripTerraformAddressIndexes(address).split(".");
  const di = parts.indexOf("data");
  if (di === -1 || di >= parts.length - 2) {
    return false;
  }
  const sourceType = parts[di + 1] || "";
  return !DATA_SOURCE_GRAPH_ALLOWLIST.has(sourceType);
}

type TerraformStateResource = {
  module?: string;
  mode?: string;
  type?: string;
  name?: string;
  provider?: string;
  instances?: Array<{
    index_key?: unknown;
    attributes?: Record<string, unknown>;
    schema_version?: number;
    private?: unknown;
    dependencies?: string[];
  }>;
};

/** Builds the Terraform state address for one resource instance (mirrors backend `getStateResourceAddress`). */
function getStateResourceAddress(
  resource: TerraformStateResource,
  instance: NonNullable<TerraformStateResource["instances"]>[number],
): string {
  const parts: string[] = [];
  if (resource.module) {
    parts.push(resource.module);
  }
  if (resource.mode === "data") {
    parts.push("data");
  }
  parts.push(resource.type || "", resource.name || "");
  let address = parts.join(".");
  if (Object.prototype.hasOwnProperty.call(instance, "index_key")) {
    const key = instance.index_key;
    address +=
      typeof key === "number" ? `[${key}]` : `[${JSON.stringify(key)}]`;
  }
  return address;
}

/** Merges raw tfstate `resources` into nodes (same semantics as backend `mergeTerraformState`). */
function mergeRawTerraformStateIntoNodes(
  nodes: Record<string, TerraformPlanGraphNode>,
  state: unknown,
  stackId?: string,
): Record<string, TerraformPlanGraphNode> {
  if (!state || typeof state !== "object") {
    return nodes;
  }
  const resources = (state as { resources?: unknown }).resources;
  if (!Array.isArray(resources)) {
    return nodes;
  }

  for (const resource of resources as TerraformStateResource[]) {
    if (
      resource.mode === "data" &&
      resource.type &&
      !DATA_SOURCE_GRAPH_ALLOWLIST.has(resource.type)
    ) {
      continue;
    }

    for (const instance of resource.instances || []) {
      const rawAddress = getStateResourceAddress(resource, instance);
      const address =
        stackId?.trim() && !isStackQualifiedAddress(rawAddress)
          ? prefixStackAddress(stackId.trim(), rawAddress)
          : rawAddress;
      const nodePath = address;

      if (!nodes[nodePath]) {
        nodes[nodePath] = { resources: {} };
      }

      const existingResource = (nodes[nodePath].resources[address] ||
        {}) as Record<string, unknown>;
      nodes[nodePath].resources[address] = {
        ...existingResource,
        address,
        mode: resource.mode,
        type: resource.type,
        name: resource.name,
        provider_name: resource.provider,
        values: {
          ...((instance.attributes || {}) as Record<string, unknown>),
          ...(existingResource.values as Record<string, unknown> | undefined),
        },
        change: existingResource.change || { actions: ["existing"] },
        terraform_state: {
          schema_version: instance.schema_version,
          private: Boolean(instance.private),
          dependencies: instance.dependencies || [],
        },
      };

      nodes[nodePath].edges_existing ||= [];
      for (const dependency of instance.dependencies || []) {
        if (!dependency || isExcludedDataSourceAddressForGraph(dependency)) {
          continue;
        }
        const qualifiedDep =
          stackId?.trim() && !isStackQualifiedAddress(dependency)
            ? prefixStackAddress(stackId.trim(), dependency)
            : dependency;
        const target = resolveTerraformPlanNodeKey(nodes, qualifiedDep);
        if (
          target &&
          target !== nodePath &&
          !nodes[nodePath].edges_existing!.includes(target)
        ) {
          nodes[nodePath].edges_existing!.push(target);
        }
      }
    }
  }

  return nodes;
}

/**
 * Builds the same `nodes` map as local import (`loadPlan` → edges → `attachModuleTree`), for
 * tooling/tests that need vertex keys without rendering a scene.
 */
function normalizeTfstateList(tfstate?: unknown | null | unknown[]): unknown[] {
  if (Array.isArray(tfstate)) {
    return tfstate;
  }
  if (tfstate != null) {
    return [tfstate];
  }
  return [];
}

export function buildTerraformLocalImportNodesMap(
  plan: unknown,
  graph: Graph,
  tfstate?: unknown | null | unknown[],
  options?: BuildNodesMapOptions,
): TerraformPlanNodesMap {
  const adjacency = options?.adjacency ?? getAdjacencyListFromDot(graph);
  const planTyped = plan as {
    resource_changes: { address: string }[];
    prior_state?: { values: { root_module: unknown } };
  };
  let nodes = loadPlan(planTyped);
  const stackIds = options?.stackIds ?? [];
  const stateList = normalizeTfstateList(tfstate);
  for (let si = 0; si < stateList.length; si++) {
    const stackId = stackIds[si]?.trim();
    nodes = mergeRawTerraformStateIntoNodes(
      nodes,
      stateList[si]!,
      stackId || undefined,
    );
  }
  nodes = dedupeTerraformPlanNodesByBareAddress(nodes);
  const nodes2 = sanitizeTerraformPlanNodes(ensureEdgeLists(nodes));
  const nodes3 = buildNewEdges(nodes2, adjacency);
  let nodes4 = nodes3;
  const priorPlans = options?.priorStatePlans?.length
    ? options.priorStatePlans
    : [planTyped];
  for (const priorPlan of priorPlans) {
    const root = (
      priorPlan as { prior_state?: { values?: { root_module?: unknown } } }
    )?.prior_state?.values?.root_module;
    if (root) {
      nodes4 = buildExistingEdges(
        nodes4,
        priorPlan as { prior_state: { values: { root_module: unknown } } },
      );
    }
  }
  const sanitizedNodes = sanitizeTerraformPlanNodes(nodes4);
  const withTree = attachModuleTree(sanitizedNodes);
  buildDataFlowEdges(withTree as Record<string, unknown>);
  buildNetworkingEdges(withTree as Record<string, unknown>);
  return withTree;
}

/** Apply `.tfd` overlay after the nodes map is built; returns warning messages. */
export function applyTfdOverlayToNodes(
  nodes: TerraformPlanNodesMap,
  tfdTexts: string[],
  tfdLabels?: (string | undefined)[],
  legacySingleText?: string,
): string[] {
  const texts = [
    ...tfdTexts.filter((t) => t.trim()),
    ...(legacySingleText?.trim() ? [legacySingleText] : []),
  ];
  if (texts.length === 0) {
    return [];
  }
  if (texts.length === 1 && tfdTexts.length === 0 && legacySingleText) {
    applyDeclaredDataFlow(
      nodes as Record<string, TerraformPlanGraphNode>,
      texts[0],
    );
    return [];
  }
  const { warnings } = applyDeclaredDataFlowFromMany(
    nodes as Record<string, TerraformPlanGraphNode>,
    texts,
    tfdLabels,
  );
  return warnings;
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

/** Multi-file local import (plans, states, `.tfd` overlays). */
export const terraformPlanParsingFromSources = async (
  sources: TerraformPlanParsingSources,
  options?: TerraformPlanParsingOptions,
) => {
  const semanticLayout = options?.semanticLayout === true;
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
      return new Response(
        JSON.stringify({
          error:
            "Upload at least one plan JSON + graph DOT pair, or one or more raw Terraform state files.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
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
    // Multi-stack plan imports: each tfstate belongs to its own root. Merging many
    // state files into one plan duplicates almost every address (hundreds of warnings)
    // and "last wins" across stacks. Only enrich from state for single-bundle imports.
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

  if (semanticLayout) {
    const rc = (plan as { resource_changes?: unknown[] }).resource_changes;
    if (
      !Array.isArray(rc) ||
      rc.length === 0 ||
      !hasManagedResourcesForSemantic(
        plan as { resource_changes?: Array<{ mode?: string; type?: string }> },
      )
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Semantic layout requires at least one managed resource in the plan or state file.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
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
    return new Response(
      JSON.stringify({
        error:
          "Dataflow links (.tfd) could not be resolved to any resources in the merged import.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  emitLocalParseDebug({
    phase: "planParsed_through_moduleTree",
    nodes: nodes5,
    moduleTree: nodes5[TERRAFORM_MODULE_TREE_KEY],
  });

  let sceneBody: Record<string, unknown>;

  if (semanticLayout) {
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
      const primaryZones = extractPrimaryTopologyZones(awsPlan).map((z) => ({
        ...z,
        topologyZoneSource: "primary" as const,
      }));
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
    const elkScene = await buildTerraformElkExcalidrawScene(nodes5, plan);
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

  return new Response(JSON.stringify(sceneBody), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/** Single-file import API (delegates to {@link terraformPlanParsingFromSources}). */
export const terraformPlanParsing = async (
  planFile: File | null,
  dotFile: File | null,
  stateFile: File | null,
  options?: TerraformPlanParsingOptions,
) => {
  const planDotBundles: TerraformPlanDotBundle[] = [];
  const states: unknown[] = [];

  if (planFile && dotFile) {
    const [planText, dotText] = await Promise.all([
      planFile.text(),
      dotFile.text(),
    ]);
    try {
      planDotBundles.push({
        plan: JSON.parse(planText),
        dotText,
        label: planFile.name,
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "planFile must be valid JSON." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  } else if (planFile || dotFile) {
    return new Response(
      JSON.stringify({
        error:
          "Plan JSON and graph DOT must be selected together, or clear both and upload state file(s) alone.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (stateFile) {
    const stateText = await stateFile.text();
    const parsed = parseRawStateJson(stateText);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    states.push(parsed.state);
  }

  if (planDotBundles.length === 0 && states.length === 0) {
    return new Response(
      JSON.stringify({
        error:
          "Upload plan JSON + DOT together, or one or more raw Terraform state files.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return terraformPlanParsingFromSources(
    {
      planDotBundles,
      states,
      stateLabels: states.length ? [stateFile?.name] : undefined,
      tfdTexts: [],
    },
    options,
  );
};

const sanitizeDotNodeId = (nodeId = "") => {
  const parts = String(nodeId).trim().split(" ");
  const raw = parts.length >= 2 ? parts[1] : parts[0] || "";
  return raw.replace(/["\\]/g, "");
};

function getAdjacencyListFromDot(graph: Graph) {
  const adjacency: Record<string, string[]> = {};

  for (const { v, w } of graph.edges()) {
    const source = sanitizeDotNodeId(v);
    const target = sanitizeDotNodeId(w);
    if (!adjacency[source]) {
      adjacency[source] = [];
    }
    if (!adjacency[source].includes(target)) {
      adjacency[source].push(target);
    }
  }

  return adjacency;
}

/**
 * Map a Terraform address (plan / prior_state / `depends_on`) to a key in `nodes`.
 * Plan keys often include instance keys (`[0]`, `["a"]`) while `prior_state.depends_on` may omit them;
 * matches backend `packages/backend/pipeline.js` `resolveCanonicalNodePath`.
 */
export function resolveTerraformPlanNodeKey(
  nodes: Record<string, TerraformPlanGraphNode>,
  address: string,
): string | null {
  if (
    !address ||
    typeof address !== "string" ||
    address === TERRAFORM_MODULE_TREE_KEY
  ) {
    return null;
  }

  const bareKey = topologyBareAddressKey(address);
  const bareAliases: string[] = [];
  for (const k of Object.keys(nodes)) {
    if (k === TERRAFORM_MODULE_TREE_KEY || k.startsWith("__")) {
      continue;
    }
    if (topologyBareAddressKey(k) === bareKey) {
      bareAliases.push(k);
    }
  }
  if (bareAliases.length > 0) {
    return preferTopologyNodeKeyAmongAliases(bareAliases);
  }

  const graphId = stripTerraformAddressIndexes(address);

  const knownStackIds = collectKnownStackIdsFromNodes(nodes);
  if (knownStackIds.length > 0 && !address.includes("::")) {
    const qualifiedMatches: string[] = [];
    for (const stackId of knownStackIds) {
      const qualified = prefixStackAddress(stackId, address);
      if (nodes[qualified]) {
        qualifiedMatches.push(qualified);
      }
      const qualifiedStripped = prefixStackAddress(stackId, graphId);
      if (nodes[qualifiedStripped]) {
        qualifiedMatches.push(qualifiedStripped);
      }
    }
    const uniqueQualified = [...new Set(qualifiedMatches)];
    if (uniqueQualified.length === 1) {
      return uniqueQualified[0]!;
    }
    if (uniqueQualified.length > 1) {
      return null;
    }
  }

  const matches: string[] = [];
  for (const k of Object.keys(nodes)) {
    if (k === TERRAFORM_MODULE_TREE_KEY || k.startsWith("__")) {
      continue;
    }
    if (stripTerraformAddressIndexes(k) === graphId) {
      matches.push(k);
    }
  }
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    return preferTopologyNodeKeyAmongAliases(matches);
  }
  return null;
}

const IAM_POLICY_DOCUMENT_DATA_TYPE = "aws_iam_policy_document";

const MEANINGFUL_POLICY_FIELDS = [
  "json",
  "minified_json",
  "policy",
  "source_json",
  "override_json",
  "source_policy_documents",
  "override_policy_documents",
] as const;

function primaryTerraformResource(node: TerraformPlanGraphNode) {
  return Object.values(node.resources || {})[0] as
    | Record<string, unknown>
    | undefined;
}

function isNonEmptyValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return value != null;
}

function hasMeaningfulIamPolicyDocumentContent(
  resource: Record<string, unknown>,
) {
  const change = resource.change as
    | { after?: Record<string, unknown> }
    | undefined;
  const candidates = [
    resource.values as Record<string, unknown> | undefined,
    change?.after,
  ].filter(Boolean) as Record<string, unknown>[];

  for (const values of candidates) {
    for (const field of MEANINGFUL_POLICY_FIELDS) {
      if (isNonEmptyValue(values[field])) {
        return true;
      }
    }
    if (Array.isArray(values.statement) && values.statement.length > 0) {
      return true;
    }
  }

  return false;
}

function shouldPruneTerraformDataNode(node: TerraformPlanGraphNode) {
  const resource = primaryTerraformResource(node);
  if (!resource || resource.mode !== "data") {
    return false;
  }

  if (resource.type !== IAM_POLICY_DOCUMENT_DATA_TYPE) {
    return true;
  }

  return !hasMeaningfulIamPolicyDocumentContent(resource);
}

function pruneEdgeList(edges: string[] | undefined, pruned: Set<string>) {
  return (edges || []).filter((edge) => !pruned.has(edge));
}

function pruneDataFlowEdges(edges: unknown, pruned: Set<string>) {
  if (!Array.isArray(edges)) {
    return [];
  }
  return edges.filter((edge) => {
    if (typeof edge === "string") {
      return !pruned.has(edge);
    }
    if (edge && typeof edge === "object") {
      const target = (edge as { target?: unknown }).target;
      return typeof target !== "string" || !pruned.has(target);
    }
    return true;
  }) as string[];
}

export function sanitizeTerraformPlanNodes<
  T extends Record<string, TerraformPlanGraphNode>,
>(nodes: T): T {
  const pruned = new Set<string>();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath === TERRAFORM_MODULE_TREE_KEY || nodePath.startsWith("__")) {
      continue;
    }
    if (shouldPruneTerraformDataNode(node)) {
      pruned.add(nodePath);
    }
  }

  if (pruned.size === 0) {
    return nodes;
  }

  for (const nodePath of pruned) {
    delete nodes[nodePath];
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath === TERRAFORM_MODULE_TREE_KEY || nodePath.startsWith("__")) {
      continue;
    }
    node.edges_new = pruneEdgeList(node.edges_new, pruned);
    node.edges_existing = pruneEdgeList(node.edges_existing, pruned);
    node.edges_data_flow = pruneDataFlowEdges(node.edges_data_flow, pruned);
  }

  return nodes;
}

function loadPlan(plan: { resource_changes: { address: string }[] }) {
  const nodes: Record<string, TerraformPlanGraphNode> = {};
  const resourceChanges = plan.resource_changes || [];

  for (const resourceChange of resourceChanges) {
    const address = resourceChange.address;
    const nodePath = address;
    if (!nodes[nodePath]) {
      nodes[nodePath] = { resources: {} };
    }
    nodes[nodePath].resources[address] = resourceChange;
  }

  return nodes;
}

function getModulePathChainFromAddress(nodePath = "") {
  const parts = stripStackPrefixForModuleParsing(nodePath).split(".");
  const chain = [];
  let cursor = "";

  for (let index = 0; index < parts.length - 1; ) {
    if (parts[index] !== "module" || !parts[index + 1]) {
      break;
    }
    const segment = `module.${parts[index + 1]}`;
    cursor = cursor ? `${cursor}.${segment}` : segment;
    chain.push(cursor);
    index += 2;
  }

  return chain;
}

function emptyModuleTreeNode(path: string): TerraformModuleTreeNode {
  return { path, modules: {}, resourceAddresses: [] };
}

/**
 * Deepest Terraform module path that owns this address, or `"root"` for the root module.
 * Example: `module.vpc.aws_subnet.a` → `module.vpc`; `aws_instance.x` → `root`.
 */
function getContainingModulePathForAddress(address: string): string {
  const parts = stripStackPrefixForModuleParsing(address).split(".");
  let index = 0;
  let modulePath = "";
  while (
    index < parts.length &&
    parts[index] === "module" &&
    parts[index + 1]
  ) {
    const segment = `module.${parts[index + 1]}`;
    modulePath = modulePath ? `${modulePath}.${segment}` : segment;
    index += 2;
  }
  return modulePath || "root";
}

/**
 * Walks/creates `module.a` → `module.a.module.b` under `root` and returns the deepest node.
 * `fullModulePath` is a Terraform module path (no resource suffix), e.g. `module.network`.
 */
function ensureModulePathInTree(
  root: TerraformModuleTreeNode,
  fullModulePath: string,
): TerraformModuleTreeNode {
  if (!fullModulePath || fullModulePath === "root") {
    return root;
  }
  const sentinel = `${fullModulePath}.aws_instance.__module_tree__`;
  const chain = getModulePathChainFromAddress(sentinel);
  let cursor = root;
  for (const segment of chain) {
    if (!cursor.modules[segment]) {
      cursor.modules[segment] = emptyModuleTreeNode(segment);
    }
    cursor = cursor.modules[segment];
  }
  return cursor;
}

function isTerraformModuleStubNode(
  nodes: Record<string, TerraformPlanGraphNode>,
  key: string,
): boolean {
  const resource = nodes[key]?.resources?.[key] as
    | { type?: string }
    | undefined;
  return Boolean(resource && resource.type === TERRAFORM_MODULE_RESOURCE_TYPE);
}

/**
 * Builds a module → children / resources tree and stores it on the nodes map under
 * {@link TERRAFORM_MODULE_TREE_KEY}. Root is `{ path: "root", … }`.
 */
export function buildTerraformModuleTree(
  nodes: Record<string, TerraformPlanGraphNode>,
): TerraformModuleTreeNode {
  const root = emptyModuleTreeNode("root");

  const keys = Object.keys(nodes).filter((k) => !k.startsWith("__"));
  for (const key of keys) {
    if (isTerraformModuleStubNode(nodes, key)) {
      ensureModulePathInTree(root, key);
      continue;
    }

    const parentPath = getContainingModulePathForAddress(key);
    const parent =
      parentPath === "root" ? root : ensureModulePathInTree(root, parentPath);
    if (!parent.resourceAddresses.includes(key)) {
      parent.resourceAddresses.push(key);
    }
  }

  const sortRecursive = (node: TerraformModuleTreeNode) => {
    node.resourceAddresses.sort();
    for (const child of Object.values(node.modules)) {
      sortRecursive(child);
    }
    const sortedKeys = Object.keys(node.modules).sort();
    const next: Record<string, TerraformModuleTreeNode> = {};
    for (const k of sortedKeys) {
      next[k] = node.modules[k];
    }
    node.modules = next;
  };
  sortRecursive(root);

  return root;
}

function attachModuleTree(
  nodes: Record<string, TerraformPlanGraphNode>,
): TerraformPlanNodesMap {
  const map = nodes as TerraformPlanNodesMap;
  map[TERRAFORM_MODULE_TREE_KEY] = buildTerraformModuleTree(nodes);
  return map;
}

function buildNewEdges(
  nodes: Record<string, TerraformPlanGraphNode>,
  adjacency: Record<string, string[]>,
) {
  //iterate over every node
  for (const nodePath of Object.keys(nodes)) {
    if (nodePath === TERRAFORM_MODULE_TREE_KEY) {
      continue;
    }
    const visited = new Set<string>([nodePath]);
    const queue = [nodePath];
    const connectedNodes: string[] = [];

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      const graphKey = stripTerraformAddressIndexes(current);
      //due to being a raw parse there is a chance that that entry has no outgoign edges
      const neighbors = adjacency[graphKey] || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);

        if (neighbor.startsWith("provider")) {
          continue;
        }

        if (nodes[neighbor]) {
          connectedNodes.push(neighbor);
          continue;
        }

        queue.push(neighbor);
      }
    }

    nodes[nodePath].edges_new = connectedNodes;
  }

  return nodes;
}

function ensureEdgeLists(nodes: Record<string, TerraformPlanGraphNode>) {
  for (const [key, node] of Object.entries(nodes)) {
    if (key === TERRAFORM_MODULE_TREE_KEY) {
      continue;
    }
    node.edges_new ||= [];
    node.edges_existing ||= [];
    node.edges_data_flow ||= [];
  }
  return nodes;
}

function buildExistingEdges(
  nodes: Record<string, TerraformPlanGraphNode>,
  plan: { prior_state: { values: { root_module: unknown } } },
) {
  const rootModule = plan?.prior_state?.values?.root_module;
  if (!rootModule) {
    return nodes;
  }

  const existingEdges: Record<string, Set<string>> = {};
  const addEdge = (from: string, to: string) => {
    if (!existingEdges[from]) {
      existingEdges[from] = new Set();
    }
    existingEdges[from].add(to);
  };

  const stack: TerraformPriorStateModule[] = [
    rootModule as TerraformPriorStateModule,
  ];
  while (stack.length) {
    const currentModule = stack.pop();
    if (currentModule == null) {
      continue;
    }

    for (const resource of currentModule.resources || []) {
      const address = resource.address;
      if (!address) {
        continue;
      }

      nodes[address] ||= { resources: {} };

      if (!nodes[address].resources[address]) {
        nodes[address].resources[address] = {
          ...resource,
          change: { actions: ["existing"] },
        };
      }

      for (const dependency of resource.depends_on || []) {
        if (!dependency) {
          continue;
        }
        addEdge(address, dependency);
      }
    }

    for (const childModule of currentModule.child_modules || []) {
      stack.push(childModule);
    }
  }

  for (const [rawSource, targets] of Object.entries(existingEdges)) {
    const source = resolveTerraformPlanNodeKey(nodes, rawSource);
    if (!source) {
      continue;
    }
    nodes[source].edges_existing ||= [];

    for (const rawTarget of targets) {
      const target = resolveTerraformPlanNodeKey(nodes, rawTarget);
      if (!target) {
        continue;
      }
      if (!nodes[source].edges_existing.includes(target)) {
        nodes[source].edges_existing.push(target);
      }
    }
  }

  return nodes;
}
