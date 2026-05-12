/**
 * Terraform semantic data-flow edges (`edges_data_flow`).
 * Used by `pipeline.js` (upload). Browser local import uses the TypeScript port:
 * `packages/excalidraw/components/terraformDataFlowEdges.ts` — keep behavior aligned.
 */
const { isPlainObject } = require("./terraform-graph-utils");

const stripIndexes = (address = "") => address.replace(/\[[^\]]+\]/g, "");

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
  "aws_security_group",
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
  /** Lambda env keys like `DATA_BUCKET` → only the bucket resource, not encryption/versioning/PAB siblings. */
  data_bucket: ["aws_s3_bucket"],
  /** Lambda env keys like `DATA_QUEUE_URL` → queue node only. */
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

/** Registers a Terraform address key (full or index-stripped) → node path in the data-flow index. */
function addToAddressIndex(index, key, nodePath) {
  if (!key || !nodePath) {
    return;
  }
  if (!index.byAddress.has(key)) {
    index.byAddress.set(key, new Set());
  }
  index.byAddress.get(key).add(nodePath);
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

/** Matches AWS EC2 security group identifiers (classic 8-hex and longer VPC-style IDs). */
const AWS_SECURITY_GROUP_ID_RE = /^sg-[0-9a-f]{8,17}$/i;

function registerAwsSecurityGroupIdIndex(index, sgId, nodePath) {
  if (typeof sgId !== "string") {
    return;
  }
  const id = sgId.trim();
  if (!AWS_SECURITY_GROUP_ID_RE.test(id)) {
    return;
  }
  if (!index.bySecurityGroupId.has(id)) {
    index.bySecurityGroupId.set(id, new Set());
  }
  index.bySecurityGroupId.get(id).add(nodePath);
}

/** Collects peer-reference payloads from inline ingress/egress rule blocks (module-specific keys included). */
function collectSecurityGroupRulePeerRefs(rule) {
  if (!rule || typeof rule !== "object") {
    return [];
  }
  const out = [
    rule.security_groups,
    rule.source_security_group_id,
    rule.referenced_security_group_id,
    rule.destination_security_group_id,
  ].filter((x) => x != null);
  for (const [key, val] of Object.entries(rule)) {
    if (
      typeof key === "string" &&
      val != null &&
      /security_group|referenced_sg|source_sg|destination_sg|peer/i.test(key) &&
      !/^type$/i.test(key)
    ) {
      out.push(val);
    }
  }
  return out;
}

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

function buildDataFlowIndex(nodes) {
  const index = {
    byAddress: new Map(),
    byArn: new Map(),
    byName: new Map(),
    byType: new Map(),
    /** sg-abc → Terraform addresses for `aws_security_group` (speeds rule / endpoint resolution). */
    bySecurityGroupId: new Map(),
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
    if (nodePath.startsWith("__")) {
      continue;
    }
    const type = getResourceType(nodePath, node);
    if (!index.byType.has(type)) {
      index.byType.set(type, new Set());
    }
    index.byType.get(type).add(nodePath);

    for (const resource of Object.values(node.resources || {})) {
      const values = getResourceValues(resource);
      const addr = resource.address || nodePath;
      addToAddressIndex(index, stripIndexes(addr), nodePath);
      addToAddressIndex(index, addr, nodePath);
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

      const resourceType = resource.type || type;
      if (resourceType === "aws_security_group") {
        registerAwsSecurityGroupIdIndex(index, values.id, nodePath);
        if (typeof values.arn === "string") {
          const fromArn = values.arn.match(
            /security-group\/(sg-[0-9a-f]{8,17})/i,
          );
          if (fromArn) {
            registerAwsSecurityGroupIdIndex(index, fromArn[1], nodePath);
          }
        }
      }
    }
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
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
    if (nodePath.startsWith("__")) {
      continue;
    }
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
    if (nodePath.startsWith("__")) {
      continue;
    }
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

/** Resolves a Terraform reference value (string/ARN/interpolation) to matching node paths using `index`. */
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
    const trimmed = text.trim();
    const stripped = stripIndexes(text);

    if (
      allowed &&
      allowed.has("aws_security_group") &&
      index.bySecurityGroupId.has(trimmed)
    ) {
      for (const nodePath of index.bySecurityGroupId.get(trimmed)) {
        addMatch(nodePath);
      }
    }

    for (const nodePath of index.byAddress.get(stripped) || []) {
      addMatch(nodePath);
    }
    for (const nodePath of index.byAddress.get(text) || []) {
      addMatch(nodePath);
    }
    addMatch(index.byArn.get(text));

    for (const [address, nodePaths] of index.byAddress.entries()) {
      if (text.includes(address)) {
        for (const nodePath of nodePaths) {
          addMatch(nodePath);
        }
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

/** Collects scalar references while preserving the nearest parent object key. */
function collectReferenceScalars(value, parentKey = "", out = []) {
  if (typeof value === "string") {
    out.push({ value, key: parentKey });
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferenceScalars(item, parentKey, out);
    }
    return out;
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      collectReferenceScalars(v, k, out);
    }
  }
  return out;
}

/** Resolves references with key-aware type narrowing and generic fallback. */
function resolveNodeRefsAcrossAllResourceTypes(
  value,
  index,
  nodes,
  options = {},
) {
  const matches = new Set();
  const allTypes = [...index.byType.keys()];
  const ignoredKeys = new Set(
    options.ignoredKeys || GENERIC_REFERENCE_IGNORED_KEYS,
  );

  for (const scalar of collectReferenceScalars(value)) {
    const key = String(scalar.key || "").toLowerCase();
    if (ignoredKeys.has(key)) {
      continue;
    }
    const allowedTypes = REFERENCE_KEY_TYPE_RULES[key] || allTypes;
    for (const nodePath of resolveNodeRefs(
      scalar.value,
      index,
      nodes,
      allowedTypes,
    )) {
      matches.add(nodePath);
    }
  }

  return [...matches];
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
          node.edges_new = [
            ...new Set([...(node.edges_new || []), ...targets]),
          ];
          node.edges_existing = [
            ...new Set([...(node.edges_existing || []), ...targets]),
          ];
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
  const defaultResolvers = [
    createGenericResourceReferenceResolver(options),
  ].filter((resolver) => !disabled.has(resolver.id));
  return refineEdgesWithResolvers(nodes, [
    ...customResolvers,
    ...defaultResolvers,
  ]);
}

/**
 * Backward-compatible alias for legacy call sites/tests.
 * Name kept for historical reasons; behavior is generic, not alarm-specific.
 */
function refineCloudWatchMetricAlarmEdges(nodes, options = {}) {
  return detectGenericStructuralEdges(nodes, options);
}

/** Maps an IAM policy Resource ARN/string to data-flow target nodes (S3, SQS, etc.) using ARN index heuristics. */
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

const getExpressionReferences = (expression) =>
  Array.isArray(expression?.references) ? expression.references : [];

const withoutAttributeSuffix = (reference = "") => {
  const stripped = stripIndexes(String(reference));
  const parts = stripped.split(".");
  const dataIndex = parts.indexOf("data");
  let resourceStart = dataIndex === -1 ? 0 : dataIndex + 1;

  while (parts[resourceStart] === "module" && parts[resourceStart + 1]) {
    resourceStart += 2;
  }

  if (parts.length > resourceStart + 2) {
    return parts.slice(0, resourceStart + 2).join(".");
  }
  return stripped;
};

function resolveModuleOutputReference(reference, nodes, seen = new Set()) {
  const ref = stripIndexes(String(reference));
  if (!ref || seen.has(ref)) {
    return [];
  }
  seen.add(ref);

  const directMatches = new Set();
  for (const candidate of [ref, withoutAttributeSuffix(ref)]) {
    for (const nodePath of nodes.__dataFlowIndex?.byAddress?.get(candidate) ||
      []) {
      if (
        DATA_FLOW_TARGET_TYPES.has(getResourceType(nodePath, nodes[nodePath]))
      ) {
        directMatches.add(nodePath);
      }
    }
  }
  if (directMatches.size > 0) {
    return [...directMatches];
  }

  const parts = ref.split(".");
  const modulePath = parts.slice(0, -1).join(".");
  const outputName = parts.at(-1);
  const output = nodes[modulePath]?.terraform_config?.outputs?.[outputName];
  const outputRefs = getExpressionReferences(output?.expression);
  if (outputRefs.length) {
    const matches = new Set();
    for (const outputRef of outputRefs) {
      const absoluteRef = `${modulePath}.${outputRef}`;
      for (const target of resolveModuleOutputReference(
        absoluteRef,
        nodes,
        seen,
      )) {
        matches.add(target);
      }
    }
    return [...matches];
  }

  return [];
}

function collectDescendantNodesByType(nodes, modulePath, types) {
  const allowed = new Set(types);
  return Object.keys(nodes).filter(
    (nodePath) =>
      nodePath.startsWith(`${modulePath}.`) &&
      allowed.has(getResourceType(nodePath, nodes[nodePath])),
  );
}

/**
 * Adds `edges_data_flow` from integrations, notifications, IAM policy statements, etc.,
 * using `buildDataFlowIndex` for cross-reference resolution.
 */
function buildDataFlowEdges(nodes) {
  const index = buildDataFlowIndex(nodes);
  nodes.__dataFlowIndex = index;
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
    nodes[source].edges_data_flow ||= [];
    nodes[source].edges_data_flow.push({ target, type, label, origin, detail });
  };

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
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

  delete nodes.__dataFlowIndex;

  return nodes;
}

function buildNetworkingEdges(nodes) {
  const index = buildDataFlowIndex(nodes);
  nodes.__dataFlowIndex = index;
  const allKeys = new Set();

  const addNetEdge = (source, target, type, label, origin, detail) => {
    if (!nodes[source] || !nodes[target] || source === target) {
      return;
    }
    const key = `${source}|||${target}|||${type}`;
    if (allKeys.has(key)) {
      return;
    }
    allKeys.add(key);
    nodes[source].edges_networking ||= [];
    nodes[source].edges_networking.push({
      target,
      type,
      label,
      origin,
      detail,
    });
  };

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    for (const resource of Object.values(node.resources || {})) {
      const values = getResourceValues(resource);
      const type = resource.type || getResourceType(nodePath, node);

      if (type === "aws_security_group") {
        for (const direction of ["ingress", "egress"]) {
          const raw = values[direction];
          const rules = Array.isArray(raw) ? raw : raw ? [raw] : [];
          for (const rule of rules) {
            if (!rule || typeof rule !== "object") {
              continue;
            }
            const peerRefs = collectSecurityGroupRulePeerRefs(rule);
            for (const pr of peerRefs) {
              for (const peer of resolveNodeRefs(pr, index, nodes, [
                "aws_security_group",
              ])) {
                if (peer !== nodePath) {
                  addNetEdge(
                    nodePath,
                    peer,
                    "peer_rule",
                    "SG rule",
                    "security_group_rule",
                    direction,
                  );
                }
              }
            }
          }
        }
      }

      if (
        type === "aws_vpc_security_group_ingress_rule" ||
        type === "aws_vpc_security_group_egress_rule" ||
        type === "aws_security_group_rule"
      ) {
        const owners = resolveNodeRefs(values.security_group_id, index, nodes, [
          "aws_security_group",
        ]);
        const peerPool = [
          values.referenced_security_group_id,
          values.source_security_group_id,
          values.destination_security_group_id,
        ];
        const peers = new Set();
        for (const pr of peerPool) {
          for (const p of resolveNodeRefs(pr, index, nodes, [
            "aws_security_group",
          ])) {
            peers.add(p);
          }
        }
        const ownersArr = owners;
        const peersArr = [...peers];
        for (const owner of ownersArr) {
          for (const peer of peersArr) {
            if (owner !== peer) {
              addNetEdge(
                owner,
                peer,
                "peer_rule",
                "SG rule",
                "security_group_rule",
                type,
              );
            }
          }
        }
      }

      if (type === "aws_vpc_endpoint") {
        const svc =
          typeof values.service_name === "string" ? values.service_name : "";
        for (const ref of [
          values.security_group_ids,
          values.security_group_id,
        ]) {
          for (const sg of resolveNodeRefs(ref, index, nodes, [
            "aws_security_group",
          ])) {
            addNetEdge(
              nodePath,
              sg,
              "endpoint_attachment",
              "VPC endpoint SG",
              "vpc_endpoint_security_group",
              svc,
            );
          }
        }
      }
    }
  }

  delete nodes.__dataFlowIndex;

  return nodes;
}

module.exports = {
  buildDataFlowEdges,
  buildNetworkingEdges,
  buildDataFlowIndex,
  resolveNodeRefsAcrossAllResourceTypes,
};
