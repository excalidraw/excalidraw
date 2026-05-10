/**
 * Renderer-neutral Diagram Intermediate Representation (IR).
 *
 * The pipeline produces a Terraform-flavored `nodes` map. Each frontend connector
 * (`connectors/*.js`) takes that map and emits a renderer-specific scene
 * (Excalidraw scene JSON, tldraw document, etc.).
 *
 * To keep connectors consistent, this module derives a *neutral* IR from the
 * `nodes` map: an opinion-light list of diagram nodes, edges, and group
 * containers with optional layout positions and styling hints. The IR is built
 * once per request and passed to every connector.
 *
 * The IR intentionally does NOT carry layout coordinates yet (layout is
 * renderer-specific in this codebase today, see `excalidraw-layout.js`). When a
 * connector wants to lay out the IR it can either compute its own layout or
 * call the layout helpers directly. Future work: hoist the ELK layout step
 * above the connector boundary and stamp `position` onto IR nodes here.
 *
 * @typedef {Object} IRStyleHint
 * @property {string} [background]
 * @property {string} [stroke]
 * @property {number} [strokeWidth]
 * @property {boolean} [dashed]
 *
 * @typedef {Object} IRNode
 * @property {string} id - Stable identifier (Terraform address or synthetic key).
 * @property {"resource"|"module"|"external"|"synthetic"} kind
 * @property {string} label - Human-readable label.
 * @property {string|null} resourceType - e.g. "aws_lambda_function" or null for non-resources.
 * @property {string|null} provider - Inferred provider, e.g. "aws".
 * @property {string|null} action - Terraform action ("create" | "update" | "delete" | "no-op" | "read" | null).
 * @property {string[]} modulePath - Chain of module addresses owning this node, root first.
 * @property {{ library: string, id: string }|null} [icon]
 * @property {IRStyleHint} [style]
 * @property {Record<string, unknown>} [data] - Opaque, renderer-readable extras (kept small).
 *
 * @typedef {Object} IREdge
 * @property {string} id
 * @property {string} source
 * @property {string} target
 * @property {"dependency"|"data-flow"} kind
 * @property {string|null} [label]
 * @property {boolean} directed
 * @property {boolean} [bidirectional]
 * @property {IRStyleHint} [style]
 * @property {Record<string, unknown>} [data]
 *
 * @typedef {Object} IRGroup
 * @property {string} id
 * @property {"module"|"vpc"|"subnet"|"region"|"account"|"frame"} type
 * @property {string} label
 * @property {string|null} parentId
 * @property {string[]} childIds - IDs of IR nodes (or other groups) directly inside this group.
 * @property {Record<string, unknown>} [data]
 *
 * @typedef {Object} DiagramIR
 * @property {1} version
 * @property {string} source
 * @property {{ nodeCount: number, edgeCount: number, generatedAt: string }} metadata
 * @property {IRNode[]} nodes
 * @property {IREdge[]} edges
 * @property {IRGroup[]} groups
 */

const {
  getResourceType,
  getLabel,
  getModulePathChain,
  getPrimaryAction,
  getIconForType,
  isInitiallyVisibleTerraformNode,
} = require("./excalidraw-elements");

const {
  collectDirectedEdges,
  collectDataFlowEdges,
  strokeColorForTerraformDependencyKinds,
} = require("./excalidraw-arrows");

/**
 * Best-effort provider sniff from the resource type prefix.
 * @param {string|null} resourceType
 * @returns {string|null}
 */
function inferProvider(resourceType) {
  if (!resourceType || typeof resourceType !== "string") {
    return null;
  }
  const underscore = resourceType.indexOf("_");
  if (underscore <= 0) {
    return null;
  }
  return resourceType.slice(0, underscore);
}

/**
 * @param {string} nodePath
 * @param {object} node
 * @returns {IRNode["kind"]}
 */
