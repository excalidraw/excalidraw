/**
 * Terraform graph pipeline: plan JSON + DOT adjacency + optional state → enriched `nodes` map.
 *
 * **Node map:** keys are Terraform addresses; values hold `resources`, `edges_new` (DOT BFS),
 * `edges_existing` (state / depends_on), `edges_data_flow` (IAM policy semantics only),
 * and `edges_networking` (SG peer edges).
 * Keys starting with `__` are pipeline metadata (kept through pruning).
 *
 * **Order of transforms** matches `index.js` `POST /terraform/upload`: load plan → state merge →
 * module nodes → module metadata → data-source filter → DOT edges → diffs → existing edges →
 * generic structural refinement → redundant-edge pruning → externals → data-flow edges →
 * VPC facet capture (caller) → plumbing omit → orphans → role-link cleanup → visual-ignore filter.
 */
const { getTerraformNodePaths } = require("./vpc-networking-facet");
const { isPlainObject } = require("./terraform-graph-utils");
const {
  buildDataFlowEdges,
  buildNetworkingEdges,
  buildDataFlowIndex,
  resolveNodeRefsAcrossAllResourceTypes,
} = require("./terraform-data-flow-edges");


const stripIndexes = (address = "") => address.replace(/\[[^\]]+\]/g, "");

/**
 * Map a Terraform address (plan/state/depends_on) to a key in `nodes`.
 * Plan uses indexed addresses (for_each/count) while `terraform graph` DOT
 * uses stripped resource ids — `stripIndexes` is the shared "graph id".
 */
function resolveCanonicalNodePath(nodes, address) {
  if (!address || typeof address !== "string") {
    return null;
  }
  if (nodes[address]) {
    return address;
  }
  const graphId = stripIndexes(address);
  if (nodes[graphId]) {
    return graphId;
  }
  const matches = [];
  for (const k of Object.keys(nodes)) {
    if (k.startsWith("__")) {
      continue;
    }
    if (stripIndexes(k) === graphId) {
      matches.push(k);
    }
  }
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1 && matches.includes(address)) {
    return address;
  }
  return null;
}

