/**
 * React Flow connector.
 *
 * Emits a React Flow-friendly document with grouped module nodes as subflows.
 * For now, only edges within the same module scope are emitted so we can focus
 * on subflow structure before modeling inter-module dependencies.
 */

const GROUP_WIDTH = 360;
const GROUP_HEADER_HEIGHT = 40;
const GROUP_CHILD_Y_START = 56;
const GROUP_CHILD_ROW_GAP = 88;
const GROUP_CHILD_COL_GAP = 176;
const GROUP_CHILD_COLUMNS = 2;
const ROOT_ROW_GAP = 100;
const ROOT_COL_GAP = 240;
const ROOT_COLUMNS = 4;

function toNodeLabel(node) {
  return node.label || node.id;
}

function getDepth(groupId) {
  if (!groupId) {
    return 0;
  }
  return String(groupId).split(".").length;
}

function asGroupLabel(groupId) {
  const parts = String(groupId).split(".");
  return parts[parts.length - 1] || groupId;
}

function computeGroupSize(memberCount) {
  const rows = Math.max(1, Math.ceil(memberCount / GROUP_CHILD_COLUMNS));
  return {
    width: GROUP_WIDTH,
    height: GROUP_CHILD_Y_START + rows * GROUP_CHILD_ROW_GAP + 24,
  };
}

function layoutGroups(groups) {
  const sorted = [...groups].sort((a, b) => {
    const depthA = getDepth(a.id);
    const depthB = getDepth(b.id);
    if (depthA !== depthB) return depthA - depthB;
    return a.id.localeCompare(b.id);
  });

  const depthIndex = new Map();
  const positions = new Map();
  for (const group of sorted) {
    const depth = getDepth(group.id);
    const idx = depthIndex.get(depth) || 0;
    depthIndex.set(depth, idx + 1);
    positions.set(group.id, {
      x: 80 + idx * (GROUP_WIDTH + 120),
      y: 80 + depth * 480,
    });
  }
  return positions;
}

function layoutGroupMembers(irNodes) {
  const byGroup = new Map();
  for (const node of irNodes) {
    const modulePath = Array.isArray(node.modulePath) ? node.modulePath : [];
    const groupId = modulePath.length > 0 ? modulePath[modulePath.length - 1] : null;
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, []);
    }
    byGroup.get(groupId).push(node);
  }

  for (const [groupId, members] of byGroup) {
    members.sort((a, b) => a.id.localeCompare(b.id));
    if (groupId === null) {
      continue;
    }
    members.forEach((node, idx) => {
      node.__rfPosition = {
        x: 24 + (idx % GROUP_CHILD_COLUMNS) * GROUP_CHILD_COL_GAP,
        y: GROUP_CHILD_Y_START + Math.floor(idx / GROUP_CHILD_COLUMNS) * GROUP_CHILD_ROW_GAP,
      };
    });
  }

  const rootNodes = byGroup.get(null) || [];
  rootNodes.forEach((node, idx) => {
    node.__rfPosition = {
      x: 80 + (idx % ROOT_COLUMNS) * ROOT_COL_GAP,
      y: 80 + Math.floor(idx / ROOT_COLUMNS) * ROOT_ROW_GAP,
    };
  });

  return byGroup;
}

function buildReactFlowDocument(ir) {
  const groupMembers = layoutGroupMembers(ir.nodes || []);
  const groupPositions = layoutGroups(ir.groups || []);
  const groupNodes = [];

  for (const group of ir.groups || []) {
    const members = groupMembers.get(group.id) || [];
    const size = computeGroupSize(members.length);
    groupNodes.push({
      id: group.id,
      type: "group",
      data: {
        label: asGroupLabel(group.label || group.id),
        groupType: group.type || "module",
      },
      position: groupPositions.get(group.id) || { x: 80, y: 80 },
      parentId: group.parentId || undefined,
      extent: group.parentId ? "parent" : undefined,
      style: {
        width: size.width,
        height: size.height,
      },
    });
  }

  const leafNodes = (ir.nodes || [])
    .filter((node) => node.kind !== "module")
    .map((node) => {
      const modulePath = Array.isArray(node.modulePath) ? node.modulePath : [];
      const groupId = modulePath.length > 0 ? modulePath[modulePath.length - 1] : null;
      return {
        id: node.id,
        type: "default",
        data: {
          label: toNodeLabel(node),
          kind: node.kind,
          resourceType: node.resourceType,
          action: node.action,
        },
        position: node.__rfPosition || { x: 0, y: 0 },
        parentId: groupId || undefined,
        extent: groupId ? "parent" : undefined,
      };
    });

  const emittedNodeIds = new Set([
    ...groupNodes.map((node) => node.id),
    ...leafNodes.map((node) => node.id),
  ]);

  const nodeGroupMap = new Map();
  for (const node of ir.nodes || []) {
    const modulePath = Array.isArray(node.modulePath) ? node.modulePath : [];
    nodeGroupMap.set(node.id, modulePath.length ? modulePath[modulePath.length - 1] : null);
  }

  const edges = (ir.edges || [])
    .filter((edge) => {
      const sourceGroup = nodeGroupMap.get(edge.source) || null;
      const targetGroup = nodeGroupMap.get(edge.target) || null;
      return (
        sourceGroup === targetGroup &&
        emittedNodeIds.has(edge.source) &&
        emittedNodeIds.has(edge.target)
      );
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      data: {
        kind: edge.kind,
        label: edge.label || null,
      },
      animated: edge.kind === "data-flow",
    }));

  return {
    type: "reactflow",
    version: 1,
    source: "terraform-pipeline",
    nodes: [...groupNodes, ...leafNodes],
    edges,
    meta: {
      generatedAt: new Date().toISOString(),
      nodeCount: leafNodes.length,
      groupCount: groupNodes.length,
      edgeCount: edges.length,
      edgePolicy: "intra-module-only",
    },
  };
}

async function render({ ir }) {
  return {
    contentType: "application/json",
    fileExtension: "reactflow.json",
    body: buildReactFlowDocument(ir),
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
