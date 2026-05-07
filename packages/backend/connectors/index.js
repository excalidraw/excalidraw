/**
 * Frontend connector registry.
 *
 * A "connector" turns a post-pipeline `nodes` map (plus the neutral
 * `DiagramIR` derived from it) into a frontend-specific scene document.
 * Each connector exports the same shape:
 *
 *   {
 *     id: string,                       // url-safe identifier ("excalidraw", "tldraw", ...)
 *     label: string,                    // human-readable name
 *     description: string,
 *     status: "stable" | "beta" | "stub",
 *     contentType: string,              // default Content-Type
 *     fileExtension: string,            // default download extension
 *     render({ nodes, ir, options }): Promise<{
 *       contentType: string,
 *       fileExtension: string,
 *       body: any,                      // serialized below by the route
 *     }>,
 *   }
 *
 * Adding a new frontend means dropping a module in this folder and
 * registering it in REGISTRY below.
 */

const excalidraw = require("./excalidraw");
const tldraw = require("./tldraw");
const { UnknownRendererError } = require("./errors");

const REGISTRY = Object.freeze({
  [excalidraw.id]: excalidraw,
  [tldraw.id]: tldraw,
});

/**
 * @param {string} id
 * @returns {ReturnType<typeof excalidraw> | typeof excalidraw}
 */
function getRenderer(id) {
  const renderer = REGISTRY[id];
  if (!renderer) {
    throw new UnknownRendererError(id, listRenderers().map((r) => r.id));
  }
  return renderer;
}

function listRenderers() {
  return Object.values(REGISTRY).map((r) => ({
    id: r.id,
    label: r.label,
    description: r.description,
    status: r.status,
    contentType: r.contentType,
    fileExtension: r.fileExtension,
  }));
}

module.exports = {
  REGISTRY,
  getRenderer,
  listRenderers,
};
