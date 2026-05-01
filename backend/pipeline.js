const stripIndexes = (address = "") => address.replace(/\[[^\]]+\]/g, "");

const sanitizeDotNodeId = (nodeId = "") => {
  const parts = String(nodeId).trim().split(" ");
  const raw = parts.length >= 2 ? parts[1] : parts[0] || "";
  return raw.replace(/["\\]/g, "");
};

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const EDGE_FILTER_RULES = [
  ["aws_iam_role_policy", "aws_lambda_function"],
  ["aws_iam_policy_document", "aws_lambda_function"],
  ["aws_lambda_function", "aws_iam_role_policy"],
  ["aws_lambda_function", "aws_iam_policy_document"],
];

function getAdjacencyListFromDot(graph) {
  const adjacency = {};

  for (const { v, w } of graph.edges()) {
    const source = sanitizeDotNodeId(v);
    const target = sanitizeDotNodeId(w);
    if (!adjacency[source]) {
      adjacency[source] = [];
    }
    if (!adjacency[source].includes(target)) {
      adjacency[source].push(target);
    }
  }

  return adjacency;
}

function loadPlanAndNodes(plan) {
  const nodes = {};
  const resourceChanges = plan.resource_changes || [];

  for (const resourceChange of resourceChanges) {
    const address = resourceChange.address;
    const nodePath = stripIndexes(address);
    if (!nodes[nodePath]) {
      nodes[nodePath] = { resources: {} };
    }
    nodes[nodePath].resources[address] = resourceChange;
  }

  return nodes;
}

function buildNewEdges(nodes, adjacency) {
  for (const nodePath of Object.keys(nodes)) {
    const visited = new Set([nodePath]);
    const queue = [nodePath];
    const connectedNodes = new Set();

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      const neighbors = adjacency[current] || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);

        if (neighbor.startsWith("provider")) {
          continue;
        }
        if (nodes[neighbor]) {
          connectedNodes.add(neighbor);
        } else {
          queue.push(neighbor);
        }
      }
    }

    nodes[nodePath].edges_new = [...connectedNodes];
  }

  for (const node of Object.values(nodes)) {
    node.edges_new = [...new Set(node.edges_new || [])];
  }

  return nodes;
}

function computeResourceDiffs(nodes) {
  for (const node of Object.values(nodes)) {
    for (const resource of Object.values(node.resources || {})) {
      const change = resource.change || {};
      const before = change.before || {};
      const after = change.after || {};
      const diff = {};

      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const key of keys) {
        const inBefore = key in before;
        const inAfter = key in after;
        const beforeValue = before[key];
        const afterValue = after[key];

        if (inBefore && !inAfter) {
          if (beforeValue !== null) {
            diff[key] = { before: beforeValue, after: null };
          }
          continue;
        }

        if (!inBefore && inAfter) {
          const isMeaningfulAddedValue =
            afterValue !== null &&
            afterValue !== "" &&
            !(Array.isArray(afterValue) && afterValue.length === 0) &&
            !(isPlainObject(afterValue) && Object.keys(afterValue).length === 0);

          if (isMeaningfulAddedValue) {
            diff[key] = { before: null, after: afterValue };
          }
          continue;
        }

        if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
          diff[key] = { before: beforeValue, after: afterValue };
        }
      }

      resource.change = { ...change, before, after, diff };
    }
  }

  return nodes;
}

