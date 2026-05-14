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
  mergeSupplementarySubnetZonesSharedRouteTable,
} from "./terraformTopologyPlacement";
import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  buildDataFlowEdges,
  buildNetworkingEdges,
} from "./terraformDataFlowEdges";

import type { Graph } from "@dagrejs/graphlib";

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
      const address = getStateResourceAddress(resource, instance);
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
        const target = resolveTerraformPlanNodeKey(nodes, dependency);
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
export function buildTerraformLocalImportNodesMap(
  plan: unknown,
  graph: Graph,
  tfstate?: unknown | null,
): TerraformPlanNodesMap {
  const adjacency = getAdjacencyListFromDot(graph);
  const planTyped = plan as {
    resource_changes: { address: string }[];
    prior_state?: { values: { root_module: unknown } };
  };
  let nodes = loadPlan(planTyped);
  nodes = mergeRawTerraformStateIntoNodes(nodes, tfstate);
  const nodes2 = sanitizeTerraformPlanNodes(ensureEdgeLists(nodes));
  const nodes3 = buildNewEdges(nodes2, adjacency);
  const nodes4 = buildExistingEdges(
    nodes3,
    planTyped as { prior_state: { values: { root_module: unknown } } },
  );
  const sanitizedNodes = sanitizeTerraformPlanNodes(nodes4);
  const withTree = attachModuleTree(sanitizedNodes);
  buildDataFlowEdges(withTree as Record<string, unknown>);
  buildNetworkingEdges(withTree as Record<string, unknown>);
  return withTree;
}

