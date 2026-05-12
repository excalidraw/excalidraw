/**
 * Undirected neighbor map for Terraform “explode” UI (parity with
 * `packages/backend/excalidraw-arrows.js` collectDataFlowEdges + buildTerraformExplodeParentMap).
 */

export type TerraformDataFlowEdgeRecord = {
  source: string;
  target: string;
  type: string;
  label: string;
  origin: string;
  detail: string | null;
  bidirectional?: boolean;
  directions?: TerraformDataFlowEdgeRecord[];
};

export type TerraformDirectedEdgeLike = {
  source: string;
  target: string;
};

/** Minimal node shape: only `edges_data_flow` is read for data-flow collection. */
export type TerraformNodeWithDataFlow = {
  edges_data_flow?: unknown;
};

/** Minimal node shape for {@link collectNetworkingEdges}. */
export type TerraformNodeWithNetworking = TerraformNodeWithDataFlow & {
  edges_networking?: unknown;
};

function isDataFlowEdgeRecord(value: unknown): value is {
  target?: unknown;
  type?: unknown;
  label?: unknown;
  origin?: unknown;
  detail?: unknown;
} {
  return Boolean(value && typeof value === "object");
}

/**
 * Normalizes `edges_data_flow` into records (merging true bidirectional duplicates),
 * matching backend `collectDataFlowEdges`.
 */
export function collectDataFlowEdges(
  nodes: Record<string, TerraformNodeWithDataFlow | undefined>,
): TerraformDataFlowEdgeRecord[] {
  const edgeMap = new Map<string, TerraformDataFlowEdgeRecord>();

  for (const [source, node] of Object.entries(nodes)) {
    if (source.startsWith("__")) {
      continue;
    }
    const list = node?.edges_data_flow;
    if (!Array.isArray(list)) {
      continue;
    }
    for (const edge of list) {
      if (!isDataFlowEdgeRecord(edge)) {
        continue;
      }
      const target = edge.target;
      if (
        typeof target !== "string" ||
        !nodes[source] ||
        !nodes[target] ||
        source === target
      ) {
        continue;
      }

      const type = typeof edge.type === "string" ? edge.type : "data_flow";
      const label = typeof edge.label === "string" ? edge.label : type;
      const origin =
        typeof edge.origin === "string" ? edge.origin : "inferred_reference";
      const key = `${source}|||${target}|||${type}|||${label}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          source,
          target,
          type,
          label,
          origin,
          detail: typeof edge.detail === "string" ? edge.detail : null,
        });
      }
    }
  }

  const pairMap = new Map<string, TerraformDataFlowEdgeRecord[]>();
  for (const edge of edgeMap.values()) {
    const pairKey = [edge.source, edge.target].sort().join("|||");
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey)!.push(edge);
  }

  const collected: TerraformDataFlowEdgeRecord[] = [];
  for (const edges of pairMap.values()) {
    const directions = new Set(edges.map((e) => `${e.source}|||${e.target}`));
    if (directions.size <= 1) {
      collected.push(...edges);
      continue;
    }

    const [source, target] = [edges[0].source, edges[0].target].sort();
    const labels = [...new Set(edges.map((e) => e.label))];
    const types = [...new Set(edges.map((e) => e.type))];
    collected.push({
      source,
      target,
      type: types.length === 1 ? types[0] : "bidirectional_data_flow",
      label: labels.join(" / "),
      origin: [...new Set(edges.map((e) => e.origin))].join(", "),
      detail: edges
        .map((e) => e.detail)
        .filter(Boolean)
        .join(", "),
      bidirectional: true,
      directions: edges,
    });
  }

  return collected;
}

/**
 * Normalizes `edges_networking` into drawable records (same shape as data-flow collection).
 */
export function collectNetworkingEdges(
  nodes: Record<string, TerraformNodeWithNetworking | undefined>,
): TerraformDataFlowEdgeRecord[] {
  const edgeMap = new Map<string, TerraformDataFlowEdgeRecord>();

  for (const [source, node] of Object.entries(nodes)) {
    if (source.startsWith("__")) {
      continue;
    }
    const list = node?.edges_networking;
    if (!Array.isArray(list)) {
      continue;
    }
    for (const edge of list) {
      if (!isDataFlowEdgeRecord(edge)) {
        continue;
      }
      const target = edge.target;
      if (
        typeof target !== "string" ||
        !nodes[source] ||
        !nodes[target] ||
        source === target
      ) {
        continue;
      }

      const type = typeof edge.type === "string" ? edge.type : "networking";
      const label = typeof edge.label === "string" ? edge.label : type;
      const origin =
        typeof edge.origin === "string" ? edge.origin : "networking_inferred";
      const key = `${source}|||${target}|||${type}|||${label}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          source,
          target,
          type,
          label,
          origin,
          detail: typeof edge.detail === "string" ? edge.detail : null,
        });
      }
    }
  }

  const pairMap = new Map<string, TerraformDataFlowEdgeRecord[]>();
  for (const edge of edgeMap.values()) {
    const pairKey = [edge.source, edge.target].sort().join("|||");
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, []);
    }
    pairMap.get(pairKey)!.push(edge);
  }

  const collected: TerraformDataFlowEdgeRecord[] = [];
  for (const edges of pairMap.values()) {
    const directions = new Set(edges.map((e) => `${e.source}|||${e.target}`));
    if (directions.size <= 1) {
      collected.push(...edges);
      continue;
    }

    const [source, target] = [edges[0].source, edges[0].target].sort();
    const labels = [...new Set(edges.map((e) => e.label))];
    const types = [...new Set(edges.map((e) => e.type))];
    collected.push({
      source,
      target,
      type: types.length === 1 ? types[0] : "bidirectional_networking",
      label: labels.join(" / "),
      origin: [...new Set(edges.map((e) => e.origin))].join(", "),
      detail: edges
        .map((e) => e.detail)
        .filter(Boolean)
        .join(", "),
      bidirectional: true,
      directions: edges,
    });
  }

  return collected;
}

/**
 * Adjacency of nodes that share a dependency or data-flow edge (for explode UI).
 */
export function buildTerraformExplodeParentMap(
  nodeKeys: readonly string[],
  directedEdges: readonly TerraformDirectedEdgeLike[],
  dataFlowEdges: readonly TerraformDataFlowEdgeRecord[],
  networkingEdges?: readonly TerraformDataFlowEdgeRecord[],
): Map<string, Set<string>> {
  const nodeKeySet = new Set(nodeKeys);
  const parentMap = new Map<string, Set<string>>(
    nodeKeys.map((nodeKey) => [nodeKey, new Set<string>()]),
  );

  const addPair = (source: string, target: string) => {
    if (
      !nodeKeySet.has(source) ||
      !nodeKeySet.has(target) ||
      source === target
    ) {
      return;
    }
    parentMap.get(source)!.add(target);
    parentMap.get(target)!.add(source);
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