const sanitizeDotNodeId = (nodeId = "") => {
  const parts = String(nodeId).trim().split(" ");
  const raw = parts.length >= 2 ? parts[1] : parts[0] || "";
  return raw.replace(/["\\]/g, "");
};

const EDGE_FILTER_RULES = [
  ["aws_iam_role_policy", "aws_lambda_function"],
  ["aws_iam_policy_document", "aws_lambda_function"],
  ["aws_lambda_function", "aws_iam_role_policy"],
  ["aws_lambda_function", "aws_iam_policy_document"],
];

/** Data sources not on this list are omitted from the graph and act as DOT traversal barriers. */
const DATA_SOURCE_GRAPH_ALLOWLIST = new Set(["aws_iam_policy_document"]);

/** Returns the Terraform data source type segment from an address, or null if not a data block. */
function getDataSourceTypeFromAddress(address = "") {
  const parts = stripIndexes(String(address)).split(".");
  const di = parts.indexOf("data");
  if (di === -1 || di >= parts.length - 2) {
    return null;
  }
  return parts[di + 1] || null;
}

/** True when this data source address is not on the graph allowlist (omitted from traversal). */
function isExcludedDataSourceAddress(address) {
  const sourceType = getDataSourceTypeFromAddress(address);
  if (!sourceType) {
    return false;
  }
  return !DATA_SOURCE_GRAPH_ALLOWLIST.has(sourceType);
}

const DATA_FLOW_TARGET_TYPES = new Set([
  "aws_lambda_function",
  "aws_s3_bucket",
  "aws_sqs_queue",
  "aws_sns_topic",
  "aws_dynamodb_table",
  "aws_kinesis_stream",
  "aws_cloudwatch_log_group",
  "aws_lb_target_group",
  "aws_alb_target_group",
]);

const COMPUTE_RESOURCE_TYPES = new Set([
  "aws_lambda_function",
  "aws_ecs_task_definition",
  "aws_ecs_service",
  "aws_instance",
]);

/**
 * Generic semantic key hints for narrowing reference resolution by field name.
 * Unknown keys fall back to all indexed resource types.
 */
const REFERENCE_KEY_TYPE_RULES = {
  functionname: ["aws_lambda_function"],
  function_name: ["aws_lambda_function"],
  queuename: ["aws_sqs_queue"],
  queue_name: ["aws_sqs_queue"],
  topicname: ["aws_sns_topic"],
  topic_name: ["aws_sns_topic"],
  bucketname: ["aws_s3_bucket"],
  bucket: ["aws_s3_bucket"],
  data_bucket: ["aws_s3_bucket"],
  data_queue_url: ["aws_sqs_queue"],
  rolearn: ["aws_iam_role"],
  role_arn: ["aws_iam_role"],
  role: ["aws_iam_role", "aws_iam_instance_profile"],
};

/**
 * Scalar keys that are too collision-prone for generic structural matching.
 * `id` is frequently provider-generated and can repeat across unrelated resources.
 */
const GENERIC_REFERENCE_IGNORED_KEYS = new Set(["id"]);

/** Synthetic node: Terraform module call (for edges + grouping). Not an AWS resource. */
const TERRAFORM_MODULE_RESOURCE_TYPE = "terraform_module";

/**
 * Returns cumulative module paths for a Terraform resource address, e.g.
 * `module.a.module.b.aws_x.y` → [`module.a`, `module.a.module.b`].
 */
function getModulePathChainFromAddress(nodePath = "") {
  const parts = nodePath.split(".");
  const chain = [];
  let cursor = "";

  for (let index = 0; index < parts.length - 1; ) {
    if (parts[index] !== "module" || !parts[index + 1]) {
      break;
    }
    const segment = `module.${parts[index + 1]}`;
    cursor = cursor ? `${cursor}.${segment}` : segment;
    chain.push(cursor);
    index += 2;
  }

  return chain;
}

/** Deepest Terraform module path containing this resource address, or null if root module. */
function getTerraformOwningModulePath(resourceNodePath = "") {
  const chain = getModulePathChainFromAddress(resourceNodePath);
  return chain.length ? chain[chain.length - 1] : null;
}

/**
 * All module path prefixes present under any resource/data node (deduped).
 */
function collectAllTerraformModulePaths(nodePaths) {
  const out = new Set();
  for (const nodePath of nodePaths) {
    for (const modulePath of getModulePathChainFromAddress(nodePath)) {
      out.add(modulePath);
    }
  }
  return out;
}

/** Last path segment of a module address (the declared module label), for synthetic module node names. */
function lastModuleNameSegment(modulePath) {
  const parts = modulePath.split(".");
  return parts[parts.length - 1] || modulePath;
}

/**
 * Inserts one synthetic node per module path so the DOT graph can attach edges to
 * modules without BFS fan-out through module hubs into every child resource.
 */
function ensureTerraformModuleNodes(nodes) {
  const modulePaths = collectAllTerraformModulePaths(Object.keys(nodes));

  for (const modulePath of modulePaths) {
    if (nodes[modulePath]) {
      continue;
    }

    nodes[modulePath] = {
      resources: {
        [modulePath]: {
          address: modulePath,
          type: TERRAFORM_MODULE_RESOURCE_TYPE,
          name: lastModuleNameSegment(modulePath),
          mode: "managed",
          change: { actions: ["no-op"] },
        },
      },
    };
  }

  return nodes;
}

const getResourceValues = (resource = {}) => ({
  ...(resource.values || {}),
  ...(resource.change?.before || {}),
  ...(resource.change?.after || {}),
});

const getPrimaryResource = (node = {}) =>
  Object.values(node.resources || {}).find((resource) => resource?.type) || {};

/** True if the node's primary resource is a data source outside `DATA_SOURCE_GRAPH_ALLOWLIST`. */
function isExcludedDataSourceNode(node, primary = getPrimaryResource(node)) {
  if (!primary || primary.mode !== "data" || !primary.type) {
    return false;
  }
  return !DATA_SOURCE_GRAPH_ALLOWLIST.has(primary.type);
}

const getResourceType = (nodePath, node) =>
  getPrimaryResource(node)?.type || String(nodePath).split(".").at(-2) || "";

const isTerraformModuleNode = (node) =>
  getPrimaryResource(node)?.type === TERRAFORM_MODULE_RESOURCE_TYPE;

const flattenValues = (value, out = []) => {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      flattenValues(item, out);
    }
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) {
      flattenValues(item, out);
    }
  }
  return out;
};

