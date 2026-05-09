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
  const adjacency = getAdjacencyListFromDot(graph);

  console.log("plan", plan);
  console.log("state", state);
  console.log("graph", graph);

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