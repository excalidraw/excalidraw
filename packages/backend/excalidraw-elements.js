/**
 * Terraform graph → Excalidraw: icons, tiers, labels, location/VPC inference, module grouping,
 * container facets, and base element factories (`makeBaseElement`).
 *
 * Used by `excalidraw-layout.js` (lerp, module path helpers) and the orchestrator `excalidraw.js`.
 */
const fs = require("fs");
const path = require("path");

const {
  isPlainObject,
  getCurrentResourceConfig,
  normalizeVpcId,
  normalizeSubnetId,
  extractVpcIdsFromConfig,
  extractSubnetIdsFromConfig,
} = require("./terraform-graph-utils");

const TERRAFORM_AWS_ICON_TYPE_NAMES = require(path.join(
  __dirname,
  "../excalidraw/assets/terraform-aws-icon-type-names.json",
));

/** Integer in [0, 2^31) for stable-enough unique Excalidraw element ids in one export. */
function rand() {
  return Math.floor(Math.random() * 2147483647);
}

// --- Icon library (AWS Architecture Icons .excalidrawlib) ---

const DEFAULT_ICON_LIBRARY = "aws-architecture-icons";

const ICON_LIBRARY_CONFIGS = {
  "aws-architecture-icons": {
    filename: path.join(
      __dirname,
      "../excalidraw/assets/aws-architecture-icons.excalidrawlib",
    ),
    names: TERRAFORM_AWS_ICON_TYPE_NAMES,
  },
};

/** Maps env or basename to a key in `ICON_LIBRARY_CONFIGS`. */
function normalizeIconLibraryName(value) {
  if (!value) {
    return DEFAULT_ICON_LIBRARY;
  }

  return path.basename(value, ".excalidrawlib");
}

/** Resolved icon library descriptor (filename + name map), from env or default. */
function getIconLibraryConfig() {
  const requested = normalizeIconLibraryName(
    process.env.AWS_ICON_LIBRARY || process.env.AWS_ICON_LIB,
  );

  return (
    ICON_LIBRARY_CONFIGS[requested] ||
    ICON_LIBRARY_CONFIGS[DEFAULT_ICON_LIBRARY]
  );
}

/** Absolute path to the `.excalidrawlib` on disk (env override or bundled next to this file). */
function getIconLibraryPath(config) {
  if (process.env.AWS_ICON_LIB_PATH) {
    return path.resolve(process.env.AWS_ICON_LIB_PATH);
  }

  return path.join(__dirname, config.filename);
}

let iconLibItems = null;
let iconLibCacheKey = null;
let iconLibNameIndex = {};
/** Loads and caches the icon library JSON; builds a lowercase name → index map. */
function loadIconLib() {
  const config = getIconLibraryConfig();
  const iconLibPath = getIconLibraryPath(config);
  const cacheKey = `${config.filename}:${iconLibPath}`;
  if (iconLibItems && iconLibCacheKey === cacheKey) {
    return iconLibItems;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(iconLibPath, "utf-8"));
    // v1 format: library is array of element arrays
    // v2 format: libraryItems is array of { elements, name }
    iconLibItems = raw.libraryItems || raw.library || [];
    iconLibNameIndex = Object.fromEntries(
      iconLibItems
        .map((item, index) => [item?.name?.toLowerCase(), index])
        .filter(([name]) => Boolean(name)),
    );
    iconLibCacheKey = cacheKey;
    return iconLibItems;
  } catch {
    iconLibItems = [];
    iconLibNameIndex = {};
    iconLibCacheKey = cacheKey;
    return iconLibItems;
  }
}

/** Returns cloned icon template elements for a Terraform AWS type, or null if missing. */
function getIconForType(resourceType) {
  const items = loadIconLib();
  const config = getIconLibraryConfig();
  const iconName = config.names?.[resourceType];
  const idx =
    config.index?.[resourceType] ??
    (iconName ? iconLibNameIndex[iconName.toLowerCase()] : undefined);
  if (idx === undefined || idx >= items.length) {
    return null;
  }
  const item = items[idx];
  // v1: item is element array; v2: item.elements
  return Array.isArray(item) ? item : item.elements || null;
}

/** Deep-clones library icon elements, shifted/scaled into a target box and optionally grouped. */
function cloneIconElements(
  origElements,
  targetX,
  targetY,
  targetSize,
  parentGroupIds = [],
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of origElements) {
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + (e.width || 0));
    maxY = Math.max(maxY, e.y + (e.height || 0));
  }
  const origW = maxX - minX || 1;
  const origH = maxY - minY || 1;
  const scale = Math.min(targetSize / origW, targetSize / origH);

  // Offset to center the icon in the target area
  const scaledW = origW * scale;
  const scaledH = origH * scale;
  const offsetX = targetX + (targetSize - scaledW) / 2;
  const offsetY = targetY + (targetSize - scaledH) / 2;

  // Remap internal group IDs to avoid conflicts across icon instances
  const groupIdMap = {};
  for (const e of origElements) {
    for (const gid of e.groupIds || []) {
      if (!groupIdMap[gid]) {
        groupIdMap[gid] = `icg-${rand()}`;
      }
    }
  }

  const outerGroupId = `ico-${rand()}`;

  return origElements.map((e) => {
    const cloned = {
      ...e,
      id: `ic-${rand()}`,
      x: (e.x - minX) * scale + offsetX,
      y: (e.y - minY) * scale + offsetY,
      width: (e.width || 0) * scale,
      height: (e.height || 0) * scale,
      seed: rand(),
      versionNonce: rand(),
      groupIds: [
        ...parentGroupIds,
        outerGroupId,
        ...(e.groupIds || []).map((gid) => groupIdMap[gid]),
      ],
      boundElements: null,
      containerId: null,
      updated: Date.now(),
      frameId: null,
      link: null,
      locked: false,
      isDeleted: false,
    };
    if (typeof e.fontSize === "number") {
      cloned.fontSize = Math.max(1, e.fontSize * scale);
    }
    if (typeof e.strokeWidth === "number") {
      cloned.strokeWidth = Math.max(1, e.strokeWidth * scale);
    }
    if (e.points) {
      cloned.points = e.points.map(([px, py]) => [px * scale, py * scale]);
    }
    return cloned;
  });
}

// --- Tier system ---

