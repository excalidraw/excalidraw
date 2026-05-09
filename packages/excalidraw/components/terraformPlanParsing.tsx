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

  const nodes1 = addModuleNodes(nodes);
  emitLocalParseDebug({
    phase: "terraformModuleNodes",
    nodes1
  });

  const nodes2 = ensureEdgeLists(nodes1);
  emitLocalParseDebug({
    phase: "ensureEdgeLists",
    nodes2
  });

  const nodes3 = buildNewEdges(nodes2, adjacency);
  emitLocalParseDebug({
    phase: "buildNewEdges",
    nodes3
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
    const moduleBoundarySet = collectAllTerraformModulePaths(Object.keys(nodes));
  
    for (const nodePath of Object.keys(nodes)) {
      const visited = new Set<string>([nodePath]);
      const queue = [nodePath];
      const connectedNodes = new Set<string>();
  
      for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        const graphKey = stripIndexes(current);
        const neighbors =
          adjacency[graphKey] || adjacency[current] || [];
  
        for (const neighbor of neighbors) {
          if (visited.has(neighbor)) {
            continue;
          }
          visited.add(neighbor);
  
          if (neighbor.startsWith("provider")) {
            continue;
          }
  
          // Terraform graph uses intermediate module vertex names matching module paths.
          // Never traverse through them: attach at most one edge to the synthetic module
          // node so BFS does not pull in every resource under the module.
          if (moduleBoundarySet.has(neighbor)) {
            if (nodes[neighbor]) {
              connectedNodes.add(neighbor);
            }
            continue;
          }
  
          if (nodes[neighbor]) {
            connectedNodes.add(neighbor);
            continue;
          }
  
          queue.push(neighbor);
        }
      }
  
      nodes[nodePath].edges_new = [...connectedNodes];
    }
  
    for (const node of Object.values(nodes)) {
      node.edges_new = [...new Set<string>(node.edges_new ?? [])];
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