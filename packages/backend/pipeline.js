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
 * Plan-defined watched resources for metric alarms (namespace + dimensions).
 * Terraform's dependency graph also wires alarms to many nodes directly; we replace
 * those edges using this map when possible.
 */
const CLOUDWATCH_ALARM_WATCH_RULES_BY_NAMESPACE = {
  "AWS/Lambda": [
    {
      dimensions: ["FunctionName", "Resource"],
      types: ["aws_lambda_function"],
    },
  ],
  "AWS/SQS": [{ dimensions: ["QueueName"], types: ["aws_sqs_queue"] }],
  "AWS/SNS": [{ dimensions: ["TopicName"], types: ["aws_sns_topic"] }],
  "AWS/DynamoDB": [{ dimensions: ["TableName"], types: ["aws_dynamodb_table"] }],
  "AWS/ApiGateway": [
    {
      dimensions: ["ApiName", "ApiId"],
      types: ["aws_api_gateway_rest_api", "aws_apigatewayv2_api"],
    },
  ],
  "AWS/ApplicationELB": [
    {
      dimensions: ["LoadBalancer", "TargetGroup"],
      types: [
        "aws_lb",
        "aws_alb",
        "aws_lb_target_group",
        "aws_alb_target_group",
      ],
    },
  ],
  "AWS/NetworkELB": [
    {
      dimensions: ["LoadBalancer", "TargetGroup"],
      types: [
        "aws_lb",
        "aws_alb",
        "aws_lb_target_group",
        "aws_alb_target_group",
      ],
    },
  ],
  "AWS/RDS": [
    { dimensions: ["DBInstanceIdentifier"], types: ["aws_db_instance", "aws_rds_cluster"] },
  ],
  "AWS/ElastiCache": [
    {
      dimensions: ["CacheClusterId", "ReplicationGroupId"],
      types: ["aws_elasticache_cluster", "aws_elasticache_replication_group"],
    },
  ],
};

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

const getResourceType = (nodePath, node) =>
  getPrimaryResource(node)?.type || String(nodePath).split(".").at(-2) || "";

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
  const moduleBoundarySet = collectAllTerraformModulePaths(Object.keys(nodes));

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
    node.edges_data_flow ||= [];
  }
  return nodes;
}

function buildDataFlowIndex(nodes) {
  const index = {
    byAddress: new Map(),
    byArn: new Map(),
    byName: new Map(),
    byType: new Map(),
    roleToCompute: new Map(),
    policyToRoles: new Map(),
  };

  const addName = (type, name, nodePath) => {
    if (!type || !name) {
      return;
    }
    const key = `${type}:${name}`;
    if (!index.byName.has(key)) {
      index.byName.set(key, new Set());
    }
    index.byName.get(key).add(nodePath);
  };

  const addArn = (arn, nodePath) => {
    if (typeof arn === "string" && arn.startsWith("arn:")) {
      index.byArn.set(arn, nodePath);
    }
  };

  for (const [nodePath, node] of Object.entries(nodes)) {
    const type = getResourceType(nodePath, node);
    if (!index.byType.has(type)) {
      index.byType.set(type, new Set());
    }
    index.byType.get(type).add(nodePath);

    for (const resource of Object.values(node.resources || {})) {
      const values = getResourceValues(resource);
      index.byAddress.set(stripIndexes(resource.address || nodePath), nodePath);
      addName(resource.type || type, resource.name, nodePath);
      addName(resource.type || type, values.name, nodePath);
      addName(resource.type || type, values.id, nodePath);
      addName(resource.type || type, values.bucket, nodePath);
      addName(resource.type || type, values.function_name, nodePath);
      addName(resource.type || type, values.queue_name, nodePath);

      addArn(values.arn, nodePath);
      addArn(values.invoke_arn, nodePath);
      addArn(values.execution_arn, nodePath);
      addArn(values.stream_arn, nodePath);

      if ((resource.type || type) === "aws_s3_bucket") {
        const bucketName = values.bucket || values.id || resource.name;
        if (bucketName) {
          addArn(`arn:aws:s3:::${bucketName}`, nodePath);
          addArn(`arn:aws:s3:::${bucketName}/*`, nodePath);
        }
      }
    }
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    const type = getResourceType(nodePath, node);
    if (!COMPUTE_RESOURCE_TYPES.has(type)) {
      continue;
    }

    for (const resource of Object.values(node.resources || {})) {
      const values = getResourceValues(resource);
      for (const roleRef of [
        values.role,
        values.task_role_arn,
        values.iam_instance_profile,
      ]) {
        for (const roleNodePath of resolveNodeRefs(roleRef, index, nodes, [
          "aws_iam_role",
          "aws_iam_instance_profile",
        ])) {
          if (!index.roleToCompute.has(roleNodePath)) {
            index.roleToCompute.set(roleNodePath, new Set());
          }
          index.roleToCompute.get(roleNodePath).add(nodePath);
        }
      }
    }
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (getResourceType(nodePath, node) !== "aws_iam_role") {
      continue;
    }

    for (const target of [
      ...(node.edges_new || []),
      ...(node.edges_existing || []),
    ]) {
      if (!COMPUTE_RESOURCE_TYPES.has(getResourceType(target, nodes[target]))) {
        continue;
      }
      if (!index.roleToCompute.has(nodePath)) {
        index.roleToCompute.set(nodePath, new Set());
      }
      index.roleToCompute.get(nodePath).add(target);
    }
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    const type = getResourceType(nodePath, node);
    if (
      type !== "aws_iam_role_policy_attachment" &&
      type !== "aws_iam_policy_attachment"
    ) {
      continue;
    }

    for (const resource of Object.values(node.resources || {})) {
      const values = getResourceValues(resource);
      const policyNodes = resolveNodeRefs(values.policy_arn, index, nodes, [
        "aws_iam_policy",
      ]);
      const roleNodes = resolveNodeRefs(
        values.role || values.roles,
        index,
        nodes,
        ["aws_iam_role"],
      );

      for (const policyNodePath of policyNodes) {
        if (!index.policyToRoles.has(policyNodePath)) {
          index.policyToRoles.set(policyNodePath, new Set());
        }
        for (const roleNodePath of roleNodes) {
          index.policyToRoles.get(policyNodePath).add(roleNodePath);
        }
      }
    }
  }

  return index;
}