const TIER_1_TYPES = new Set([
  "aws_lambda_function",
  "aws_s3_bucket",
  "aws_sqs_queue",
  "aws_sns_topic",
  "aws_dynamodb_table",
  "aws_api_gateway_rest_api",
  "aws_apigatewayv2_api",
  "aws_ec2_instance",
  "aws_rds_instance",
  "aws_rds_cluster",
  "aws_ecs_service",
  "aws_ecs_cluster",
  "aws_ecs_task_definition",
  "aws_kinesis_stream",
  "aws_kinesis_firehose_delivery_stream",
  "aws_elasticache_cluster",
  "aws_vpc",
  "aws_subnet",
  "aws_security_group",
  "aws_lb",
  "aws_alb",
  "aws_cloudfront_distribution",
  "aws_route53_zone",
  "aws_sfn_state_machine",
  "aws_step_functions_state_machine",
  "aws_secretsmanager_secret",
  "aws_ssm_parameter",
  "aws_cognito_user_pool",
  "aws_eks_cluster",
  "aws_elasticsearch_domain",
  "aws_opensearch_domain",
  "aws_redshift_cluster",
  "aws_msk_cluster",
  "aws_batch_job_definition",
  "aws_batch_compute_environment",
]);

const TIER_3_TYPES = new Set([
  "null_resource",
  "local_file",
  "random_id",
  "random_string",
  "random_password",
  "archive_file",
  "template_file",
  "terraform_remote_state",
]);

const PRIMARY_COMPUTE_TYPES = new Set([
  "aws_lambda_function",
  "aws_ecs_cluster",
  "aws_ecs_service",
  "aws_ecs_task_definition",
  "aws_instance",
  "aws_ec2_instance_state",
  "aws_emr_cluster",
  "aws_glue_job",
  "aws_glue_crawler",
  "aws_batch_compute_environment",
  "aws_batch_job_definition",
  "aws_eks_cluster",
]);

const PRIMARY_STORAGE_TYPES = new Set([
  "aws_s3_bucket",
  "aws_s3_object",
  "aws_s3_bucket_object",
  "aws_dynamodb_table",
  "aws_rds_cluster",
  "aws_rds_cluster_instance",
  "aws_db_instance",
  "aws_efs_file_system",
  "aws_elasticache_cluster",
  "aws_elasticache_replication_group",
  "aws_redshift_cluster",
  "aws_opensearch_domain",
  "aws_elasticsearch_domain",
]);

const PRIMARY_MESSAGING_TYPES = new Set([
  "aws_sqs_queue",
  "aws_sns_topic",
  "aws_kinesis_stream",
  "aws_kinesis_firehose_delivery_stream",
  "aws_cloudwatch_event_bus",
  "aws_cloudwatch_event_rule",
  "aws_scheduler_schedule",
  "aws_msk_cluster",
]);

const PRIMARY_SPARK_TYPES = new Set();

const PRIMARY_CRYPTO_TYPES = new Set(["aws_kms_key"]);

/** Synthetic Terraform module call nodes (pipeline injects for graph semantics). */
const PRIMARY_MODULE_TYPES = new Set(["terraform_module"]);

const PRIMARY_VISIBLE_TYPES = new Set([
  ...PRIMARY_COMPUTE_TYPES,
  ...PRIMARY_STORAGE_TYPES,
  ...PRIMARY_MESSAGING_TYPES,
  ...PRIMARY_SPARK_TYPES,
  ...PRIMARY_CRYPTO_TYPES,
  ...PRIMARY_MODULE_TYPES,
]);

/** True for resource types shown in the default “overview” (compute/storage/messaging/module). */
function isPrimaryVisibleResourceType(resourceType) {
  return PRIMARY_VISIBLE_TYPES.has(resourceType);
}

function isChangedTerraformAction(action) {
  return (
    action === "create" ||
    action === "update" ||
    action === "delete" ||
    action === "replace"
  );
}

function isInitiallyVisibleTerraformNode(nodePath, node) {
  return (
    isPrimaryVisibleResourceType(getResourceType(nodePath)) ||
    isChangedTerraformAction(getPrimaryAction(node || {}))
  );
}

/** Terraform provider type segment parsed from `nodePath` (handles `module.*` prefixes and `data`). */
function getResourceType(nodePath) {
  const parts = nodePath.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  // Address is only module prefixes, e.g. module.a.module.b (no resource type segment).
  if (i >= parts.length) {
    return "terraform_module";
  }
  if (parts[i] === "data") {
    return "data";
  }
  return parts[i] || nodePath;
}

/** Counts `module.X` segments in the address (nesting depth). */
function getModuleDepth(nodePath) {
  const parts = nodePath.split(".");
  let depth = 0;
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    depth++;
    i += 2;
  }
  return depth;
}

/** Tier-1 types get larger / more prominent layout treatment. */
function isImportantType(resourceType) {
  return TIER_1_TYPES.has(resourceType);
}

/** Types that should visually recede (generic `data` reads, tier-3 noise). */
function isLowPriorityType(resourceType) {
  return resourceType === "data" || TIER_3_TYPES.has(resourceType);
}

/**
 * Maps each node key to a layout tier (0 = most prominent). Starts from module depth;
 * important types move up, low-priority types move down.
 */
function buildTierMap(nodeKeys) {
  const depths = nodeKeys.map(getModuleDepth);
  const maxDepth = Math.max(0, ...depths);

  const tierMap = {};
  for (const key of nodeKeys) {
    const depth = getModuleDepth(key);
    const type = getResourceType(key);
    let tier = depth; // base tier = nesting depth
    if (isLowPriorityType(type)) {
      tier = Math.min(tier + 1, maxDepth + 1);
    } else if (isImportantType(type)) {
      tier = Math.max(tier - 1, 0);
    }
    tierMap[key] = tier;
  }
  return tierMap;
}

/**
 * Per-tier width/height, font, d3 charge/collide, and icon size derived from `tierMap` spread.
 * Larger graphs scale dimensions down (`crowdFactor`).
 */
