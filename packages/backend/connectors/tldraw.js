/**
 * tldraw connector — STUB.
 *
 * tldraw uses its own document model (`TLStore`, shape records, bindings).
 * Implementing a real renderer means walking the DiagramIR and emitting
 * `{ store: { ... }, schema: { ... } }`. That work is not done yet.
 *
 * Until then this connector advertises itself in the registry, but
 * `render()` throws `RendererNotImplementedError`. The Express route in
 * `index.js` translates that into HTTP 501.
 */
const { RendererNotImplementedError } = require("./errors");

async function render({ ir }) {
  throw new RendererNotImplementedError("tldraw", {
    irNodeCount: ir?.nodes?.length ?? 0,
    irEdgeCount: ir?.edges?.length ?? 0,
    plan:
      "Implement walkIR(ir) -> { store, schema } using @tldraw/tldraw 's TLStoreSnapshot format.",
  });
}

module.exports = {
  id: "tldraw",
  label: "tldraw",
  description: "tldraw document JSON. Not implemented yet.",
  status: "stub",
  contentType: "application/json",
  fileExtension: "tldr",
  render,
};
