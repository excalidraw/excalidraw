function rand() {
  return Math.floor(Math.random() * 2147483647);
}

const ACTION_COLORS = {
  create: "#d3f9d8",
  delete: "#ffe3e3",
  update: "#fff3bf",
  existing: "#e7f5ff",
  external: "#f8f9fa",
  "no-op": "#e7f5ff",
};

const ACTION_STROKE = {
  create: "#2b8a3e",
  delete: "#c92a2a",
  update: "#e67700",
  existing: "#1971c2",
  external: "#868e96",
  "no-op": "#1971c2",
};

function getPrimaryAction(node) {
  const actions = new Set();
  for (const resource of Object.values(node.resources || {})) {
    for (const action of resource.change?.actions || []) {
      actions.add(action);
    }
  }
  if (actions.has("create")) return "create";
  if (actions.has("delete")) return "delete";
  if (actions.has("update")) return "update";
  if (actions.has("external")) return "external";
  return "existing";
}

function getLabel(nodePath) {
  const parts = nodePath.split(".");
  const moduleParts = [];
  let resourceParts = [];

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "module" && i + 1 < parts.length) {
      moduleParts.push(parts[i + 1]);
      i++;
    } else {
      resourceParts = parts.slice(i);
      break;
    }
  }

  const lines = [];
  if (moduleParts.length > 0) {
    lines.push(moduleParts.join("."));
  }
  lines.push(resourceParts.join("."));
  return lines.join("\n");
}

function makeBaseElement(overrides) {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: rand(),
    version: 1,
    versionNonce: rand(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    locked: false,
    link: null,
    updated: Date.now(),
    ...overrides,
  };
}

function getBindingPoints(posA, posB, rectW, rectH) {
  const dx = posB.x + rectW / 2 - (posA.x + rectW / 2);
  const dy = posB.y + rectH / 2 - (posA.y + rectH / 2);

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { startFixed: [1, 0.5], endFixed: [0, 0.5] }
      : { startFixed: [0, 0.5], endFixed: [1, 0.5] };
  }
  return dy >= 0
    ? { startFixed: [0.5, 1], endFixed: [0.5, 0] }
    : { startFixed: [0.5, 0], endFixed: [0.5, 1] };
}

const RECT_W = 280;
const RECT_H = 80;
const PAD_X = 120;
const PAD_Y = 100;

function nodesToExcalidraw(nodes) {
  const elements = [];
  const nodeKeys = Object.keys(nodes);
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodeKeys.length)));
  const posMap = {};

  // --- rectangles + labels ---
  for (let i = 0; i < nodeKeys.length; i++) {
    const nodePath = nodeKeys[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (RECT_W + PAD_X) + 50;
    const y = row * (RECT_H + PAD_Y) + 50;

    const rectId = `rect-${i}`;
    const textId = `text-${i}`;
    posMap[nodePath] = { x, y, rectId, textId };

    const action = getPrimaryAction(nodes[nodePath]);
    const bgColor = ACTION_COLORS[action] || ACTION_COLORS.existing;
    const strokeColor = ACTION_STROKE[action] || ACTION_STROKE.existing;
    const label = getLabel(nodePath);

    elements.push(
      makeBaseElement({
        type: "rectangle",
        id: rectId,
        x,
        y,
        width: RECT_W,
        height: RECT_H,
        strokeColor,
        backgroundColor: bgColor,
        roundness: { type: 3 },
        boundElements: [{ id: textId, type: "text" }],
        strokeStyle: action === "external" ? "dashed" : "solid",
      }),
    );

    elements.push(
      makeBaseElement({
        type: "text",
        id: textId,
        x: x + 10,
        y: y + 10,
        width: RECT_W - 20,
        height: RECT_H - 20,
        text: label,
        fontSize: 16,
        fontFamily: 3,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: rectId,
        originalText: label,
        autoResize: false,
        lineHeight: 1.25,
        strokeColor: "#1e1e1e",
      }),
    );
  }

  // --- collect unique edge pairs ---
  const edgeSet = new Set();
  for (const [nodePath, node] of Object.entries(nodes)) {
    const allEdges = [
      ...new Set([...(node.edges_new || []), ...(node.edges_existing || [])]),
    ];
    for (const target of allEdges) {
      if (!posMap[target]) continue;
      const pair = [nodePath, target].sort().join("|||");
      edgeSet.add(pair);
    }
  }

  // --- bidirectional arrows ---
  let arrowIdx = 0;
  for (const pair of edgeSet) {
    const [a, b] = pair.split("|||");
    const posA = posMap[a];
    const posB = posMap[b];
    const arrowId = `arrow-${arrowIdx++}`;

    const rectA = elements.find((e) => e.id === posA.rectId);
    const rectB = elements.find((e) => e.id === posB.rectId);
    rectA.boundElements.push({ id: arrowId, type: "arrow" });
    rectB.boundElements.push({ id: arrowId, type: "arrow" });

    const { startFixed, endFixed } = getBindingPoints(
      posA,
      posB,
      RECT_W,
      RECT_H,
    );

    const startX = posA.x + startFixed[0] * RECT_W;
    const startY = posA.y + startFixed[1] * RECT_H;
    const endX = posB.x + endFixed[0] * RECT_W;
    const endY = posB.y + endFixed[1] * RECT_H;

    elements.push(
      makeBaseElement({
        type: "arrow",
        id: arrowId,
        x: startX,
        y: startY,
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        points: [
          [0, 0],
          [endX - startX, endY - startY],
        ],
        startBinding: {
          elementId: posA.rectId,
          fixedPoint: startFixed,
          mode: "orbit",
        },
        endBinding: {
          elementId: posB.rectId,
          fixedPoint: endFixed,
          mode: "orbit",
        },
        startArrowhead: "arrow",
        endArrowhead: "arrow",
        roundness: { type: 2 },
      }),
    );
  }

  return {
    type: "excalidraw",
    version: 2,
    source: "terraform-pipeline",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null,
    },
  };
}

module.exports = { nodesToExcalidraw };