function buildTierConfigs(tierMap, totalNodes) {
  const tiers = Object.values(tierMap);
  const minTier = Math.min(...tiers);
  const maxTier = Math.max(...tiers);
  const range = maxTier - minTier || 1;

  // Scale down sizes for large graphs
  const crowdFactor = Math.max(0.5, 1 - (totalNodes - 20) / 200);

  const configs = {};
  for (let t = minTier; t <= maxTier; t++) {
    const frac = (t - minTier) / range; // 0 = most prominent, 1 = least
    const nodeScale = 1.25;
    configs[t] = {
      w: Math.round(lerp(300, 180, frac) * crowdFactor * nodeScale),
      h: Math.round(lerp(100, 50, frac) * crowdFactor * nodeScale),
      fontSize: Math.round(lerp(16, 10, frac) * 1.08),
      charge: Math.round(lerp(-3000, -400, frac) * crowdFactor),
      collide: Math.round(lerp(210, 100, frac) * crowdFactor * nodeScale),
      strokeWidth: frac < 0.33 ? 3 : frac < 0.66 ? 2 : 1,
      iconSize: Math.max(28, Math.round(lerp(72, 36, frac) * crowdFactor)),
    };
  }
  return configs;
}

/** Linear interpolation helper for tier sizing. */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --- Styling ---

const ACTION_COLORS = {
  create: "#d3f9d8",
  delete: "#ffe3e3",
  update: "#fff3bf",
  replace: "#ffe8cc",
  "no-op": "#e7f5ff",
  existing: "#f8f9fa",
  read: "#f8f9fa",
  external: "#f8f9fa",
};

const ACTION_STROKE = {
  create: "#2b8a3e",
  delete: "#c92a2a",
  update: "#e67700",
  replace: "#f08c00",
  "no-op": "#1971c2",
  existing: "#868e96",
  read: "#868e96",
  external: "#868e96",
};

const UNKNOWN_VALUE_PLACEHOLDER = "Known after apply";

const HIDDEN_ATTRIBUTES_BY_TYPE = {
  aws_iam_role_policy: new Set(["id", "name_prefix"]),
};

/** Dominant plan action across resources on a node (`create` wins over `update`, etc.). */
function getPrimaryAction(node) {
  const actions = new Set();
  const pushAction = (action) => {
    if (typeof action === "string" && action) {
      actions.add(action);
    }
  };
  if (Array.isArray(node?.change?.actions)) {
    for (const action of node.change.actions) {
      pushAction(action);
    }
  } else {
    pushAction(node?.change?.actions);
  }
  for (const resource of Object.values(node.resources || {})) {
    const resourceActions = resource.change?.actions;
    if (Array.isArray(resourceActions)) {
      for (const action of resourceActions) {
        pushAction(action);
      }
    } else {
      pushAction(resourceActions);
    }
  }
  if (actions.has("delete") && actions.has("create")) {
    return "replace";
  }
  if (actions.has("create")) {
    return "create";
  }
  if (actions.has("delete")) {
    return "delete";
  }
  if (actions.has("update")) {
    return "update";
  }
  if (actions.has("no-op")) {
    return "no-op";
  }
  if (actions.has("read")) {
    return "read";
  }
  if (actions.has("external")) {
    return "external";
  }
  return "existing";
}

/** False for null/empty/empty-object values so attribute panels stay readable. */
function isDisplayableConfigValue(value) {
  return (
    value !== null &&
    typeof value !== "undefined" &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0) &&
    !(isPlainObject(value) && Object.keys(value).length === 0)
  );
}

/** True when Terraform marked a subtree as unknown-after-apply (recursive). */
function hasUnknownAfterMarker(value) {
  if (value === true) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasUnknownAfterMarker(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => hasUnknownAfterMarker(entry));
  }

  return false;
}

/** Top-level attribute keys flagged unknown in `after_unknown`. */
function getUnknownTopLevelKeys(afterUnknown) {
  if (!afterUnknown || typeof afterUnknown !== "object") {
    return [];
  }

  return Object.entries(afterUnknown)
    .filter(([, marker]) => hasUnknownAfterMarker(marker))
    .map(([key]) => key);
}

/** Whether to omit an attribute from the details payload for a given resource type. */
function shouldHideTerraformAttribute(resourceType, key) {
  const hidden = HIDDEN_ATTRIBUTES_BY_TYPE[resourceType];
  return Boolean(hidden && hidden.has(key));
}

/** Per-resource attribute rows (values, diffs, unknown-after) stored on Excalidraw `customData`. */
function buildTerraformResourceDetails(node) {
  return Object.entries(node.resources || {}).map(([address, resource]) => {
    const change = resource.change || {};
    const config = getCurrentResourceConfig(resource);
    const diff = change.diff || {};
    const resourceType = resource.type || getResourceType(address);
    const unknownAfterKeys = getUnknownTopLevelKeys(change.after_unknown || {});
    const unknownAfterSet = new Set(unknownAfterKeys);
    const keys = new Set([
      ...Object.keys(config),
      ...Object.keys(diff),
      ...unknownAfterKeys,
    ]);

    const attributes = [...keys]
      .filter((key) => {
        if (shouldHideTerraformAttribute(resourceType, key)) {
          return false;
        }

        return (
          isDisplayableConfigValue(config[key]) ||
          Boolean(diff[key]) ||
          unknownAfterSet.has(key)
        );
      })
      .sort((a, b) => {
        const aUnknown = unknownAfterSet.has(a) ? 0 : 1;
        const bUnknown = unknownAfterSet.has(b) ? 0 : 1;
        if (aUnknown !== bUnknown) {
          return aUnknown - bUnknown;
        }

        const aChanged = diff[a] ? 0 : 1;
        const bChanged = diff[b] ? 0 : 1;
        return aChanged - bChanged || a.localeCompare(b);
      })
      .map((key) => {
        const fieldDiff = diff[key];
        const unknownAfter = unknownAfterSet.has(key);
        return {
          key,
          value: Object.prototype.hasOwnProperty.call(config, key)
            ? config[key]
            : unknownAfter
            ? UNKNOWN_VALUE_PLACEHOLDER
            : fieldDiff?.after ?? null,
          changed: Boolean(fieldDiff),
          unknownAfter,
          before: fieldDiff?.before,
          after: fieldDiff?.after,
        };
      });

    return {
      address: resource.address || address,
      type: resourceType,
      name: resource.name || "",
      mode: resource.mode || "",
      actions: change.actions || [],
      attributes,
    };
  });
}