const normalizePolicyArray = (value) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const parsePolicyDocument = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (isPlainObject(value)) {
    return value;
  }
  return null;
};

const normalizeArnPattern = (value = "") =>
  String(value)
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/\*+$/g, "")
    .replace(/\/+$/g, "");

const dataFlowRelationshipForAction = (action = "") => {
  const normalized = String(action).toLowerCase();
  if (normalized === "*" || normalized.endsWith(":*")) {
    return null;
  }

  if (
    normalized.startsWith("s3:get") ||
    normalized.startsWith("s3:list") ||
    normalized.startsWith("dynamodb:get") ||
    normalized.startsWith("dynamodb:query") ||
    normalized.startsWith("dynamodb:scan") ||
    normalized.startsWith("sqs:receive") ||
    normalized.startsWith("kinesis:get") ||
    normalized.startsWith("kinesis:describe")
  ) {
    return { type: "reads", label: "reads", direction: "target_to_source" };
  }

  if (
    normalized.startsWith("s3:put") ||
    normalized.startsWith("s3:delete") ||
    normalized.startsWith("dynamodb:put") ||
    normalized.startsWith("dynamodb:update") ||
    normalized.startsWith("dynamodb:delete") ||
    normalized.startsWith("dynamodb:batchwrite")
  ) {
    return { type: "writes", label: "writes", direction: "source_to_target" };
  }

  if (
    normalized.startsWith("sqs:send") ||
    normalized.startsWith("sns:publish") ||
    normalized.startsWith("events:put") ||
    normalized.startsWith("eventbridge:put") ||
    normalized.startsWith("kinesis:put")
  ) {
    return {
      type: "publishes",
      label: "publishes",
      direction: "source_to_target",
    };
  }

  if (
    normalized.startsWith("logs:create") ||
    normalized.startsWith("logs:put")
  ) {
    return { type: "logs", label: "logs", direction: "source_to_target" };
  }

  return null;
};

/** Builds adjacency lists from a graphlib DOT graph (sanitized node ids → successor lists). */
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

/** Seeds `nodes` from `plan.resource_changes` (one node per change address, resource keyed by address). */
function loadPlanAndNodes(plan) {
  const nodes = {};
  const resourceChanges = plan.resource_changes || [];

  for (const resourceChange of resourceChanges) {
    const address = resourceChange.address;
    const nodePath = address;
    if (!nodes[nodePath]) {
      nodes[nodePath] = { resources: {} };
    }
    nodes[nodePath].resources[address] = resourceChange;
  }

  return nodes;
}

/**
 * For each node, BFS over DOT adjacency to reachable graph nodes; module vertices are barriers
 * (one hop into the module, no fan-in to all children). Sets `edges_new` per node.
 */
