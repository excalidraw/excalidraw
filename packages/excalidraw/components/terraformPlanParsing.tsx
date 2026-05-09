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
    const nodes: Record<string, { resources: Record<string, unknown> }> = {};
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

  function addModuleNodes(nodes: Record<string, { resources: Record<string, unknown> }>) {
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