/** Multi-line card label: dotted module path then resource tail. */
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

/** Ordered `module.a`, `module.a.module.b`, … prefixes for a resource address. */
function getModulePathChain(nodePath) {
  const parts = nodePath.split(".");
  const chain = [];
  let cursor = "";

  for (let i = 0; i < parts.length - 1; ) {
    if (parts[i] !== "module" || !parts[i + 1]) {
      break;
    }
    const segment = `module.${parts[i + 1]}`;
    cursor = cursor ? `${cursor}.${segment}` : segment;
    chain.push(cursor);
    i += 2;
  }

  return chain;
}

/** Number of nested module segments in a standalone module path string. */
function getModuleDepthFromPath(modulePath) {
  const parts = modulePath.split(".");
  let depth = 0;

  for (let i = 0; i < parts.length - 1; ) {
    if (parts[i] === "module" && parts[i + 1]) {
      depth += 1;
      i += 2;
      continue;
    }
    break;
  }

  return depth;
}

/** Human-readable module path: `child / grandchild` from repeated `module.X` segments. */
function getModuleDisplayLabel(modulePath) {
  const parts = modulePath.split(".");
  const names = [];

  for (let i = 0; i < parts.length - 1; ) {
    if (parts[i] === "module" && parts[i + 1]) {
      names.push(parts[i + 1]);
      i += 2;
      continue;
    }
    break;
  }

  return names.join(" / ");
}

/** Deepest module prefix for a resource address, or null in the root module. */
function getOwningModulePath(nodePath) {
  const chain = getModulePathChain(nodePath);
  return chain.length ? chain[chain.length - 1] : null;
}

/** Resource address with `modulePath.` prefix removed (relative resource tail). */
function getModuleRelativeResourcePath(nodePath, modulePath) {
  const prefix = `${modulePath}.`;
  if (!nodePath.startsWith(prefix)) {
    return nodePath;
  }
  return nodePath.slice(prefix.length);
}

/**
 * Strip Terraform instance indexes (`[0]`, `["x"]`) so indexed module resources match preset keys.
 * Same rule as `stripIndexes` in pipeline.js (DOT/plan id reconciliation).
 */
function stripTerraformInstanceIndexes(address = "") {
  return String(address).replace(/\[[^\]]+\]/g, "");
}

// Preset layout for terraform-aws-modules/lambda/aws inferred from resource set.
// Offsets are relative to the module's aws_lambda_function.this position.
const LAMBDA_MODULE_SOURCE = "terraform-aws-modules/lambda/aws";
const LAMBDA_MODULE_PRESET_OFFSETS = {
  "aws_lambda_function.this": { x: 0, y: 0 },
  "aws_iam_role.lambda": { x: -360, y: 0 },
  "aws_iam_role_policy.logs": { x: -360, y: -170 },
  "aws_iam_role_policy.additional_inline": { x: -360, y: 170 },
  "aws_cloudwatch_log_group.lambda": { x: 300, y: -170 },
  "terraform_data.package_filename_for_hash": { x: 300, y: 170 },
  "data.aws_iam_policy_document.logs": { x: -620, y: -170 },
  "data.aws_iam_policy_document.additional_inline": { x: -620, y: 170 },
  "data.aws_iam_policy_document.assume_role": { x: -620, y: 0 },
  "data.aws_partition.current": { x: 620, y: -130 },
  "data.aws_region.current": { x: 620, y: 0 },
  "data.aws_caller_identity.current": { x: 620, y: 130 },
};

/** True when module metadata source matches the official Lambda module registry string. */
function isLambdaModuleSource(source) {
  return source === LAMBDA_MODULE_SOURCE;
}

/** Heuristic: registry Lambda module vs typical `this` + `aws_iam_role.lambda` fragment set. */
function isLikelyLambdaModule(resourceFragments, moduleGroup = null) {
  if (isLambdaModuleSource(moduleGroup?.source)) {
    return true;
  }
  const stripped = new Set(
    [...resourceFragments].map((f) => stripTerraformInstanceIndexes(f)),
  );
  return (
    stripped.has("aws_lambda_function.this") &&
    stripped.has("aws_iam_role.lambda")
  );
}

/** Nudges known Lambda-module child resources to fixed offsets around `aws_lambda_function.this`. */
function applyModulePresets(
  positions,
  nodeKeys,
  moduleGroupByPath = new Map(),
  options = {},
) {
  const moduleMembers = new Map();
  const skipModulePaths = options.skipModulePaths || new Set();

  for (const nodePath of nodeKeys) {
    const modulePath = getOwningModulePath(nodePath);
    if (!modulePath) {
      continue;
    }
    if (!moduleMembers.has(modulePath)) {
      moduleMembers.set(modulePath, []);
    }
    moduleMembers.get(modulePath).push(nodePath);
  }

  for (const [modulePath, members] of moduleMembers) {
    if (skipModulePaths.has(modulePath)) {
      continue;
    }

    const fragments = new Set(
      members.map((nodePath) =>
        getModuleRelativeResourcePath(nodePath, modulePath),
      ),
    );

    if (!isLikelyLambdaModule(fragments, moduleGroupByPath.get(modulePath))) {
      continue;
    }

    const anchorMember = members.find((nodePath) => {
      const rel = getModuleRelativeResourcePath(nodePath, modulePath);
      return stripTerraformInstanceIndexes(rel) === "aws_lambda_function.this";
    });
    const fallback = positions[members[0]];
    const anchor =
      (anchorMember && positions[anchorMember]) ||
      positions[`${modulePath}.aws_lambda_function.this`] ||
      fallback;
    if (!anchor) {
      continue;
    }

    for (const nodePath of members) {
      const fragment = getModuleRelativeResourcePath(nodePath, modulePath);
      const presetKey = stripTerraformInstanceIndexes(fragment);
      const offset = LAMBDA_MODULE_PRESET_OFFSETS[presetKey];
      if (!offset) {
        continue;
      }
      positions[nodePath] = {
        x: anchor.x + offset.x,
        y: anchor.y + offset.y,
      };
    }
  }

  return positions;
}

/** Pipeline-injected module call vertex (`terraform_module` resource at the module address). */
function isSyntheticTerraformModuleHub(nodePath, node) {
  const primary = Object.values(node?.resources || {}).find((r) => r?.type);
  return primary?.type === "terraform_module" && primary?.address === nodePath;
}

