const { nodesToExcalidraw } = require("../excalidraw");

const { excalidrawSceneToTldrawShapes } = require("./excalidraw-to-tldraw");

async function render({ nodes, options = {} }) {
  const scene = await nodesToExcalidraw(nodes, {
    layoutEngine: options.layoutEngine,
  });
  const { shapes } = excalidrawSceneToTldrawShapes(scene);
  return {
    contentType: "application/json",
    fileExtension: "tldr.json",
    body: {
      type: "tldraw",
      version: 1,
      source: "terraform-pipeline",
      shapes,
      meta: {
        nodeCount: shapes.filter((s) => s.type !== "arrow").length,
        edgeCount: shapes.filter((s) => s.type === "arrow").length,
        generatedAt: new Date().toISOString(),
      },
    },
  };
}

module.exports = {
  id: "tldraw",
  label: "tldraw",
  description: "tldraw shape JSON rendered from Excalidraw scene output.",
  status: "beta",
  contentType: "application/json",
  fileExtension: "tldr.json",
  render,
};