function buildNewEdges(nodes, adjacency) {
  const moduleBoundarySet = collectAllTerraformModulePaths(Object.keys(nodes));

  for (const nodePath of Object.keys(nodes)) {
    const visited = new Set([nodePath]);
    const queue = [nodePath];
    const connectedNodes = new Set();

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      const graphKey = stripIndexes(current);
      const neighbors =
        adjacency[graphKey] || adjacency[current] || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);

        if (neighbor.startsWith("provider")) {
          continue;
        }

        if (isExcludedDataSourceAddress(neighbor)) {
          continue;
        }

        // Terraform graph uses intermediate module vertex names matching module paths.
        // Never traverse through them: attach at most one edge to the synthetic module
        // node so BFS does not pull in every resource under the module.
        if (moduleBoundarySet.has(neighbor)) {
          if (nodes[neighbor]) {
            connectedNodes.add(neighbor);
          }
          continue;
        }

        if (nodes[neighbor]) {
          connectedNodes.add(neighbor);
          continue;
        }

        queue.push(neighbor);
      }
    }

    nodes[nodePath].edges_new = [...connectedNodes];
  }

  for (const node of Object.values(nodes)) {
    node.edges_new = [...new Set(node.edges_new || [])];
  }

  return nodes;
}

/** Attaches `change.diff` per resource from before/after snapshots (skips synthetic module stubs). */
function computeResourceDiffs(nodes) {
  for (const node of Object.values(nodes)) {
    for (const resource of Object.values(node.resources || {})) {
      if (resource.type === TERRAFORM_MODULE_RESOURCE_TYPE) {
        continue;
      }
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

/** Walks `prior_state` to add `depends_on` edges into `edges_existing`, merging with plan nodes. */
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
      if (
        resource.mode === "data" &&
        resource.type &&
        !DATA_SOURCE_GRAPH_ALLOWLIST.has(resource.type)
      ) {
        continue;
      }

      const nodePath = resource.address;
      nodes[nodePath] ||= { resources: {} };

      if (!nodes[nodePath].resources[resource.address]) {
        nodes[nodePath].resources[resource.address] = {
          ...resource,
          change: { actions: ["existing"] },
        };
      }

      for (const dependency of resource.depends_on || []) {
        if (isExcludedDataSourceAddress(dependency)) {
          continue;
        }
        addEdge(resource.address, dependency);
      }
    }

    for (const childModule of currentModule.child_modules || []) {
      stack.push(childModule);
    }
  }

  for (const [rawSource, targets] of Object.entries(existingEdges)) {
    const source = resolveCanonicalNodePath(nodes, rawSource);
    if (!source) {
      continue;
    }
    nodes[source].edges_existing ||= [];

    for (const rawTarget of targets) {
      const target = resolveCanonicalNodePath(nodes, rawTarget);
      if (!target) {
        continue;
      }
      if (!nodes[source].edges_existing.includes(target)) {
        nodes[source].edges_existing.push(target);
      }
    }
  }

  return nodes;
}

/** Recursively reads `configuration.root_module` module_calls to collect registry source/version per path. */
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

/** Recursively collects module call expressions/outputs keyed by absolute module path. */
function collectModuleConfigFromPlan(moduleConfig, modulePath = "", out = {}) {
  for (const [moduleName, moduleCall] of Object.entries(moduleConfig?.module_calls || {})) {
    const childModulePath = modulePath
      ? `${modulePath}.module.${moduleName}`
      : `module.${moduleName}`;

    out[childModulePath] = {
      expressions: moduleCall.expressions || {},
      outputs: moduleCall.module?.outputs || {},
    };

    if (moduleCall.module) {
      collectModuleConfigFromPlan(moduleCall.module, childModulePath, out);
    }
  }

  return out;
}

/** Annotates each node with `terraform_module` chain entries (source/version) from plan configuration. */
function applyModuleMetadata(nodes, plan) {
  const moduleMetadata = collectModuleMetadataFromConfig(
    plan?.configuration?.root_module,
  );
  const moduleConfig = collectModuleConfigFromPlan(
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

    const entries = moduleChain.map((modulePath) => ({
      modulePath,
      ...(moduleMetadata[modulePath] || {}),
    }));

    const primary = getPrimaryResource(node);
    const isSyntheticModuleRoot =
      primary.type === TERRAFORM_MODULE_RESOURCE_TYPE &&
      nodePath === moduleChain[moduleChain.length - 1];

    node.terraform_module = isSyntheticModuleRoot
      ? entries
      : entries.filter((metadata) => metadata.source || metadata.version);

    if (isSyntheticModuleRoot && moduleConfig[nodePath]) {
      node.terraform_config = moduleConfig[nodePath];
    }
  }

  return nodes;
}