/**
 * After force layout / collapse / optional presets, synthetic `terraform_module` hubs can still
 * sit at stale grid coordinates while descendants moved — place each hub just above the bbox of
 * all strict descendant nodes (deepest module paths first so nested hubs are stable).
 */
function pinSyntheticTerraformModuleHubs(
  positions,
  nodeKeys,
  nodes,
  tierMap,
  tierConfigs,
) {
  const hubs = nodeKeys.filter(
    (path) => nodes[path] && isSyntheticTerraformModuleHub(path, nodes[path]),
  );
  hubs.sort((a, b) => b.length - a.length);

  const prefix = (base) => `${base}.`;

  for (const hubPath of hubs) {
    const px = prefix(hubPath);
    const descendants = nodeKeys.filter(
      (path) => path !== hubPath && path.startsWith(px),
    );
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const path of descendants) {
      const pos = positions[path];
      const cfg = tierConfigs[tierMap[path]];
      if (
        !pos ||
        typeof pos.x !== "number" ||
        typeof pos.y !== "number" ||
        !cfg
      ) {
        continue;
      }
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + cfg.w);
      maxY = Math.max(maxY, pos.y + cfg.h);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      continue;
    }

    const hubCfg = tierConfigs[tierMap[hubPath]];
    if (!hubCfg) {
      continue;
    }

    const gap = 28;
    positions[hubPath] = {
      x: (minX + maxX) / 2 - hubCfg.w / 2,
      y: minY - gap - hubCfg.h,
    };
  }

  return positions;
}

/** Builds module group records (label, depth, source, member node paths) sorted shallow-first. */
function collectModuleGroups(nodeKeys, nodes = {}) {
  const groups = new Map();

  for (const nodePath of nodeKeys) {
    const moduleChain = getModulePathChain(nodePath);
    for (const modulePath of moduleChain) {
      if (!groups.has(modulePath)) {
        groups.set(modulePath, {
          modulePath,
          moduleLabel: getModuleDisplayLabel(modulePath),
          depth: getModuleDepthFromPath(modulePath),
          source: null,
          version: null,
          nodePaths: [],
        });
      }
      const group = groups.get(modulePath);
      const metadata = (nodes[nodePath]?.terraform_module || []).find(
        (item) => item.modulePath === modulePath,
      );
      if (metadata) {
        group.source ||= metadata.source || null;
        group.version ||= metadata.version || null;
      }
      group.nodePaths.push(nodePath);
    }
  }

  return [...groups.values()].sort((a, b) => a.depth - b.depth);
}

/** Parses a minimal ARN shape (partition, service, region, account) or returns null. */
function parseAwsArn(value) {
  if (typeof value !== "string" || !value.startsWith("arn:")) {
    return null;
  }

  const parts = value.split(":");
  if (parts.length < 6) {
    return null;
  }

  return {
    partition: parts[1] || null,
    service: parts[2] || null,
    region: parts[3] || null,
    accountId: parts[4] || null,
  };
}

/** Non-empty trimmed region string or null. */
function normalizeRegion(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 12-digit AWS account id or null. */
function normalizeAccountId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^\d{12}$/.test(trimmed) ? trimmed : null;
}

/** Best-effort region + account from resource config and `*_arn` fields. */
function extractLocationFromConfig(config) {
  let region =
    normalizeRegion(config.region) || normalizeRegion(config.aws_region);
  let accountId =
    normalizeAccountId(config.account_id) ||
    normalizeAccountId(config.account) ||
    normalizeAccountId(config.owner_id);

  const arnCandidates = [];
  if (typeof config.arn === "string") {
    arnCandidates.push(config.arn);
  }

  for (const [key, value] of Object.entries(config)) {
    if (!key.endsWith("_arn")) {
      continue;
    }

    if (typeof value === "string") {
      arnCandidates.push(value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          arnCandidates.push(entry);
        }
      }
    }
  }

  for (const candidate of arnCandidates) {
    const parsed = parseAwsArn(candidate);
    if (!parsed) {
      continue;
    }

    if (!region) {
      region = normalizeRegion(parsed.region);
    }
    if (!accountId) {
      accountId = normalizeAccountId(parsed.accountId);
    }

    if (region && accountId) {
      break;
    }
  }

  return { region, accountId };
}

/** Value with highest count in a string→count Map (ties: first encountered wins). */
function pickMostCommon(map) {
  let winner = null;
  let winnerCount = -1;

  for (const [value, count] of map.entries()) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }

  return winner;
}

/** Infers region/account per AWS node; fills unknowns with graph-wide mode defaults. */
function buildNodeLocationMap(nodes) {
  const nodeLocations = new Map();
  const regionCounts = new Map();
  const accountCounts = new Map();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    let hasAwsResource = false;
    let region = null;
    let accountId = null;

    for (const resource of Object.values(node.resources || {})) {
      const type = resource.type || "";
      if (!type.startsWith("aws_")) {
        continue;
      }

      hasAwsResource = true;
      const config = getCurrentResourceConfig(resource);
      const location = extractLocationFromConfig(config);

      if (!region && location.region) {
        region = location.region;
      }
      if (!accountId && location.accountId) {
        accountId = location.accountId;
      }
    }

    if (!hasAwsResource) {
      continue;
    }

    if (region) {
      regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    }
    if (accountId) {
      accountCounts.set(accountId, (accountCounts.get(accountId) || 0) + 1);
    }

    nodeLocations.set(nodePath, { region, accountId });
  }

  const defaultRegion = pickMostCommon(regionCounts);
  const defaultAccountId = pickMostCommon(accountCounts);

  for (const [nodePath, location] of nodeLocations.entries()) {
    nodeLocations.set(nodePath, {
      region: location.region || defaultRegion || "unknown-region",
      accountId: location.accountId || defaultAccountId || "unknown-account",
    });
  }

  return nodeLocations;
}

