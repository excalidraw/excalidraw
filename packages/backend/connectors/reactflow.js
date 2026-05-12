const { nodesToExcalidraw } = require("../excalidraw");

const CONTAINER_KEY_BY_FLAG = [
  "terraformModuleGroup",
  "terraformAccountGroup",
  "terraformRegionGroup",
  "terraformVpcGroup",
  "terraformSubnetGroup",
];

function getContainerKey(customData = {}) {
  for (const key of CONTAINER_KEY_BY_FLAG) {
    if (customData[key]) {
      return key;
    }
  }
  return null;
}

function toReactFlowNodeType(customData = {}) {
  return getContainerKey(customData) ? "tfContainer" : "tfResource";
}

async function buildReactFlowDocument(nodes, options = {}) {
  const scene = await nodesToExcalidraw(nodes, {
    layoutEngine: options.layoutEngine,
  });

  const elements = Array.isArray(scene.elements) ? scene.elements : [];
  const visibleElements = elements.filter((el) => !el.isDeleted);

  const textByContainerId = new Map();
  for (const el of visibleElements) {
    if (el.type === "text" && el.containerId) {
      textByContainerId.set(el.containerId, el);
    }
  }

  const nodeElements = visibleElements.filter((el) => el.type === "rectangle");
  const nodeIds = new Set(nodeElements.map((el) => el.id));

  const rfNodes = nodeElements.map((el) => {
    const labelEl = textByContainerId.get(el.id);
    const customData = el.customData || {};
    const containerKey = getContainerKey(customData);
    const isContainer = Boolean(containerKey);
    const label = labelEl?.text || customData.nodePath || el.id;
    const action = customData.action || "existing";
    return {
      id: el.id,
      type: toReactFlowNodeType(customData),
      position: {
        x: el.x || 0,
        y: el.y || 0,
      },
      data: {
        label,
        kind: isContainer ? "container" : "resource",
        resourceType: customData.resourceType || null,
        action,
        containerType: containerKey || null,
      },
      style: {
        width: Math.max(1, el.width || 1),
        height: Math.max(1, el.height || 1),
        border: `${Math.max(1, el.strokeWidth || 1)}px ${
          el.strokeStyle === "dashed"
            ? "dashed"
            : el.strokeStyle === "dotted"
            ? "dotted"
            : "solid"
        } ${el.strokeColor || "#64748b"}`,
        background:
          el.backgroundColor && el.backgroundColor !== "transparent"
            ? el.backgroundColor
            : isContainer
            ? "rgba(148, 163, 184, 0.04)"
            : "#ffffff",
        borderRadius: 10,
        zIndex: isContainer ? 1 : 10,
        boxShadow: isContainer ? "none" : "0 1px 3px rgba(15,23,42,0.12)",
      },
      draggable: !isContainer,
      selectable: true,
    };
  });

  const rfEdges = visibleElements
    .filter((el) => el.type === "arrow")
    .map((el) => {
      const source = el.startBinding?.elementId;
      const target = el.endBinding?.elementId;
      if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
        return null;
      }
      const edgeLayer = el.customData?.terraformEdgeLayer || "dependency";
      return {
        id: el.id,
        source,
        target,
        type: "smoothstep",
        animated: edgeLayer === "dataFlow",
        data: {
          kind: edgeLayer === "dataFlow" ? "data-flow" : "dependency",
          label: el.customData?.relationship?.label || null,
        },
        style:
          edgeLayer === "dataFlow"
            ? { stroke: "#0ea5e9", strokeWidth: 2.5 }
            : { stroke: "#64748b", strokeWidth: 1.8 },
      };
    })
    .filter(Boolean);

  return {
    type: "reactflow",
    version: 2,
    source: "terraform-pipeline",
    nodes: rfNodes,
    edges: rfEdges,
    meta: {
      generatedAt: new Date().toISOString(),
      nodeCount: rfNodes.length,
      edgeCount: rfEdges.length,
      paritySource: "excalidraw-scene",
      layoutEngine: options.layoutEngine || null,
    },
  };
}

async function render({ nodes, options = {} }) {
  const doc = await buildReactFlowDocument(nodes, options);
  return {
    contentType: "application/json",
    fileExtension: "reactflow.json",
    body: doc,
  };
}

module.exports = {
  id: "reactflow",
  label: "React Flow",
  description:
    "React Flow nodes/edges JSON with module groups rendered as subflows.",
  status: "beta",
  contentType: "application/json",
  fileExtension: "reactflow.json",
  render,
  buildReactFlowDocument,
};