/** Builds the Terraform state address for one resource instance (module prefix, index_key). */
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

/** Merges tfstate instances into nodes: `values`, `terraform_state`, and `edges_existing` from dependencies.
 * Used after `loadPlanAndNodes` for both plan+dot uploads (optional state) and **state-only** uploads
 * (empty `resource_changes`, nodes seeded entirely from `state.resources`).
 */
function mergeTerraformState(nodes, state) {
  if (!state || !Array.isArray(state.resources)) {
    return nodes;
  }

  for (const resource of state.resources) {
    if (
      resource.mode === "data" &&
      resource.type &&
      !DATA_SOURCE_GRAPH_ALLOWLIST.has(resource.type)
    ) {
      continue;
    }

    for (const instance of resource.instances || []) {
      const address = getStateResourceAddress(resource, instance);
      const nodePath = address;

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
        if (isExcludedDataSourceAddress(dependency)) {
          continue;
        }
        const target = resolveCanonicalNodePath(nodes, dependency);
        if (target && target !== nodePath && !nodes[nodePath].edges_existing.includes(target)) {
          nodes[nodePath].edges_existing.push(target);
        }
      }
    }
  }

  return nodes;
}

/** Ensures every node has mutable edge list arrays. */
function ensureEdgeLists(nodes) {
  for (const node of Object.values(nodes)) {
    node.edges_new ||= [];
    node.edges_existing ||= [];
    node.edges_data_flow ||= [];
    node.edges_networking ||= [];
  }
  return nodes;
}

/** Combined outgoing structural targets present in `nodes` (plan-backed graph vertices only). */
function collectStructuralSuccessors(nodes, sourcePath) {
  const node = nodes[sourcePath];
  if (!node) {
    return [];
  }
  const combined = new Set([
    ...(node.edges_new || []),
    ...(node.edges_existing || []),
  ]);
  return [...combined].filter((target) => nodes[target]);
}

/**
 * True if `target` is reachable from `start` using structural edges only, without traversing
 * the single hop `start` → `forbiddenTarget`.
 */