/** Undirected adjacency from merged `edges_new` and `edges_existing` (symmetric sets). */
function buildNodeAdjacencyMap(nodes) {
  const adjacency = new Map();

  for (const nodePath of Object.keys(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    adjacency.set(nodePath, new Set());
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    const neighbors = new Set([
      ...(node.edges_new || []),
      ...(node.edges_existing || []),
    ]);
    for (const neighbor of neighbors) {
      if (!nodes[neighbor] || neighbor === nodePath) {
        continue;
      }
      adjacency.get(nodePath).add(neighbor);
      adjacency.get(neighbor).add(nodePath);
    }
  }

  return adjacency;
}

/** BFS up to `maxDepth` for the lexicographically smallest node that maps to a VPC anchor. */
function findNearestVpcAnchor(
  startNodePath,
  adjacency,
  anchorByNodePath,
  maxDepth = 3,
) {
  if (!adjacency.has(startNodePath)) {
    return null;
  }

  const visited = new Set([startNodePath]);
  let frontier = [startNodePath];

  for (let depth = 0; depth <= maxDepth; depth++) {
    const anchors = frontier.filter((nodePath) =>
      anchorByNodePath.has(nodePath),
    );
    if (anchors.length > 0) {
      anchors.sort();
      return anchorByNodePath.get(anchors[0]);
    }

    const nextFrontier = [];
    for (const nodePath of frontier) {
      for (const neighbor of adjacency.get(nodePath) || []) {
        if (visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);
        nextFrontier.push(neighbor);
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) {
      break;
    }
  }

  return null;
}

/** Maps each resource node to a VPC key/label via explicit ids, subnets, or short graph hops. */
function buildNodeVpcMap(nodes) {
  const nodeVpcMap = new Map();
  const anchorByNodePath = new Map();
  const vpcLabelByKey = new Map();
  const subnetVpcKeyMap = new Map();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    for (const resource of Object.values(node.resources || {})) {
      const config = getCurrentResourceConfig(resource);

      if (resource.type === "aws_vpc") {
        const vpcId = normalizeVpcId(config.id);
        const vpcKey = vpcId || `node:${nodePath}`;
        const vpcLabel =
          vpcId || getLabel(nodePath).split("\n").pop() || nodePath;
        const anchor = { vpcKey, vpcLabel };
        anchorByNodePath.set(nodePath, anchor);
        vpcLabelByKey.set(vpcKey, vpcLabel);
      }

      if (resource.type === "aws_subnet") {
        const vpcIds = extractVpcIdsFromConfig(config);
        if (vpcIds.length === 0) {
          continue;
        }
        const subnetIds = extractSubnetIdsFromConfig(config);
        if (subnetIds.length === 0) {
          continue;
        }

        const vpcKey = vpcIds[0];
        for (const subnetId of subnetIds) {
          subnetVpcKeyMap.set(subnetId, vpcKey);
        }
      }
    }
  }

  const adjacency = buildNodeAdjacencyMap(nodes);
  const fallbackTypes = new Set([
    "aws_subnet",
    "aws_route_table",
    "aws_route_table_association",
    "aws_security_group",
    "aws_network_acl",
    "aws_network_interface",
    "aws_nat_gateway",
    "aws_internet_gateway",
    "aws_lambda_function",
  ]);

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    let vpcKey = null;
    let vpcLabel = null;

    if (anchorByNodePath.has(nodePath)) {
      const anchor = anchorByNodePath.get(nodePath);
      vpcKey = anchor.vpcKey;
      vpcLabel = anchor.vpcLabel;
    } else {
      for (const resource of Object.values(node.resources || {})) {
        const config = getCurrentResourceConfig(resource);

        const configVpcIds = extractVpcIdsFromConfig(config);
        if (configVpcIds.length > 0) {
          vpcKey = configVpcIds[0];
          vpcLabel = configVpcIds[0];
          break;
        }

        const configSubnetIds = extractSubnetIdsFromConfig(config);
        for (const subnetId of configSubnetIds) {
          const mappedVpc = subnetVpcKeyMap.get(subnetId);
          if (!mappedVpc) {
            continue;
          }
          vpcKey = mappedVpc;
          vpcLabel = mappedVpc;
          break;
        }
        if (vpcKey) {
          break;
        }
      }
    }

    if (!vpcKey) {
      const resourceType = getResourceType(nodePath);
      if (fallbackTypes.has(resourceType)) {
        const nearestAnchor = findNearestVpcAnchor(
          nodePath,
          adjacency,
          anchorByNodePath,
          3,
        );
        if (nearestAnchor) {
          vpcKey = nearestAnchor.vpcKey;
          vpcLabel = nearestAnchor.vpcLabel;
        }
      }
    }

    if (!vpcKey) {
      continue;
    }

    const label = vpcLabelByKey.get(vpcKey) || vpcLabel || vpcKey;
    vpcLabelByKey.set(vpcKey, label);
    nodeVpcMap.set(nodePath, { vpcKey, vpcLabel: label });
  }

  return nodeVpcMap;
}

