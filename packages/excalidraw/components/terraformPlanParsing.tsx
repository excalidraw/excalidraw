import graphlibDot from "@dagrejs/graphlib-dot";
import type { Graph } from "@dagrejs/graphlib";

import { buildTerraformElkExcalidrawScene } from "./terraformElkLayout";
import {
  extractTerraformTopologyFromPlan,
  mergeTopologyModelWithPlacementZones,
  mergeTopologyModelWithRegionalBuckets,
  mergeTopologyModelWithVpcEndpoints,
} from "./terraformTopologyExtract";
import {
  extractPrimaryTopologyZones,
  extractRegionalTopologyPrimaries,
  extractVpcEndpointsByVpc,
} from "./terraformTopologyPlacement";
import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";

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

/** Matches backend pipeline nodes: resources plus mutable edge buckets (see `ensureEdgeLists`). */
export type TerraformPlanGraphNode = {
  resources: Record<string, unknown>;
  edges_new?: string[];
  edges_existing?: string[];
  edges_data_flow?: string[];
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
  console.log(DEBUG_PREFIX, payload);
}

export type TerraformPlanParsingOptions = {
  /** When true, emit nested AWS topology frames (local import only); otherwise ELK module graph. */
  semanticLayout?: boolean;
};

/** Local import path: main menu → “Import Terraform” → uncheck “use backend” → Import & Open. */
export const terraformPlanParsing = async (
  planFile: File,
  dotFile: File,
  stateFile: File | null,
  options?: TerraformPlanParsingOptions,
) => {
  const semanticLayout = options?.semanticLayout === true;
  const [planText, dotText, stateText] = await Promise.all([
    planFile.text(),
    dotFile.text(),
    stateFile ? stateFile.text() : Promise.resolve(null),
  ]);
  const plan = JSON.parse(planText);
  const state = stateText ? JSON.parse(stateText) : null;
  const graph = graphlibDot.read(dotText);

  emitLocalParseDebug({
    phase: "init",
    plan,
    state,
    graph,
  });

  const adjacency = getAdjacencyListFromDot(graph);
  emitLocalParseDebug({
    phase: "parsedDot",
    adjacency
  });

  const nodes = loadPlan(plan);
  emitLocalParseDebug({
    phase: "planParsed",
    nodes
  });

  const nodes2 = sanitizeTerraformPlanNodes(ensureEdgeLists(nodes));
  emitLocalParseDebug({
    phase: "sanitizeInitialNodes",
    nodes2
  });

  const nodes3 = buildNewEdges(nodes2, adjacency);
  emitLocalParseDebug({
    phase: "buildNewEdges",
    nodes3
  });

  const nodes4 = buildExistingEdges(nodes3, plan);
  emitLocalParseDebug({
    phase: "buildExistingEdges",
    nodes4
  });

  const sanitizedNodes = sanitizeTerraformPlanNodes(nodes4);
  emitLocalParseDebug({
    phase: "sanitizePriorStateNodes",
    sanitizedNodes
  });

  const nodes5 = attachModuleTree(sanitizedNodes);
  emitLocalParseDebug({
    phase: "moduleTree",
    moduleTree: nodes5[TERRAFORM_MODULE_TREE_KEY],
  });

  let sceneBody: Record<string, unknown>;

  if (semanticLayout) {
    const topoModel = extractTerraformTopologyFromPlan(plan);
    const zones = extractPrimaryTopologyZones(plan);
    const regionalBuckets = extractRegionalTopologyPrimaries(plan);
    const vpcEndpointBuckets = extractVpcEndpointsByVpc(plan);
    mergeTopologyModelWithPlacementZones(topoModel, zones);
    mergeTopologyModelWithRegionalBuckets(topoModel, regionalBuckets);
    mergeTopologyModelWithVpcEndpoints(topoModel, vpcEndpointBuckets);
    const topoScene = await buildTerraformTopologyExcalidrawScene(
      topoModel,
      zones,
      regionalBuckets,
      nodes5,
      plan,
      vpcEndpointBuckets,
    );
    emitLocalParseDebug({
      phase: "topologyLayout",
      meta: topoScene.meta,
      elementCount: topoScene.elements.length,
    });
    sceneBody = {
      ...EMPTY_TERRAFORM_EXCALIDRAW_SCENE,
      elements: topoScene.elements,
      meta: topoScene.meta,
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

/** Strip `count` / `for_each` instance keys so graph ids match `terraform graph` / `depends_on` variants. */
const stripTerraformAddressIndexes = (address = "") => address.replace(/\[[^\]]+\]/g, "");

/**
 * Map a Terraform address (plan / prior_state / `depends_on`) to a key in `nodes`.
 * Plan keys often include instance keys (`[0]`, `["a"]`) while `prior_state.depends_on` may omit them;
 * matches backend `packages/backend/pipeline.js` `resolveCanonicalNodePath`.
 */
export function resolveTerraformPlanNodeKey(
  nodes: Record<string, TerraformPlanGraphNode>,
  address: string,
): string | null {
  if (!address || typeof address !== "string" || address === TERRAFORM_MODULE_TREE_KEY) {
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

function hasMeaningfulIamPolicyDocumentContent(resource: Record<string, unknown>) {
  const change = resource.change as { after?: Record<string, unknown> } | undefined;
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

export function sanitizeTerraformPlanNodes<T extends Record<string, TerraformPlanGraphNode>>(
  nodes: T,
): T {
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

  function addModuleNodes(nodes: Record<string, TerraformPlanGraphNode>) {
    const modulePaths = collectAllTerraformModulePaths(Object.keys(nodes));
  
    for (const modulePath of modulePaths) {
      if (nodes[modulePath]) {
        continue;
      }
  
      nodes[modulePath] = {
        resources: {
          [modulePath]: {
            address: modulePath,
            type: TERRAFORM_MODULE_RESOURCE_TYPE,
            name: lastModuleNameSegment(modulePath),
            mode: "managed",
            change: { actions: ["no-op"] },
          },
        },
      };
    }
  
    return nodes;
  }

  function collectAllTerraformModulePaths(nodePaths: string[]) {
    const out = new Set<string>();
    for (const nodePath of nodePaths) {
      for (const modulePath of getModulePathChainFromAddress(nodePath)) {
        out.add(modulePath);
      }
    }
    return out;
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

  function lastModuleNameSegment(modulePath: string) {
    const parts = modulePath.split(".");
    return parts[parts.length - 1] || modulePath;
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
    while (index < parts.length && parts[index] === "module" && parts[index + 1]) {
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
    const resource = nodes[key]?.resources?.[key] as { type?: string } | undefined;
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

  function buildNewEdges(nodes: Record<string, TerraformPlanGraphNode>, adjacency: Record<string, string[]>) {
  
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

  function buildExistingEdges(nodes: Record<string, TerraformPlanGraphNode>, plan: { prior_state: { values: { root_module: unknown } } }) {
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
  
    const stack: TerraformPriorStateModule[] = [rootModule as TerraformPriorStateModule];
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