function reachableWithoutDirectEdge(nodes, adjacency, start, forbiddenTarget) {
  if (start === forbiddenTarget) {
    return false;
  }
  const visited = new Set([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    const successors = adjacency.get(current);
    if (!successors) {
      continue;
    }
    for (const nextVertex of successors) {
      if (current === start && nextVertex === forbiddenTarget) {
        continue;
      }
      if (nextVertex === forbiddenTarget) {
        return true;
      }
      if (!visited.has(nextVertex)) {
        visited.add(nextVertex);
        queue.push(nextVertex);
      }
    }
  }

  return false;
}

/**
 * Drops redundant shortcut edges from `edges_new` / `edges_existing` when another path exists.
 * Terraform DOT traversal through vars/outputs can link distant modules directly even though an
 * intermediate resource/module chain already encodes the dependency — misleading on infra diagrams.
 *
 * `options.mode` controls pruning scope:
 * - `module-only` (default): prune only if source/target is a `terraform_module` node.
 * - `global`: prune any structural shortcut edge.
 * - `off`: skip pruning.
 *
 * Example (`module-only` / `global`):
 * - before: module.a -> [module.b, module.c], module.b -> [module.c]
 * - after:  module.a -> [module.b],           module.b -> [module.c]
 * (`module.a -> module.c` is removed because `a -> b -> c` already exists.)
 */
function pruneRedundantStructuralEdges(nodes, options = {}) {
  const mode = options.mode || "module-only";
  if (mode === "off") {
    return nodes;
  }
  const adjacency = new Map();

  for (const nodePath of Object.keys(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    const successors = collectStructuralSuccessors(nodes, nodePath);
    if (successors.length === 0) {
      continue;
    }
    adjacency.set(nodePath, new Set(successors));
  }

  const pruneFromList = (list, sourcePath) => {
    const raw = Array.isArray(list) ? list : [];
    const seen = new Set();
    const next = [];
    for (const target of raw) {
      if (seen.has(target)) {
        continue;
      }
      seen.add(target);
      if (!nodes[target]) {
        next.push(target);
        continue;
      }
      const canPruneShortcut = mode === "global"
        ? true
        : isTerraformModuleNode(nodes[sourcePath]) || isTerraformModuleNode(nodes[target]);
      const redundant =
        canPruneShortcut &&
        sourcePath !== target &&
        reachableWithoutDirectEdge(nodes, adjacency, sourcePath, target);
      if (!redundant) {
        next.push(target);
      }
    }
    return next;
  };

  for (const nodePath of Object.keys(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    const node = nodes[nodePath];
    node.edges_new = pruneFromList(node.edges_new, nodePath);
    node.edges_existing = pruneFromList(node.edges_existing, nodePath);
  }

  return nodes;
}

/**
 * Generic resolver: derive structural targets by resolving references found in
 * resource values, then include owning module nodes for those targets.
 */
function createGenericResourceReferenceResolver(options = {}) {
  return {
    id: "generic-resource-references",
    match() {
      return true;
    },
    resolve(_nodePath, node, context) {
      const targets = new Set();

      for (const resource of Object.values(node.resources || {})) {
        const values = getResourceValues(resource);
        for (const resourcePath of resolveNodeRefsAcrossAllResourceTypes(
          values,
          context.index,
          context.nodes,
          { ignoredKeys: options.ignoredReferenceKeys },
        )) {
          if (context.nodes[resourcePath]) {
            targets.add(resourcePath);
          }
          const modulePath = getTerraformOwningModulePath(resourcePath);
          if (modulePath && context.nodes[modulePath]) {
            targets.add(modulePath);
          }
        }
      }

      if (targets.size === 0) {
        return { policy: "ignore", targets: [] };
      }

      return { policy: "replace", targets: [...targets] };
    },
  };
}

/**
 * Applies resolver rules to structural edges. Resolvers run in order; first matching
 * actionable rule (`replace` / `augment`) wins for each node.
 */
function refineEdgesWithResolvers(nodes, resolvers = []) {
  const context = {
    nodes,
    index: buildDataFlowIndex(nodes),
  };

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }

    for (const resolver of resolvers) {
      if (!resolver?.match?.(nodePath, node, context)) {
        continue;
      }
      const outcome = resolver.resolve(nodePath, node, context) || {};
      const policy = outcome.policy || "ignore";
      const targets = [...new Set(outcome.targets || [])].filter(
        (target) => target && nodes[target] && target !== nodePath,
      );

      if (policy === "replace") {
        if (targets.length > 0) {
          node.edges_new = targets;
          node.edges_existing = targets;
        }
        break;
      }

      if (policy === "augment") {
        if (targets.length > 0) {
          node.edges_new = [...new Set([...(node.edges_new || []), ...targets])];
          node.edges_existing = [...new Set([...(node.edges_existing || []), ...targets])];
        }
        break;
      }
    }
  }

  return nodes;
}

/**
 * Generic structural edge refinement via resolver rules.
 * Accepts optional custom resolvers prepended before defaults.
 */
function detectGenericStructuralEdges(nodes, options = {}) {
  const customResolvers = Array.isArray(options.customResolvers)
    ? options.customResolvers
    : [];
  const disabled = new Set(options.disabledDefaultResolverIds || []);
  const defaultResolvers = [createGenericResourceReferenceResolver(options)].filter(
    (resolver) => !disabled.has(resolver.id),
  );
  return refineEdgesWithResolvers(nodes, [...customResolvers, ...defaultResolvers]);
}

/**
 * Backward-compatible alias for legacy call sites/tests.
 * Name kept for historical reasons; behavior is generic, not alarm-specific.
 */
function refineCloudWatchMetricAlarmEdges(nodes, options = {}) {
  return detectGenericStructuralEdges(nodes, options);
}

/** Creates a placeholder node for an edge target that exists outside the current plan graph. */
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

/** Ensures `externals` map has an entry for `edge`, creating a stub external node if missing. */
function addExternalBackRef(externals, edge, backRef) {
  if (!externals[edge]) {
    externals[edge] = makeExternalNode(edge, backRef);
  }
}

/** Materializes stub nodes for missing edge endpoints so the graph stays connected for layout. */
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

/** Routing plumbing: folded into VPC facet tree; omitted from canvas graph. */
const VPC_PLUMBING_OMIT_TYPES = new Set([
  "aws_route_table",
  "aws_route",
  "aws_route_table_association",
  "aws_default_route_table",
  "aws_main_route_table_association",
  "aws_internet_gateway",
  "aws_nat_gateway",
]);

/** Removes any edge whose peer path is in `omitted` from new, existing, and data-flow lists. */
function stripEdgesReferencingPaths(nodes, omitted) {
  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__") || !node) {
      continue;
    }
    node.edges_new = (node.edges_new || []).filter((e) => !omitted.has(e));
    node.edges_existing = (node.edges_existing || []).filter(
      (e) => !omitted.has(e),
    );
    node.edges_data_flow = (node.edges_data_flow || []).filter(
      (edge) => !omitted.has(edge.target),
    );
    node.edges_networking = (node.edges_networking || []).filter(
      (edge) => !omitted.has(edge.target),
    );
  }
}