/** Subnet membership per node from explicit ids, `aws_subnet` anchors, or BFS fallback types. */
function buildNodeSubnetMap(nodes, nodeVpcMap) {
  const nodeSubnetMap = new Map();
  const subnetAnchorByNodePath = new Map();
  const subnetLabelByKey = new Map();
  const subnetVpcKeyBySubnetKey = new Map();

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    const nodeVpc = nodeVpcMap.get(nodePath) || null;

    for (const resource of Object.values(node.resources || {})) {
      const config = getCurrentResourceConfig(resource);
      const explicitVpcIds = extractVpcIdsFromConfig(config);
      const resourceVpcKey = explicitVpcIds[0] || nodeVpc?.vpcKey || null;

      if (resource.type === "aws_subnet") {
        const subnetId = normalizeSubnetId(config.id);
        const subnetKey = subnetId || `node:${nodePath}`;
        const subnetLabel =
          subnetId || getLabel(nodePath).split("\n").pop() || nodePath;

        subnetAnchorByNodePath.set(nodePath, { subnetKey, subnetLabel });
        subnetLabelByKey.set(subnetKey, subnetLabel);

        if (resourceVpcKey) {
          subnetVpcKeyBySubnetKey.set(subnetKey, resourceVpcKey);
        }
      }

      const explicitSubnetIds = extractSubnetIdsFromConfig(config);
      for (const subnetId of explicitSubnetIds) {
        if (!subnetLabelByKey.has(subnetId)) {
          subnetLabelByKey.set(subnetId, subnetId);
        }
        if (resourceVpcKey && !subnetVpcKeyBySubnetKey.has(subnetId)) {
          subnetVpcKeyBySubnetKey.set(subnetId, resourceVpcKey);
        }
      }
    }
  }

  const adjacency = buildNodeAdjacencyMap(nodes);
  const fallbackTypes = new Set([
    "aws_lambda_function",
    "aws_route_table_association",
    "aws_network_interface",
    "aws_nat_gateway",
    "aws_instance",
    "aws_db_instance",
    "aws_db_subnet_group",
  ]);

  for (const [nodePath, node] of Object.entries(nodes)) {
    if (nodePath.startsWith("__")) {
      continue;
    }
    let subnetKey = null;
    let subnetLabel = null;
    let subnetVpcKey = null;
    let subnetMemberships = [];

    if (subnetAnchorByNodePath.has(nodePath)) {
      const anchor = subnetAnchorByNodePath.get(nodePath);
      subnetKey = anchor.subnetKey;
      subnetLabel = anchor.subnetLabel;
      subnetVpcKey = subnetVpcKeyBySubnetKey.get(subnetKey) || null;
      subnetMemberships = [subnetKey];
    } else {
      for (const resource of Object.values(node.resources || {})) {
        const config = getCurrentResourceConfig(resource);
        const explicitSubnetIds = [
          ...extractSubnetIdsFromConfig(config),
        ].sort();
        if (explicitSubnetIds.length > 0) {
          const subnetId = explicitSubnetIds[0];
          subnetKey = subnetId;
          subnetLabel = subnetId;
          subnetVpcKey = subnetVpcKeyBySubnetKey.get(subnetId) || null;
          subnetMemberships = explicitSubnetIds;
          break;
        }
      }
    }

    if (!subnetKey) {
      const resourceType = getResourceType(nodePath);
      if (fallbackTypes.has(resourceType)) {
        const nearestAnchor = findNearestVpcAnchor(
          nodePath,
          adjacency,
          subnetAnchorByNodePath,
          3,
        );
        if (nearestAnchor) {
          subnetKey = nearestAnchor.subnetKey;
          subnetLabel = nearestAnchor.subnetLabel;
          subnetVpcKey = subnetVpcKeyBySubnetKey.get(subnetKey) || null;
        }
      }
    }

    if (!subnetKey) {
      continue;
    }

    const label = subnetLabelByKey.get(subnetKey) || subnetLabel || subnetKey;
    subnetLabelByKey.set(subnetKey, label);
    nodeSubnetMap.set(nodePath, {
      subnetKey,
      subnetLabel: label,
      vpcKey: subnetVpcKey,
      subnetKeys:
        subnetMemberships.length > 0 ? subnetMemberships : [subnetKey],
    });
  }

  return nodeSubnetMap;
}

/** Registers facet providers (e.g. networking-v2) that attach summaries to VPC/subnet frame groups. */
function buildContainerFacetContributors(context) {
  const store = context.networkingFacetStore || {
    byVpcKey: {},
    bySubnetKey: {},
  };

  const networkingContributor = {
    id: "networking-v2",
    groupKinds: new Set(["vpc", "subnet"]),
    compute(group) {
      if (group.kind === "vpc") {
        const facet = store.byVpcKey[group.key];
        return facet ? { ...facet } : null;
      }

      if (group.kind === "subnet") {
        const facet = store.bySubnetKey[group.key];
        return facet ? { ...facet } : null;
      }

      return null;
    },
  };

  return [networkingContributor];
}

/** Runs all contributors applicable to `group.kind` and returns facet payloads for UI merge. */
function collectContainerFacets(group, contributors) {
  const facets = [];
  for (const contributor of contributors) {
    if (!contributor.groupKinds.has(group.kind)) {
      continue;
    }
    const facet = contributor.compute(group);
    if (facet) {
      facets.push(facet);
    }
  }
  return facets;
}

/** Single-line subtitle for a container from facet summaries (length-capped). */
function buildContainerFacetSummaryLine(facets) {
  const summaries = facets.map((facet) => facet.summary).filter(Boolean);
  if (summaries.length === 0) {
    return "";
  }
  return summaries.join(" · ").slice(0, 140);
}

/** Merges facet payloads into rectangle `customData` for container elements. */
function buildContainerFacetCustomData(baseCustomData, facets) {
  return {
    ...baseCustomData,
    terraformContainerFacets: facets,
  };
}

/**
 * Nested hierarchy: account → region → VPC → subnet, each holding member node paths for framing.
 */
function collectAccountRegionGroups(
  nodeKeys,
  nodeLocationMap,
  nodeVpcMap,
  nodeSubnetMap,
) {
  const accountGroups = new Map();

  for (const nodePath of nodeKeys) {
    const location = nodeLocationMap.get(nodePath);
    if (!location) {
      continue;
    }

    const accountId = location.accountId;
    const region = location.region;

    if (!accountGroups.has(accountId)) {
      accountGroups.set(accountId, {
        accountId,
        nodePaths: [],
        regions: new Map(),
      });
    }

    const accountGroup = accountGroups.get(accountId);
    accountGroup.nodePaths.push(nodePath);

    if (!accountGroup.regions.has(region)) {
      accountGroup.regions.set(region, {
        region,
        accountId,
        nodePaths: [],
        vpcs: new Map(),
      });
    }

    const regionGroup = accountGroup.regions.get(region);
    regionGroup.nodePaths.push(nodePath);

    const vpc = nodeVpcMap.get(nodePath);
    if (vpc && vpc.vpcKey) {
      if (!regionGroup.vpcs.has(vpc.vpcKey)) {
        regionGroup.vpcs.set(vpc.vpcKey, {
          vpcKey: vpc.vpcKey,
          vpcLabel: vpc.vpcLabel,
          accountId,
          region,
          nodePaths: [],
          subnets: new Map(),
        });
      }

      const vpcGroup = regionGroup.vpcs.get(vpc.vpcKey);
      vpcGroup.nodePaths.push(nodePath);

      const subnet = nodeSubnetMap.get(nodePath);
      if (subnet && subnet.subnetKey) {
        const subnetKeys = subnet.subnetKeys?.length
          ? subnet.subnetKeys
          : [subnet.subnetKey];
        for (const subnetKey of subnetKeys) {
          if (!vpcGroup.subnets.has(subnetKey)) {
            vpcGroup.subnets.set(subnetKey, {
              subnetKey,
              subnetLabel:
                subnetKey === subnet.subnetKey ? subnet.subnetLabel : subnetKey,
              accountId,
              region,
              vpcKey: vpc.vpcKey,
              nodePaths: [],
            });
          }

          vpcGroup.subnets.get(subnetKey).nodePaths.push(nodePath);
        }
      }
    }
  }

  return [...accountGroups.values()]
    .sort((a, b) => a.accountId.localeCompare(b.accountId))
    .map((account) => ({
      ...account,
      regions: [...account.regions.values()].sort((a, b) =>
        a.region.localeCompare(b.region),
      ),
    }))
    .map((account) => ({
      ...account,
      regions: account.regions.map((region) => ({
        ...region,
        vpcs: [...region.vpcs.values()]
          .sort((a, b) => a.vpcLabel.localeCompare(b.vpcLabel))
          .map((vpc) => ({
            ...vpc,
            subnets: [...vpc.subnets.values()].sort((a, b) =>
              a.subnetLabel.localeCompare(b.subnetLabel),
            ),
          })),
      })),
    }));
}