function classifyNodeKind(nodePath, node) {
  const resourceType = getResourceType(nodePath);
  if (resourceType === "terraform_module") {
    return "module";
  }
  if (node && node.external) {
    return "external";
  }
  if (nodePath.startsWith("__") || resourceType === "synthetic") {
    return "synthetic";
  }
  return "resource";
}

/**
 * Builds the renderer-neutral IR from a post-pipeline `nodes` map.
 *
 * @param {Record<string, any>} nodes - Output of the backend pipeline.
 * @param {{ source?: string }} [options]
 * @returns {DiagramIR}
 */
function buildDiagramIR(nodes, options = {}) {
  const source = options.source || "terraform-pipeline";
  const nodeKeys = Object.keys(nodes).filter((key) => !key.startsWith("__"));

  /** @type {IRNode[]} */
  const irNodes = [];
  /** @type {Map<string, IRGroup>} */
  const groupMap = new Map();

  for (const nodePath of nodeKeys) {
    const node = nodes[nodePath] || {};
    const resourceType = getResourceType(nodePath);
    const kind = classifyNodeKind(nodePath, node);
    const modulePath = getModulePathChain(nodePath);
    const action = getPrimaryAction(node);
    const icon = (() => {
      try {
        const found = getIconForType(resourceType);
        return found ? { library: "aws-architecture-icons", id: found.id || resourceType } : null;
      } catch {
        return null;
      }
    })();

    irNodes.push({
      id: nodePath,
      kind,
      label: getLabel(nodePath),
      resourceType: resourceType || null,
      provider: inferProvider(resourceType),
      action: action || null,
      modulePath,
      icon,
      data: {
        primaryVisible: isInitiallyVisibleTerraformNode(nodePath, node),
      },
    });

    for (let i = 0; i < modulePath.length; i++) {
      const groupId = modulePath[i];
      if (!groupMap.has(groupId)) {
        const parentId = i > 0 ? modulePath[i - 1] : null;
        groupMap.set(groupId, {
          id: groupId,
          type: "module",
          label: groupId,
          parentId,
          childIds: [],
        });
      }
    }

    const owningModule = modulePath.length ? modulePath[modulePath.length - 1] : null;
    if (owningModule) {
      groupMap.get(owningModule).childIds.push(nodePath);
    }
  }

  const directed = collectDirectedEdges(nodes) || [];
  const dataFlow = collectDataFlowEdges(nodes) || [];

  /** @type {IREdge[]} */
  const irEdges = [];
  let edgeIdx = 0;
  for (const edge of directed) {
    const sourceNode = nodes[edge.source];
    const targetNode = nodes[edge.target];
    const sourceAction = sourceNode ? getPrimaryAction(sourceNode) : null;
    const targetAction = targetNode ? getPrimaryAction(targetNode) : null;
    const stroke = strokeColorForTerraformDependencyKinds(edge.kinds, {
      origins: edge.origins,
      sourceAction,
      targetAction,
    });
    irEdges.push({
      id: `dep_${edgeIdx++}`,
      source: edge.source,
      target: edge.target,
      kind: "dependency",
      directed: true,
      label: edge.label || null,
      style: { stroke },
      data: edge.data ? { ...edge.data } : undefined,
    });
  }
  for (const edge of dataFlow) {
    irEdges.push({
      id: `flow_${edgeIdx++}`,
      source: edge.source,
      target: edge.target,
      kind: "data-flow",
      directed: edge.directed !== false,
      bidirectional: !!edge.bidirectional,
      label: edge.label || null,
      data: {
        type: edge.type || null,
        origin: edge.origin || null,
        detail: edge.detail || null,
      },
    });
  }

  return {
    version: 1,
    source,
    metadata: {
      nodeCount: irNodes.length,
      edgeCount: irEdges.length,
      generatedAt: new Date().toISOString(),
    },
    nodes: irNodes,
    edges: irEdges,
    groups: Array.from(groupMap.values()),
  };
}

module.exports = {
  buildDiagramIR,
  inferProvider,
  classifyNodeKind,
};
