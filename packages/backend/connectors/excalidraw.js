/**
 * Excalidraw connector.
 *
 * Wraps the existing `nodesToExcalidraw` orchestrator (`../excalidraw.js`) in
 * the renderer-agnostic connector contract used by `connectors/index.js`.
 *
 * For now this connector consumes the raw pipeline `nodes` map directly to
 * preserve the mature scene-compilation path. The neutral DiagramIR is also
 * passed in so future connectors (and a future refactor of this one) can
 * standardize on it without churning routes.
 */
const { nodesToExcalidraw } = require("../excalidraw");

const SUPPORTED_LAYOUT_ENGINES = new Set(["elk", "force"]);
const FALSEY_OPTION_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

const parseBooleanOption = (value, fallback = true) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (FALSEY_OPTION_VALUES.has(normalized)) {
    return false;
  }
  return true;
};

/**
 * @param {{ nodes: object, ir: import("../diagram-ir").DiagramIR, options: object }} input
 * @returns {Promise<{ contentType: string, fileExtension: string, body: any }>}
 */
async function render({ nodes, options = {} }) {
  const requestedEngine =
    typeof options.layoutEngine === "string"
      ? options.layoutEngine.trim().toLowerCase()
      : null;
  const layoutEngine = SUPPORTED_LAYOUT_ENGINES.has(requestedEngine)
    ? requestedEngine
    : undefined;
  const vpcEndpointSnapping = parseBooleanOption(
    options.vpcEndpointSnapping,
    true,
  );

  const scene = await nodesToExcalidraw(nodes, {
    layoutEngine,
    vpcEndpointSnapping,
  });
  return {
    contentType: "application/json",
    fileExtension: "excalidraw",
    body: scene,
  };
}

module.exports = {
  id: "excalidraw",
  label: "Excalidraw",
  description: "Excalidraw scene v2 JSON, importable by the Excalidraw editor.",
  status: "stable",
  contentType: "application/json",
  fileExtension: "excalidraw",
  render,
};