function resolveNodeRefs(value, index, nodes, allowedTypes) {
  const matches = new Set();
  const allowed = allowedTypes ? new Set(allowedTypes) : null;
  const addMatch = (nodePath) => {
    if (!nodePath || !nodes[nodePath]) {
      return;
    }
    if (allowed && !allowed.has(getResourceType(nodePath, nodes[nodePath]))) {
      return;
    }
    matches.add(nodePath);
  };

  for (const raw of flattenValues(value)) {
    const text = String(raw);
    const stripped = stripIndexes(text);

    addMatch(index.byAddress.get(stripped));
    addMatch(index.byArn.get(text));

    for (const [address, nodePath] of index.byAddress.entries()) {
      if (text.includes(address)) {
        addMatch(nodePath);
      }
    }

    for (const [arn, nodePath] of index.byArn.entries()) {
      if (text === arn || text.includes(arn)) {
        addMatch(nodePath);
      }
    }

    for (const type of allowed || DATA_FLOW_TARGET_TYPES) {
      const byName = index.byName.get(`${type}:${text}`);
      if (byName) {
        for (const nodePath of byName) {
          addMatch(nodePath);
        }
      }
    }
  }

  return [...matches];
}

function resolveCloudWatchAlarmWatchTargets(nodePath, node, index, nodes) {
  if (getResourceType(nodePath, node) !== "aws_cloudwatch_metric_alarm") {
    return [];
  }

  const targets = new Set();

  for (const resource of Object.values(node.resources || {})) {
    const values = getResourceValues(resource);
    const namespace = values.namespace;
    const dimensions = values.dimensions;
    if (!namespace || !isPlainObject(dimensions)) {
      continue;
    }

    const rules = CLOUDWATCH_ALARM_WATCH_RULES_BY_NAMESPACE[namespace];
    if (!rules) {
      continue;
    }

    for (const rule of rules) {
      for (const dim of rule.dimensions) {
        const raw = dimensions[dim];
        if (raw == null || raw === "") {
          continue;
        }
        for (const t of resolveNodeRefs(raw, index, nodes, rule.types)) {
          targets.add(t);
        }
      }
    }
  }

  return [...targets];
}

/**
 * Replaces DOT/state dependency fan-out for metric alarms with edges to the owning
 * module (when the watched resource lives in a module) or the root resource.
 * Runs after plan + state edges exist.
 */