function buildExistingEdges(nodes, plan) {
  const rootModule = plan?.prior_state?.values?.root_module;
  if (!rootModule) {
    return nodes;
  }

  const existingEdges = {};
  const addEdge = (from, to) => {
    if (!existingEdges[from]) {
      existingEdges[from] = new Set();
    }
    existingEdges[from].add(to);
  };

  const stack = [rootModule];
  while (stack.length) {
    const currentModule = stack.pop();

    for (const resource of currentModule.resources || []) {
      const nodePath = stripIndexes(resource.address);
      nodes[nodePath] ||= { resources: {} };

      if (!nodes[nodePath].resources[resource.address]) {
        nodes[nodePath].resources[resource.address] = {
          ...resource,
          change: { actions: ["existing"] },
        };
      }

      for (const dependency of resource.depends_on || []) {
        addEdge(resource.address, dependency);
      }
    }

    for (const childModule of currentModule.child_modules || []) {
      stack.push(childModule);
    }
  }

  for (const [rawSource, targets] of Object.entries(existingEdges)) {
    const source = stripIndexes(rawSource);
    if (!nodes[source]) {
      continue;
    }
    nodes[source].edges_existing ||= [];

    for (const rawTarget of targets) {
      const target = stripIndexes(rawTarget);
      if (!nodes[target]) {
        continue;
      }
      if (!nodes[source].edges_existing.includes(target)) {
        nodes[source].edges_existing.push(target);
      }
    }
  }

  return nodes;
}

function collectModuleMetadataFromConfig(moduleConfig, modulePath = "", out = {}) {
  for (const [moduleName, moduleCall] of Object.entries(moduleConfig?.module_calls || {})) {
    const childModulePath = modulePath
      ? `${modulePath}.module.${moduleName}`
      : `module.${moduleName}`;

    out[childModulePath] = {
      source: moduleCall.source || null,
      version: moduleCall.version || moduleCall.version_constraint || null,
    };

    if (moduleCall.module) {
      collectModuleMetadataFromConfig(moduleCall.module, childModulePath, out);
    }
  }

  return out;
}

function applyModuleMetadata(nodes, plan) {
  const moduleMetadata = collectModuleMetadataFromConfig(
    plan?.configuration?.root_module,
  );

  for (const [nodePath, node] of Object.entries(nodes)) {
    const moduleChain = [];
    const parts = nodePath.split(".");
    let cursor = "";

    for (let index = 0; index < parts.length - 1; ) {
      if (parts[index] !== "module" || !parts[index + 1]) {
        break;
      }

      const segment = `module.${parts[index + 1]}`;
      cursor = cursor ? `${cursor}.${segment}` : segment;
      moduleChain.push(cursor);
      index += 2;
    }

    if (moduleChain.length === 0) {
      continue;
    }

    node.terraform_module = moduleChain
      .map((modulePath) => ({
        modulePath,
        ...(moduleMetadata[modulePath] || {}),
      }))
      .filter((metadata) => metadata.source || metadata.version);
  }

  return nodes;
}

function getStateResourceAddress(resource, instance) {
  const parts = [];
  if (resource.module) {
    parts.push(resource.module);
  }
  if (resource.mode === "data") {
    parts.push("data");
  }
  parts.push(resource.type, resource.name);

  let address = parts.join(".");
  if (Object.prototype.hasOwnProperty.call(instance, "index_key")) {
    const key = instance.index_key;
    address += typeof key === "number" ? `[${key}]` : `[${JSON.stringify(key)}]`;
  }
  return address;
}

function mergeTerraformState(nodes, state) {
  if (!state || !Array.isArray(state.resources)) {
    return nodes;
  }

  for (const resource of state.resources) {
    for (const instance of resource.instances || []) {
      const address = getStateResourceAddress(resource, instance);
      const nodePath = stripIndexes(address);

      nodes[nodePath] ||= { resources: {} };

      const existingResource = nodes[nodePath].resources[address] || {};
      nodes[nodePath].resources[address] = {
        ...existingResource,
        address,
        mode: resource.mode,
        type: resource.type,
        name: resource.name,
        provider_name: resource.provider,
        values: {
          ...(instance.attributes || {}),
          ...(existingResource.values || {}),
        },
        change: existingResource.change || { actions: ["existing"] },
        terraform_state: {
          schema_version: instance.schema_version,
          private: Boolean(instance.private),
          dependencies: instance.dependencies || [],
        },
      };

      nodes[nodePath].edges_existing ||= [];
      for (const dependency of instance.dependencies || []) {
        const target = stripIndexes(dependency);
        if (target !== nodePath && !nodes[nodePath].edges_existing.includes(target)) {
          nodes[nodePath].edges_existing.push(target);
        }
      }
    }
  }

  return nodes;
}