/** Deletes non-allowlisted data source nodes and strips all edges pointing at them. */
function omitNonAllowlistedDataSourceNodes(nodes) {
  const omitted = new Set();
  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__") || !node) {
      continue;
    }
    if (isExcludedDataSourceNode(node)) {
      omitted.add(nodePath);
    }
  }
  stripEdgesReferencingPaths(nodes, omitted);
  for (const path of omitted) {
    delete nodes[path];
  }
  return nodes;
}

function isStateOnlyResource(resource = {}) {
  const actions = resource?.change?.actions;
  return Array.isArray(actions) && actions.length === 1 && actions[0] === "existing";
}

/**
 * Removes data source nodes that come only from tfstate and have no plan-backed
 * change entry, so stale state does not resurrect config that is being removed.
 */
function omitStateOnlyDataSourceNodes(nodes) {
  const omitted = new Set();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__") || !node) {
      continue;
    }
    const resources = Object.values(node.resources || {});
    if (resources.length === 0) {
      continue;
    }
    const dataResources = resources.filter((resource) => resource?.mode === "data");
    if (dataResources.length === 0) {
      continue;
    }
    const hasPlanBackedDataResource = dataResources.some(
      (resource) => !isStateOnlyResource(resource),
    );
    if (!hasPlanBackedDataResource) {
      omitted.add(nodePath);
    }
  }

  stripEdgesReferencingPaths(nodes, omitted);
  for (const path of omitted) {
    delete nodes[path];
  }
  return nodes;
}

function isIamPolicyDocumentDataAddress(address = "") {
  return /\.data\.aws_iam_policy_document\./.test(stripIndexes(String(address)));
}

function hasConcreteIamPolicyDocumentInstance(resource = {}, nodePath = "") {
  if (resource?.type !== "aws_iam_policy_document") {
    return false;
  }
  if (resource?.mode && resource.mode !== "data") {
    return false;
  }

  const hasStateValues =
    isPlainObject(resource.values) && Object.keys(resource.values).length > 0;
  const hasPlannedValues =
    isPlainObject(resource.change?.after) &&
    Object.keys(resource.change.after).length > 0;

  return hasStateValues || hasPlannedValues;
}

/**
 * Removes config-only/ghost IAM policy-document nodes that can appear as
 * dependency placeholders without a concrete instance payload.
 */