function refineCloudWatchMetricAlarmEdges(nodes) {
  const index = buildDataFlowIndex(nodes);

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (getResourceType(nodePath, node) !== "aws_cloudwatch_metric_alarm") {
      continue;
    }

    const watchedResources = resolveCloudWatchAlarmWatchTargets(
      nodePath,
      node,
      index,
      nodes,
    );
    if (watchedResources.length === 0) {
      continue;
    }

    const targets = new Set();
    for (const resourcePath of watchedResources) {
      const modulePath = getTerraformOwningModulePath(resourcePath);
      if (modulePath && nodes[modulePath]) {
        targets.add(modulePath);
      } else if (nodes[resourcePath]) {
        targets.add(resourcePath);
      }
    }

    if (targets.size === 0) {
      continue;
    }

    const list = [...targets];
    node.edges_new = list;
    node.edges_existing = list;
  }

  return nodes;
}

function resolvePolicyTargets(resourceValue, index, nodes) {
  const normalized = normalizeArnPattern(resourceValue);
  if (!normalized || normalized === "*") {
    return [];
  }

  const matches = new Set();
  const direct = index.byArn.get(resourceValue) || index.byArn.get(normalized);
  if (direct) {
    matches.add(direct);
  }

  for (const [arn, nodePath] of index.byArn.entries()) {
    if (
      normalized === arn ||
      arn.startsWith(normalized) ||
      normalized.startsWith(arn)
    ) {
      if (
        DATA_FLOW_TARGET_TYPES.has(getResourceType(nodePath, nodes[nodePath]))
      ) {
        matches.add(nodePath);
      }
    }
  }

  return [...matches];
}