function ensureEdgeLists(nodes) {
  for (const node of Object.values(nodes)) {
    node.edges_new ||= [];
    node.edges_existing ||= [];
  }
  return nodes;
}

function makeExternalNode(edge, backRef) {
  return {
    resources: {
      [edge]: {
        address: edge,
        type: edge,
        change: { actions: ["external"] },
      },
    },
    edges_existing: [],
    edges_new: [],
  };
}

function addExternalBackRef(externals, edge, backRef) {
  if (!externals[edge]) {
    externals[edge] = makeExternalNode(edge, backRef);
  }
}

function externalResources(nodes) {
  const externalNodes = {};

  for (const [nodePath, node] of Object.entries(nodes)) {
    for (const edge of node.edges_existing || []) {
      const shouldAdd =
        !nodes[edge] &&
        !edge.includes(".data.") &&
        !edge.includes("aws_iam_role_policy");
      if (shouldAdd) {
        addExternalBackRef(externalNodes, edge, nodePath);
      }
    }

    for (const edge of node.edges_new || []) {
      if (!nodes[edge]) {
        addExternalBackRef(externalNodes, edge, nodePath);
      }
    }
  }

  for (const [edge, externalNode] of Object.entries(externalNodes)) {
    if (!nodes[edge]) {
      nodes[edge] = externalNode;
    }
  }

  return nodes;
}

function deleteOrphanedNodes(nodes) {
  const connected = new Set();

  for (const [nodePath, node] of Object.entries(nodes)) {
    const edges = [...(node.edges_existing || []), ...(node.edges_new || [])];
    if (edges.length > 0) {
      connected.add(nodePath);
    }
    for (const edge of edges) {
      if (nodes[edge]) {
        connected.add(edge);
      }
    }
  }

  const filtered = {};

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (connected.has(nodePath)) {
      filtered[nodePath] = node;
    }
  }

  return filtered;
}

function filterVisualIgnore(nodes) {
  const ignored = new Set();

  for (const [nodePath, node] of Object.entries(nodes)) {
    for (const resource of Object.values(node.resources || {})) {
      const tags = resource.change?.after?.tags ?? resource.values?.tags ?? {};
      if (tags?.visual === "ignore") {
        ignored.add(nodePath);
        break;
      }
    }
  }

  for (const nodePath of ignored) {
    delete nodes[nodePath];
  }

  for (const node of Object.values(nodes)) {
    node.edges_new = (node.edges_new || []).filter((e) => !ignored.has(e));
    node.edges_existing = (node.edges_existing || []).filter(
      (e) => !ignored.has(e),
    );
  }

  return nodes;
}

function cleanUpRoleLinks(nodes) {
  for (const [nodePath, node] of Object.entries(nodes)) {
    node.edges_existing ||= [];
    node.edges_new ||= [];

    for (const [pathMatch, edgeExclude] of EDGE_FILTER_RULES) {
      if (!nodePath.includes(pathMatch)) {
        continue;
      }
      node.edges_existing = node.edges_existing.filter(
        (edge) => !edge.includes(edgeExclude),
      );
      node.edges_new = node.edges_new.filter(
        (edge) => !edge.includes(edgeExclude),
      );
    }
  }

  return nodes;
}

module.exports = {
  getAdjacencyListFromDot,
  loadPlanAndNodes,
  buildNewEdges,
  computeResourceDiffs,
  buildExistingEdges,
  applyModuleMetadata,
  mergeTerraformState,
  ensureEdgeLists,
  externalResources,
  deleteOrphanedNodes,
  filterVisualIgnore,
  cleanUpRoleLinks,
};