function omitGhostIamPolicyDocumentNodes(nodes) {
  const omitted = new Set();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__") || !node) {
      continue;
    }
    if (!isIamPolicyDocumentDataAddress(nodePath)) {
      continue;
    }

    const resources = Object.values(node.resources || {});
    const hasConcretePolicyDoc = resources.some((resource) =>
      hasConcreteIamPolicyDocumentInstance(resource, nodePath),
    );

    if (!hasConcretePolicyDoc) {
      omitted.add(nodePath);
    }
  }

  stripEdgesReferencingPaths(nodes, omitted);
  for (const path of omitted) {
    delete nodes[path];
  }
  return nodes;
}

/** Removes low-level VPC routing types in `VPC_PLUMBING_OMIT_TYPES` after facets are captured. */
function omitVpcPlumbingNodes(nodes) {
  const omitted = new Set();
  for (const nodePath of getTerraformNodePaths(nodes)) {
    const type = getResourceType(nodePath, nodes[nodePath]);
    if (VPC_PLUMBING_OMIT_TYPES.has(type)) {
      omitted.add(nodePath);
    }
  }
  stripEdgesReferencingPaths(nodes, omitted);
  for (const path of omitted) {
    delete nodes[path];
  }
  return nodes;
}

/** Drops nodes with no incident edges (in any edge list); preserves `__*` metadata keys on the map. */
function deleteOrphanedNodes(nodes) {
  const metaEntries = Object.entries(nodes).filter(([key]) => key.startsWith("__"));
  const connected = new Set();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    const edges = [
      ...(node.edges_existing || []),
      ...(node.edges_new || []),
      ...(node.edges_data_flow || []).map((edge) => edge.target),
      ...(node.edges_networking || []).map((edge) => edge.target),
    ];
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
    if (nodePath.startsWith("__")) {
      continue;
    }
    if (connected.has(nodePath)) {
      filtered[nodePath] = node;
    }
  }

  for (const [metaKey, metaValue] of metaEntries) {
    filtered[metaKey] = metaValue;
  }

  return filtered;
}

/** Removes resources tagged `tags.visual === "ignore"` and prunes edges to those paths. */
function filterVisualIgnore(nodes) {
  const ignored = new Set();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
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

  for (const nodePath of getTerraformNodePaths(nodes)) {
    const node = nodes[nodePath];
    node.edges_new = (node.edges_new || []).filter((e) => !ignored.has(e));
    node.edges_existing = (node.edges_existing || []).filter(
      (e) => !ignored.has(e),
    );
    node.edges_data_flow = (node.edges_data_flow || []).filter(
      (edge) => !ignored.has(edge.target),
    );
    node.edges_networking = (node.edges_networking || []).filter(
      (edge) => !ignored.has(edge.target),
    );
  }

  return nodes;
}

/** Applies `EDGE_FILTER_RULES` to drop noisy IAM/Lambda policy edges from dependency lists. */
function cleanUpRoleLinks(nodes) {
  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    node.edges_existing ||= [];
    node.edges_new ||= [];
    node.edges_data_flow ||= [];
    node.edges_networking ||= [];

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
      node.edges_data_flow = node.edges_data_flow.filter(
        (edge) => !edge.target.includes(edgeExclude),
      );
      node.edges_networking = node.edges_networking.filter(
        (edge) => !edge.target.includes(edgeExclude),
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
  ensureTerraformModuleNodes,
  collectAllTerraformModulePaths,
  getModulePathChainFromAddress,
  ensureEdgeLists,
  pruneRedundantStructuralEdges,
  buildDataFlowEdges,
  buildNetworkingEdges,
  externalResources,
  deleteOrphanedNodes,
  omitNonAllowlistedDataSourceNodes,
  omitStateOnlyDataSourceNodes,
  omitGhostIamPolicyDocumentNodes,
  omitVpcPlumbingNodes,
  filterVisualIgnore,
  cleanUpRoleLinks,
  detectGenericStructuralEdges,
  refineCloudWatchMetricAlarmEdges,
  getTerraformOwningModulePath,
  DATA_SOURCE_GRAPH_ALLOWLIST,
  getDataSourceTypeFromAddress,
  isExcludedDataSourceAddress,
};
