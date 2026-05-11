/**
 * Dependency and data-flow edge collection plus arrow binding geometry for Terraform → Excalidraw.
 */
/** Numeric clamp to `[min, max]`. */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Intersection of rectangle edge toward `target` center; returns absolute coords + normalized fixedPoint. */
function getEdgePointTowardTarget(pos, w, h, target) {
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return {
      x: cx,
      y: cy,
      fixedPoint: [0.5, 0.5],
    };
  }

  const halfW = Math.max(w / 2, 1e-6);
  const halfH = Math.max(h / 2, 1e-6);
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  const x = cx + dx * scale;
  const y = cy + dy * scale;

  return {
    x,
    y,
    fixedPoint: [clamp((x - pos.x) / w, 0, 1), clamp((y - pos.y) / h, 0, 1)],
  };
}

/** Arrow endpoints between two rectangles, each aimed from its center toward the peer center. */
function getCenterClippedBindingPoints(posA, posB, wA, hA, wB, hB) {
  const centerA = { x: posA.x + wA / 2, y: posA.y + hA / 2 };
  const centerB = { x: posB.x + wB / 2, y: posB.y + hB / 2 };

  const start = getEdgePointTowardTarget(posA, wA, hA, centerB);
  const end = getEdgePointTowardTarget(posB, wB, hB, centerA);

  return {
    startPoint: { x: start.x, y: start.y },
    endPoint: { x: end.x, y: end.y },
    // Keep focus points at centroids so bound arrows stay sensible after moves.
    startFixed: [0.5, 0.5],
    endFixed: [0.5, 0.5],
  };
}

// --- Edge collection ---

/** De-duplicates outgoing `edges_new` / `edges_existing` into directed records with kind sets. */
function collectDirectedEdges(nodes) {
  const edgeMap = new Map();

  const addEdge = (source, target, kind, origin) => {
    if (!nodes[source] || !nodes[target]) {
      return;
    }

    const key = `${source}|||${target}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.kinds.add(kind);
      existing.origins.add(origin);
      return;
    }

    edgeMap.set(key, {
      source,
      target,
      kinds: new Set([kind]),
      origins: new Set([origin]),
    });
  };

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    for (const target of node.edges_new || []) {
      addEdge(nodePath, target, "planned_dependency", "dot");
    }
    for (const target of node.edges_existing || []) {
      addEdge(nodePath, target, "existing_dependency", "terraform_state");
    }
  }

  return [...edgeMap.values()].map((edge) => ({
    ...edge,
    kinds: [...edge.kinds],
    origins: [...edge.origins],
  }));
}

/** Groups A→B and B→A dependency edges into one undirected pair with direction metadata. */
function coalesceRelationshipPairs(directedEdges) {
  const pairMap = new Map();

  for (const edge of directedEdges) {
    const pairKey = [edge.source, edge.target].sort().join("|||");
    const existing = pairMap.get(pairKey);

    if (!existing) {
      pairMap.set(pairKey, {
        key: pairKey,
        nodes: [edge.source, edge.target].sort(),
        directions: [edge],
      });
      continue;
    }

    existing.directions.push(edge);
  }

  return [...pairMap.values()].map((pair) => {
    const uniqueDirections = new Map();

    for (const direction of pair.directions) {
      uniqueDirections.set(
        `${direction.source}|||${direction.target}`,
        direction,
      );
    }

    const directions = [...uniqueDirections.values()];
    const isBidirectional = directions.length > 1;
    const [defaultSource, defaultTarget] = isBidirectional
      ? pair.nodes
      : [directions[0].source, directions[0].target];

    return {
      source: defaultSource,
      target: defaultTarget,
      directed: !isBidirectional,
      bidirectional: isBidirectional,
      directions: directions.map((direction) => ({
        source: direction.source,
        target: direction.target,
        kinds: direction.kinds,
        origins: direction.origins,
      })),
      kinds: [...new Set(directions.flatMap((direction) => direction.kinds))],
      origins: [
        ...new Set(directions.flatMap((direction) => direction.origins)),
      ],
    };
  });
}

/** Normalizes `edges_data_flow` into drawable pairs, merging true bidirectional duplicates. */
function collectDataFlowEdges(nodes) {
  const edgeMap = new Map();

  for (const [source, node] of Object.entries(nodes)) {
    if (source.startsWith("__")) {
      continue;
    }
    for (const edge of node.edges_data_flow || []) {
      const target = edge.target;
      if (!nodes[source] || !nodes[target] || source === target) {
        continue;
      }

      const type = edge.type || "data_flow";
      const label = edge.label || type;
      const origin = edge.origin || "inferred_reference";
      const key = `${source}|||${target}|||${type}|||${label}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          source,
          target,
          type,
          label,
          origin,
          detail: edge.detail || null,
        });
      }
    }
  }

  const pairMap = new Map();
  for (const edge of edgeMap.values()) {
    const pairKey = [edge.source, edge.target].sort().join("|||");
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey).push(edge);
  }

  const collected = [];
  for (const edges of pairMap.values()) {
    const directions = new Set(
      edges.map((edge) => `${edge.source}|||${edge.target}`),
    );
    if (directions.size <= 1) {
      collected.push(...edges);
      continue;
    }

    const [source, target] = [edges[0].source, edges[0].target].sort();
    const labels = [...new Set(edges.map((edge) => edge.label))];
    const types = [...new Set(edges.map((edge) => edge.type))];
    collected.push({
      source,
      target,
      type: types.length === 1 ? types[0] : "bidirectional_data_flow",
      label: labels.join(" / "),
      origin: [...new Set(edges.map((edge) => edge.origin))].join(", "),
      detail: edges
        .map((edge) => edge.detail)
        .filter(Boolean)
        .join(", "),
      bidirectional: true,
      directions: edges,
    });
  }

  return collected;
}

