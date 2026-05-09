import graphlibDot from "@dagrejs/graphlib-dot";
import type { Graph } from "@dagrejs/graphlib";

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

/** Matches backend pipeline nodes: resources plus mutable edge buckets (see `ensureEdgeLists`). */
type TerraformPlanGraphNode = {
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

/** Local import path: main menu → “Import Terraform” → uncheck “use backend” → Import & Open. */
export const terraformPlanParsing = async (
  planFile: File,
  dotFile: File,
  stateFile: File | null,
) => {
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

  const nodes2 = ensureEdgeLists(nodes);
  emitLocalParseDebug({
    phase: "ensureEdgeLists",
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

  //i have a plan that is searchable by address along with nodes for models
  //i have the adjacency list of the terraform dependency graph
  //i need to find each nodes relations and make them bidirectional
  //i need to allow nodes to be searchable by module too
  // now we know what resources/modules live in what module
  // all modules have a root provider which describe the modules provider, account and region
  // we can organize resources by module boxes, root being provider  and use elk or force to direct layout
  // we can also model by primary resource types, compute, messaging, storage. what they live in (account, region, vpc, subnets, SG) along with their secondar resources (IAM, Networking, observability)

  return new Response(JSON.stringify(EMPTY_TERRAFORM_EXCALIDRAW_SCENE), {
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

  function buildNewEdges(nodes: Record<string, TerraformPlanGraphNode>, adjacency: Record<string, string[]>) {
  
    //iterate over every node
    for (const nodePath of Object.keys(nodes)) {
      const visited = new Set<string>([nodePath]);
      const queue = [nodePath];
      const connectedNodes: string[] = [];
  
      for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        const graphKey = stripIndexes(current);
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

  const stripIndexes = (address = "") => address.replace(/\[[^\]]+\]/g, "");

  function ensureEdgeLists(nodes: Record<string, TerraformPlanGraphNode>) {
    for (const node of Object.values(nodes)) {
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
      const source = resolveCanonicalNodePath(nodes, rawSource);
      if (!source) {
        continue;
      }
      nodes[source].edges_existing ||= [];
  
      for (const rawTarget of targets) {
        const target = resolveCanonicalNodePath(nodes, rawTarget);
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

  function resolveCanonicalNodePath(nodes: Record<string, TerraformPlanGraphNode>, address: string) {
    if (nodes[address]) {
      return address;
    }
    const graphId = stripIndexes(address);
    if (nodes[graphId]) {
      return graphId;
    }
    return null;
  }