/** Local import path: main menu → “Import Terraform” → uncheck “use backend” → Import & Open. */
export const terraformPlanParsing = async (
  planFile: File | null,
  dotFile: File | null,
  stateFile: File | null,
  options?: TerraformPlanParsingOptions,
) => {
  const semanticLayout = options?.semanticLayout === true;
  let plan: unknown;
  let dotText: string;
  let tfstateForMerge: unknown | null = null;

  if (planFile && dotFile) {
    const [planText, dotT, stateText] = await Promise.all([
      planFile.text(),
      dotFile.text(),
      stateFile ? stateFile.text() : Promise.resolve(null),
    ]);
    dotText = dotT;
    try {
      plan = JSON.parse(planText);
    } catch {
      return new Response(
        JSON.stringify({ error: "planFile must be valid JSON." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (stateText) {
      try {
        const parsed = JSON.parse(stateText) as { resources?: unknown };
        if (parsed && Array.isArray(parsed.resources)) {
          tfstateForMerge = parsed;
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "stateFile must be valid JSON." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
  } else if (stateFile) {
    const stateText = await stateFile.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stateText);
    } catch {
      return new Response(
        JSON.stringify({ error: "stateFile must be valid JSON." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as { resources?: unknown }).resources)
    ) {
      return new Response(
        JSON.stringify({
          error:
            'State-only import requires raw Terraform state JSON (top-level "resources" array), e.g. terraform state pull.',
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    plan = { resource_changes: [] };
    dotText = "digraph G {}\n";
    tfstateForMerge = parsed;
  } else {
    return new Response(
      JSON.stringify({
        error:
          "Upload plan JSON + DOT together, or a raw Terraform state JSON file alone.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (semanticLayout) {
    const rc = (plan as { resource_changes?: unknown[] }).resource_changes;
    if (!Array.isArray(rc) || rc.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Semantic layout requires plan JSON with resource_changes. Upload plan+dot or turn off semantic layout for state-only imports.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  const graph = graphlibDot.read(dotText);

  emitLocalParseDebug({
    phase: "init",
    plan,
    state: tfstateForMerge,
    graph,
  });

  const adjacency = getAdjacencyListFromDot(graph);
  emitLocalParseDebug({
    phase: "parsedDot",
    adjacency,
  });

  const nodes5 = buildTerraformLocalImportNodesMap(
    plan,
    graph,
    tfstateForMerge,
  );
  emitLocalParseDebug({
    phase: "planParsed_through_moduleTree",
    nodes: nodes5,
    moduleTree: nodes5[TERRAFORM_MODULE_TREE_KEY],
  });

  let sceneBody: Record<string, unknown>;

  if (semanticLayout) {
    type SemanticPlan = Parameters<typeof extractTerraformTopologyFromPlan>[0];
    const semPlan = plan as SemanticPlan;
    const topoModel = extractTerraformTopologyFromPlan(semPlan);
    const primaryZones = extractPrimaryTopologyZones(semPlan).map((z) => ({
      ...z,
      topologyZoneSource: "primary" as const,
    }));
    const supplementaryZones = extractSupplementarySubnetZones(
      semPlan,
      primaryZones,
    ).map((z) => ({
      ...z,
      topologyZoneSource: "supplementary" as const,
    }));
    const zones = mergeSupplementarySubnetZonesSharedRouteTable(
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
      semPlan,
    );
    const regionalBuckets = extractRegionalTopologyPrimaries(semPlan);
    const vpcEndpointBucketsRaw = extractVpcEndpointsByVpc(semPlan);
    const { byZone: interfaceVpcEndpointZonePlacements, zonePlacedAddresses } =
      computeInterfaceVpcEndpointZonePlacements(semPlan, zones);
    const vpcEndpointBuckets = filterVpcEndpointBucketsRemovingZonePlacedAddresses(
      vpcEndpointBucketsRaw,
      zonePlacedAddresses,
    );
    const routeTableBuckets = extractRouteTablesByVpc(semPlan);
    const rawVpcDefaultPlumbingBuckets =
      extractVpcDefaultPlumbingBuckets(semPlan);
    const natZonePlacements = computeNatGatewayZonePlacements(semPlan, zones);
    /**
     * NAT/EIP that we placed inside their public-subnet zone (semantic AZ rendering) must NOT
     * also appear on the VPC right edge via `appendVpcInternetEdgeRectangles`. Filter them out
     * before the buckets reach the scene builder.
     */
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
    const vpcFlowLogBuckets = extractVpcFlowLogBundles(semPlan);
    const endpointSecurityGroupBuckets =
      extractInterfaceEndpointSecurityGroupBuckets(
        semPlan,
        vpcEndpointBucketsRaw,
      );
    const routeTableBottomPlacements = computeRouteTableBottomEdgePlacements(
      zones,
      semPlan,
    );
    mergeTopologyModelWithPlacementZones(topoModel, zones);
    mergeTopologyModelWithRegionalBuckets(topoModel, regionalBuckets);
    mergeTopologyModelWithVpcEndpoints(topoModel, vpcEndpointBuckets);
    mergeTopologyModelWithRouteTables(topoModel, routeTableBuckets);
    mergeTopologyModelWithVpcDefaults(topoModel, vpcDefaultPlumbingBuckets);
    mergeTopologyModelWithRouteTables(topoModel, vpcFlowLogBuckets);
    mergeTopologyModelWithRouteTables(topoModel, endpointSecurityGroupBuckets);
    const topoScene = await buildTerraformTopologyExcalidrawScene(
      topoModel,
      zones,
      regionalBuckets,
      nodes5,
      semPlan,
      vpcEndpointBuckets,
      routeTableBottomPlacements,
      vpcDefaultPlumbingBuckets,
      vpcFlowLogBuckets,
      endpointSecurityGroupBuckets,
      natZonePlacements,
      interfaceVpcEndpointZonePlacements,
    );
    const represented = collectSemanticRepresentedResourceAddresses(
      topoScene.elements as Array<{ customData?: Record<string, any> }>,
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
      meta: topoScene.meta,
      elementCount: topoScene.elements.length,
      zoneRouteAnchorDebug: topoScene.meta.zoneRouteAnchorDebug,
    });
    sceneBody = {
      ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
      elements: topoScene.elements,
      ...(topoScene.files && Object.keys(topoScene.files).length > 0
        ? { files: topoScene.files }
        : {}),
      meta: {
        ...topoScene.meta,
        representedResourceCount: represented.size,
        omittedResourceCount: omittedSemanticResources.length,
      },
    };
  } else {
    const elkScene = await buildTerraformElkExcalidrawScene(nodes5);
    emitLocalParseDebug({
      phase: "elkLayout",
      meta: elkScene.meta,
      elementCount: elkScene.elements.length,
    });
    sceneBody = {
      ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
      elements: elkScene.elements,
      meta: elkScene.meta,
    };
  }

  return new Response(JSON.stringify(sceneBody), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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
  if (nodes[address]) {
    return address;
  }
  const graphId = stripTerraformAddressIndexes(address);
  if (nodes[graphId]) {
    return graphId;
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
  if (matches.length > 1 && matches.includes(address)) {
    return address;
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
  const parts = nodePath.split(".");
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
  const parts = address.split(".");
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