/** Normalizes `edges_networking` into drawable pairs (SG peers), merging bidirectional duplicates. */
function collectNetworkingEdges(nodes) {
  const edgeMap = new Map();

  for (const [source, node] of Object.entries(nodes)) {
    if (source.startsWith("__")) {
      continue;
    }
    for (const edge of node.edges_networking || []) {
      const target = edge.target;
      if (!nodes[source] || !nodes[target] || source === target) {
        continue;
      }

      const type = edge.type || "networking";
      const label = edge.label || type;
      const origin = edge.origin || "networking_inferred";
      const key = `${source}|||${target}|||${type}|||${label}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          source,
          target,
          type,
          label,
          origin,
          detail: edge.detail || null,
        });
      }
    }
  }

  const pairMap = new Map();
  for (const edge of edgeMap.values()) {
    const pairKey = [edge.source, edge.target].sort().join("|||");
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey).push(edge);
  }

  const collected = [];
  for (const edges of pairMap.values()) {
    const directions = new Set(
      edges.map((edge) => `${edge.source}|||${edge.target}`),
    );
    if (directions.size <= 1) {
      collected.push(...edges);
      continue;
    }

    const [source, target] = [edges[0].source, edges[0].target].sort();
    const labels = [...new Set(edges.map((edge) => edge.label))];
    const types = [...new Set(edges.map((edge) => edge.type))];
    collected.push({
      source,
      target,
      type: types.length === 1 ? types[0] : "bidirectional_networking",
      label: labels.join(" / "),
      origin: [...new Set(edges.map((edge) => edge.origin))].join(", "),
      detail: edges
        .map((edge) => edge.detail)
        .filter(Boolean)
        .join(", "),
      bidirectional: true,
      directions: edges,
    });
  }

  return collected;
}

/** Adjacency of nodes that share a dependency, data-flow, or networking-record edge (explode UI). */
function buildTerraformExplodeParentMap(
  nodeKeys,
  directedEdges,
  dataFlowEdges,
  networkingEdges,
) {
  const nodeKeySet = new Set(nodeKeys);
  const parentMap = new Map(nodeKeys.map((nodeKey) => [nodeKey, new Set()]));

  const addPair = (source, target) => {
    if (
      !nodeKeySet.has(source) ||
      !nodeKeySet.has(target) ||
      source === target
    ) {
      return;
    }
    parentMap.get(source).add(target);
    parentMap.get(target).add(source);
  };

  for (const edge of directedEdges) {
    addPair(edge.source, edge.target);
  }

  for (const edge of dataFlowEdges) {
    addPair(edge.source, edge.target);
    for (const direction of edge.directions || []) {
      addPair(direction.source, direction.target);
    }
  }

  if (networkingEdges) {
    for (const edge of networkingEdges) {
      addPair(edge.source, edge.target);
      for (const direction of edge.directions || []) {
        addPair(direction.source, direction.target);
      }
    }
  }

  return parentMap;
}
/** Parallel offset of a segment along its left normal (used to separate stacked arrows). */
function offsetLineSegment(startPoint, endPoint, offset) {
  if (!offset) {
    return { startPoint, endPoint };
  }

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / length) * offset;
  const offsetY = (dx / length) * offset;

  return {
    startPoint: { x: startPoint.x + offsetX, y: startPoint.y + offsetY },
    endPoint: { x: endPoint.x + offsetX, y: endPoint.y + offsetY },
  };
}

/** Normalized binding `[0–1, 0–1]` for a point relative to a positioned rectangle. */
function fixedPointForAbsolutePoint(pos, point) {
  return [
    clamp((point.x - pos.x) / pos.w, 0, 1),
    clamp((point.y - pos.y) / pos.h, 0, 1),
  ];
}

/** Same hexes as `packages/excalidraw/components/terraformElkLayout.ts` dependency strokes. */
const TERRAFORM_DEPENDENCY_EDGE_NEW_ONLY = "#2b8a3e";
const TERRAFORM_DEPENDENCY_EDGE_EXISTING_ONLY = "#1971c2";
const TERRAFORM_DEPENDENCY_EDGE_DELETE = "#c92a2a";
const TERRAFORM_DEPENDENCY_EDGE_REPLACE = "#f08c00";

const PLANNED_DEPENDENCY_KIND = "planned_dependency";
const EXISTING_DEPENDENCY_KIND = "existing_dependency";

/**
 * Coerces `kinds` / `origins` into canonical dependency kind tokens for coloring.
 * Never passes a string into `new Set(kinds)` (that would iterate characters).
 */
function normalizeTerraformDependencyKindTokens(kinds, origins) {
  const tokens = [];

  const pushKind = (k) => {
    if (k === PLANNED_DEPENDENCY_KIND || k === EXISTING_DEPENDENCY_KIND) {
      tokens.push(k);
    }
  };

  if (Array.isArray(kinds)) {
    for (const k of kinds) {
      if (typeof k === "string") {
        pushKind(k);
      }
    }
  } else if (typeof kinds === "string") {
    pushKind(kinds);
  } else if (kinds && typeof kinds === "object") {
    for (const v of Object.values(kinds)) {
      if (typeof v === "string") {
        pushKind(v);
      }
    }
  }

  if (tokens.length === 0) {
    const originList = Array.isArray(origins)
      ? origins
      : typeof origins === "string"
        ? [origins]
        : [];
    for (const o of originList) {
      if (o === "dot") {
        tokens.push(PLANNED_DEPENDENCY_KIND);
      }
      if (o === "terraform_state") {
        tokens.push(EXISTING_DEPENDENCY_KIND);
      }
    }
  }

  return tokens;
}

/**
 * Line stroke for merged dependency `kinds` from `collectDirectedEdges` /
 * `coalesceRelationshipPairs` (`planned_dependency` = DOT/plan, `existing_dependency` = prior state).
 *
 * @param {unknown} kinds - Array of kind strings, or a single kind string, or empty / malformed.
 * @param {{ origins?: unknown, sourceAction?: string|null, targetAction?: string|null }} [options]
 */
function strokeColorForTerraformDependencyKinds(kinds, options = {}) {
  const { origins, sourceAction, targetAction } = options || {};

  if (sourceAction === "delete" || targetAction === "delete") {
    return TERRAFORM_DEPENDENCY_EDGE_DELETE;
  }
  if (sourceAction === "replace" || targetAction === "replace") {
    return TERRAFORM_DEPENDENCY_EDGE_REPLACE;
  }

  const tokens = normalizeTerraformDependencyKindTokens(kinds, origins);
  const set = new Set(tokens);
  const hasNew = set.has(PLANNED_DEPENDENCY_KIND);
  const hasExisting = set.has(EXISTING_DEPENDENCY_KIND);
  // Prior-state / depends_on wins over DOT adjacency: existing (alone or with new) → blue.
  if (hasExisting) {
    return TERRAFORM_DEPENDENCY_EDGE_EXISTING_ONLY;
  }
  if (hasNew) {
    return TERRAFORM_DEPENDENCY_EDGE_NEW_ONLY;
  }
  return "#1e1e1e";
}

module.exports = {
  clamp,
  getEdgePointTowardTarget,
  getCenterClippedBindingPoints,
  collectDirectedEdges,
  coalesceRelationshipPairs,
  collectDataFlowEdges,
  collectNetworkingEdges,
  buildTerraformExplodeParentMap,
  offsetLineSegment,
  fixedPointForAbsolutePoint,
  normalizeTerraformDependencyKindTokens,
  strokeColorForTerraformDependencyKinds,
};
