import dot from "graphlib-dot";

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
  const graph = dot.read(dotText);

  console.log("plan", plan);
  console.log("state", state);
  console.log("graph", graph);

  return new Response(JSON.stringify(EMPTY_TERRAFORM_EXCALIDRAW_SCENE), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