/** Appends paths to `group.nodePaths` preserving uniqueness. */
function pushUniqueNodePaths(group, nodePaths) {
  const existing = new Set(group.nodePaths);
  for (const nodePath of nodePaths) {
    if (!existing.has(nodePath)) {
      group.nodePaths.push(nodePath);
      existing.add(nodePath);
    }
  }
}

/** Ensures module members appear in account/region/VPC/subnet container path lists they span. */
function expandNetworkContainerGroupsWithModuleMembership(
  accountRegionGroups,
  moduleGroups,
  nodeLocationMap,
  nodeVpcMap,
  nodeSubnetMap,
) {
  const accountById = new Map(
    accountRegionGroups.map((account) => [account.accountId, account]),
  );

  for (const moduleGroup of moduleGroups) {
    const membershipTargets = new Map();

    for (const nodePath of moduleGroup.nodePaths) {
      const location = nodeLocationMap.get(nodePath);
      const vpc = nodeVpcMap.get(nodePath);
      const subnet = nodeSubnetMap.get(nodePath);
      if (!location || !vpc?.vpcKey) {
        continue;
      }

      const subnetKeys = subnet?.subnetKeys?.length
        ? subnet.subnetKeys
        : [subnet?.subnetKey || ""];
      for (const subnetKey of subnetKeys) {
        const key = [
          location.accountId,
          location.region,
          vpc.vpcKey,
          subnetKey,
        ].join("|||");
        if (!membershipTargets.has(key)) {
          membershipTargets.set(key, {
            accountId: location.accountId,
            region: location.region,
            vpcKey: vpc.vpcKey,
            subnetKey: subnetKey || null,
          });
        }
      }
    }

    for (const target of membershipTargets.values()) {
      const accountGroup = accountById.get(target.accountId);
      const regionGroup = accountGroup?.regions.find(
        (region) => region.region === target.region,
      );
      const vpcGroup = regionGroup?.vpcs.find(
        (vpc) => vpc.vpcKey === target.vpcKey,
      );
      if (!accountGroup || !regionGroup || !vpcGroup) {
        continue;
      }

      pushUniqueNodePaths(accountGroup, moduleGroup.nodePaths);
      pushUniqueNodePaths(regionGroup, moduleGroup.nodePaths);
      pushUniqueNodePaths(vpcGroup, moduleGroup.nodePaths);

      if (target.subnetKey) {
        const subnetGroup = vpcGroup.subnets.find(
          (subnet) => subnet.subnetKey === target.subnetKey,
        );
        if (subnetGroup) {
          pushUniqueNodePaths(subnetGroup, moduleGroup.nodePaths);
        }
      }
    }
  }

  return accountRegionGroups;
}

// --- Element builders ---

/** Default Excalidraw element fields merged with `overrides` (terraform-tagged `customData`). */
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
    customData: { terraform: true },
    ...overrides,
  };
}

/** `customData` keys the frontend uses for Terraform visibility / explode toggles. */
function getVisibilityCustomData(
  nodePath,
  initiallyVisible,
  explodeParentKeys,
) {
  return {
    terraformVisibilityRole: "resource",
    terraformVisibilityKey: nodePath,
    terraformNodeKind: "resource",
    terraformInitiallyVisible: initiallyVisible,
    terraformExplodeParentKeys: explodeParentKeys,
    terraformExplodeParent: explodeParentKeys[0] || null,
  };
}

module.exports = {
  rand,
  makeBaseElement,
  lerp,
  getIconForType,
  cloneIconElements,
  isPrimaryVisibleResourceType,
  isChangedTerraformAction,
  isInitiallyVisibleTerraformNode,
  getResourceType,
  getModuleDepth,
  isImportantType,
  isLowPriorityType,
  buildTierMap,
  buildTierConfigs,
  getPrimaryAction,
  isDisplayableConfigValue,
  hasUnknownAfterMarker,
  getUnknownTopLevelKeys,
  shouldHideTerraformAttribute,
  buildTerraformResourceDetails,
  getLabel,
  getModulePathChain,
  getModuleDepthFromPath,
  getModuleDisplayLabel,
  getOwningModulePath,
  getModuleRelativeResourcePath,
  stripTerraformInstanceIndexes,
  isLambdaModuleSource,
  isLikelyLambdaModule,
  applyModulePresets,
  pinSyntheticTerraformModuleHubs,
  collectModuleGroups,
  parseAwsArn,
  normalizeRegion,
  normalizeAccountId,
  extractLocationFromConfig,
  pickMostCommon,
  buildNodeLocationMap,
  buildNodeAdjacencyMap,
  findNearestVpcAnchor,
  buildNodeVpcMap,
  buildNodeSubnetMap,
  buildContainerFacetContributors,
  collectContainerFacets,
  buildContainerFacetSummaryLine,
  buildContainerFacetCustomData,
  collectAccountRegionGroups,
  pushUniqueNodePaths,
  expandNetworkContainerGroupsWithModuleMembership,
  getVisibilityCustomData,
  LAMBDA_MODULE_PRESET_OFFSETS,
  ACTION_COLORS,
  ACTION_STROKE,
};