function buildDataFlowEdges(nodes) {
  const index = buildDataFlowIndex(nodes);
  const explicitKeys = new Set();
  const allKeys = new Set();

  const addEdge = (source, target, type, label, origin, detail) => {
    if (!nodes[source] || !nodes[target] || source === target) {
      return;
    }
    const key = `${source}|||${target}|||${type}`;
    if (allKeys.has(key)) {
      return;
    }
    allKeys.add(key);
    if (origin !== "iam_policy") {
      explicitKeys.add(`${source}|||${target}`);
    }
    nodes[source].edges_data_flow ||= [];
    nodes[source].edges_data_flow.push({ target, type, label, origin, detail });
  };

  for (const [nodePath, node] of Object.entries(nodes)) {
    for (const resource of Object.values(node.resources || {})) {
      const values = getResourceValues(resource);
      const type = resource.type || getResourceType(nodePath, node);

      if (type === "aws_lambda_event_source_mapping") {
        const sources = resolveNodeRefs(values.event_source_arn, index, nodes);
        const targets = resolveNodeRefs(values.function_name, index, nodes, [
          "aws_lambda_function",
        ]);
        for (const source of sources) {
          for (const target of targets) {
            addEdge(
              source,
              target,
              "triggers",
              "triggers",
              "terraform_resource",
              type,
            );
          }
        }
      }

      if (type === "aws_s3_bucket_notification") {
        const sources = resolveNodeRefs(values.bucket, index, nodes, [
          "aws_s3_bucket",
        ]);
        const targets = [
          ...resolveNodeRefs(values.lambda_function, index, nodes, [
            "aws_lambda_function",
          ]),
          ...resolveNodeRefs(values.queue, index, nodes, ["aws_sqs_queue"]),
          ...resolveNodeRefs(values.topic, index, nodes, ["aws_sns_topic"]),
        ];
        for (const source of sources) {
          for (const target of targets) {
            addEdge(
              source,
              target,
              "triggers",
              "triggers",
              "terraform_resource",
              type,
            );
          }
        }
      }

      if (
        type === "aws_cloudwatch_event_target" ||
        type === "aws_eventbridge_target" ||
        type === "aws_scheduler_schedule"
      ) {
        const sourceRefs =
          type === "aws_scheduler_schedule"
            ? nodePath
            : values.rule || values.event_bus_name;
        const sources = resolveNodeRefs(sourceRefs, index, nodes, [
          "aws_cloudwatch_event_rule",
          "aws_cloudwatch_event_bus",
          "aws_scheduler_schedule",
        ]);
        const targets = resolveNodeRefs(
          values.arn || values.target?.arn,
          index,
          nodes,
        );
        for (const source of sources.length ? sources : [nodePath]) {
          for (const target of targets) {
            addEdge(
              source,
              target,
              "triggers",
              "triggers",
              "terraform_resource",
              type,
            );
          }
        }
      }

      if (
        type === "aws_api_gateway_integration" ||
        type === "aws_apigatewayv2_integration"
      ) {
        const sources = resolveNodeRefs(
          values.rest_api_id || values.api_id,
          index,
          nodes,
          ["aws_api_gateway_rest_api", "aws_apigatewayv2_api"],
        );
        const targets = resolveNodeRefs(
          values.uri || values.integration_uri,
          index,
          nodes,
          ["aws_lambda_function"],
        );
        for (const source of sources.length ? sources : [nodePath]) {
          for (const target of targets) {
            addEdge(
              source,
              target,
              "invokes",
              "invokes",
              "terraform_resource",
              type,
            );
          }
        }
      }

      if (
        type === "aws_lb_listener" ||
        type === "aws_lb_listener_rule" ||
        type === "aws_alb_listener" ||
        type === "aws_alb_listener_rule"
      ) {
        const sources = resolveNodeRefs(
          values.load_balancer_arn || values.listener_arn,
          index,
          nodes,
        );
        const targets = resolveNodeRefs(
          values.default_action || values.action,
          index,
          nodes,
          ["aws_lb_target_group", "aws_alb_target_group"],
        );
        for (const source of sources.length ? sources : [nodePath]) {
          for (const target of targets) {
            addEdge(
              source,
              target,
              "routes",
              "routes",
              "terraform_resource",
              type,
            );
          }
        }
      }

      if (
        type === "aws_lb_target_group_attachment" ||
        type === "aws_alb_target_group_attachment"
      ) {
        const sources = resolveNodeRefs(values.target_group_arn, index, nodes, [
          "aws_lb_target_group",
          "aws_alb_target_group",
        ]);
        const targets = resolveNodeRefs(values.target_id, index, nodes);
        for (const source of sources) {
          for (const target of targets) {
            addEdge(
              source,
              target,
              "routes",
              "routes",
              "terraform_resource",
              type,
            );
          }
        }
      }
    }
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    for (const resource of Object.values(node.resources || {})) {
      const type = resource.type || getResourceType(nodePath, node);
      if (type !== "aws_iam_role_policy" && type !== "aws_iam_policy") {
        continue;
      }

      const values = getResourceValues(resource);
      const policy = parsePolicyDocument(values.policy);
      if (!policy) {
        continue;
      }

      const sourceRoles =
        type === "aws_iam_role_policy"
          ? resolveNodeRefs(values.role, index, nodes, ["aws_iam_role"])
          : [...(index.policyToRoles.get(nodePath) || [])];
      const sourceComputes = new Set();
      for (const role of sourceRoles) {
        for (const compute of index.roleToCompute.get(role) || []) {
          sourceComputes.add(compute);
        }
      }

      if (sourceComputes.size === 0) {
        continue;
      }

      for (const statement of normalizePolicyArray(policy.Statement)) {
        if (String(statement.Effect || "Allow").toLowerCase() === "deny") {
          continue;
        }
        for (const action of normalizePolicyArray(statement.Action)) {
          const relationship = dataFlowRelationshipForAction(action);
          if (!relationship) {
            continue;
          }
          for (const resourceValue of normalizePolicyArray(
            statement.Resource,
          )) {
            for (const target of resolvePolicyTargets(
              resourceValue,
              index,
              nodes,
            )) {
              for (const source of sourceComputes) {
                const edgeSource =
                  relationship.direction === "target_to_source"
                    ? target
                    : source;
                const edgeTarget =
                  relationship.direction === "target_to_source"
                    ? source
                    : target;

                if (explicitKeys.has(`${edgeSource}|||${edgeTarget}`)) {
                  continue;
                }
                addEdge(
                  edgeSource,
                  edgeTarget,
                  relationship.type,
                  relationship.label,
                  "iam_policy",
                  action,
                );
              }
            }
          }
        }
      }
    }
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
    const edges = [
      ...(node.edges_existing || []),
      ...(node.edges_new || []),
      ...(node.edges_data_flow || []).map((edge) => edge.target),
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
    node.edges_data_flow = (node.edges_data_flow || []).filter(
      (edge) => !ignored.has(edge.target),
    );
  }

  return nodes;
}

function cleanUpRoleLinks(nodes) {
  for (const [nodePath, node] of Object.entries(nodes)) {
    node.edges_existing ||= [];
    node.edges_new ||= [];
    node.edges_data_flow ||= [];

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
  buildDataFlowEdges,
  externalResources,
  deleteOrphanedNodes,
  filterVisualIgnore,
  cleanUpRoleLinks,
  refineCloudWatchMetricAlarmEdges,
  getTerraformOwningModulePath,
};
