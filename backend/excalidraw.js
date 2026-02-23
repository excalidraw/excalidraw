const fs = require("fs");
const path = require("path");

function rand() {
  return Math.floor(Math.random() * 2147483647);
}

// --- Icon library ---

const ICON_LIB_PATH = path.join(__dirname, "aws-serverless.excalidrawlib");

let iconLibItems = null;
function loadIconLib() {
  if (iconLibItems) return iconLibItems;
  try {
    const raw = JSON.parse(fs.readFileSync(ICON_LIB_PATH, "utf-8"));
    // v1 format: library is array of element arrays
    // v2 format: libraryItems is array of { elements, name }
    iconLibItems = raw.libraryItems || raw.library || [];
    return iconLibItems;
  } catch {
    iconLibItems = [];
    return iconLibItems;
  }
}

// aws-serverless.excalidrawlib item order (from library description):
// 0:Lambda 1:API Gateway 2:AppSync 3:DynamoDB 4:EventBridge
// 5:Cognito 6:S3 7:Kinesis 8:SNS 9:SQS 10:SES
// 11:CloudFront 12:CloudWatch 13:Step Functions 14:Amplify
const ICON_INDEX = {
  aws_lambda_function: 0,
  aws_api_gateway_rest_api: 1,
  aws_apigatewayv2_api: 1,
  aws_apigatewayv2_route: 1,
  aws_appsync_graphql_api: 2,
  aws_dynamodb_table: 3,
  aws_dynamodb_global_table: 3,
  aws_cloudwatch_event_rule: 4,
  aws_scheduler_schedule: 4,
  aws_cognito_user_pool: 5,
  aws_cognito_identity_pool: 5,
  aws_s3_bucket: 6,
  aws_s3_bucket_object: 6,
  aws_s3_object: 6,
  aws_kinesis_stream: 7,
  aws_kinesis_firehose_delivery_stream: 7,
  aws_sns_topic: 8,
  aws_sqs_queue: 9,
  aws_ses_domain_identity: 10,
  aws_ses_email_identity: 10,
  aws_cloudfront_distribution: 11,
  aws_cloudwatch_log_group: 12,
  aws_cloudwatch_metric_alarm: 12,
  aws_sfn_state_machine: 13,
  aws_step_functions_state_machine: 13,
  aws_amplify_app: 14,
};

function getIconForType(resourceType) {
  const items = loadIconLib();
  const idx = ICON_INDEX[resourceType];
  if (idx === undefined || idx >= items.length) return null;
  const item = items[idx];
  // v1: item is element array; v2: item.elements
  return Array.isArray(item) ? item : item.elements || null;
}

function cloneIconElements(origElements, targetX, targetY, targetSize) {
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

function getResourceType(nodePath) {
  const parts = nodePath.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (parts[i] === "data") return "data";
  return parts[i] || nodePath;
}

function getTier(nodePath) {
  const type = getResourceType(nodePath);
  if (type === "data") return 3;
  if (TIER_3_TYPES.has(type)) return 3;
  if (TIER_1_TYPES.has(type)) return 1;
  return 2;
}

const TIER_CONFIG = {
  1: { w: 300, h: 100, fontSize: 16, charge: -3000, collide: 210, strokeWidth: 3, iconSize: 55 },
  2: { w: 260, h: 70, fontSize: 14, charge: -1200, collide: 160, strokeWidth: 2, iconSize: 40 },
  3: { w: 220, h: 60, fontSize: 12, charge: -500, collide: 130, strokeWidth: 1, iconSize: 0 },
};

// --- Styling ---

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

// --- Element builders ---

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

function getBindingPoints(posA, posB, wA, hA, wB, hB) {
  const cxA = posA.x + wA / 2;
  const cyA = posA.y + hA / 2;
  const cxB = posB.x + wB / 2;
  const cyB = posB.y + hB / 2;
  const dx = cxB - cxA;
  const dy = cyB - cyA;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { startFixed: [1, 0.5], endFixed: [0, 0.5] }
      : { startFixed: [0, 0.5], endFixed: [1, 0.5] };
  }
  return dy >= 0
    ? { startFixed: [0.5, 1], endFixed: [0.5, 0] }
    : { startFixed: [0.5, 0], endFixed: [0.5, 1] };
}

// --- Edge collection ---

function collectEdgePairs(nodes) {
  const edgeSet = new Set();
  for (const [nodePath, node] of Object.entries(nodes)) {
    const allEdges = [
      ...new Set([...(node.edges_new || []), ...(node.edges_existing || [])]),
    ];
    for (const target of allEdges) {
      if (!nodes[target]) continue;
      const pair = [nodePath, target].sort().join("|||");
      edgeSet.add(pair);
    }
  }
  return edgeSet;
}

// --- Force layout ---

async function forceLayout(nodeKeys, edgePairs, tierMap) {
  const d3 = await import("d3-force");

  const simNodes = nodeKeys.map((id) => ({
    id,
    tier: tierMap[id],
  }));

  const simLinks = [...edgePairs].map((pair) => {
    const [source, target] = pair.split("|||");
    return { source, target };
  });

  const simulation = d3
    .forceSimulation(simNodes)
    .force(
      "charge",
      d3.forceManyBody().strength((d) => TIER_CONFIG[d.tier].charge),
    )
    .force(
      "link",
      d3
        .forceLink(simLinks)
        .id((d) => d.id)
        .distance((link) => {
          const t1 = link.source.tier;
          const t2 = link.target.tier;
          if (t1 === 1 && t2 === 1) return 500;
          if (t1 === 1 || t2 === 1) return 250;
          return 200;
        })
        .strength((link) => {
          const maxTier = Math.max(link.source.tier, link.target.tier);
          return maxTier >= 2 ? 1.2 : 0.7;
        }),
    )
    .force("center", d3.forceCenter(0, 0))
    .force(
      "collide",
      d3.forceCollide().radius((d) => TIER_CONFIG[d.tier].collide),
    )
    .stop();

  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const n of simNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  }

  const posMap = {};
  for (const n of simNodes) {
    posMap[n.id] = {
      x: n.x - minX + 50,
      y: n.y - minY + 50,
    };
  }
  return posMap;
}

// --- Main conversion ---

async function nodesToExcalidraw(nodes) {
  const elements = [];
  const nodeKeys = Object.keys(nodes);
  const edgePairs = collectEdgePairs(nodes);

  const tierMap = {};
  for (const key of nodeKeys) {
    tierMap[key] = getTier(key);
  }

  const positions = await forceLayout(nodeKeys, edgePairs, tierMap);
  const posMap = {};

  // --- rectangles + labels + icons ---
  for (let i = 0; i < nodeKeys.length; i++) {
    const nodePath = nodeKeys[i];
    const tier = tierMap[nodePath];
    const cfg = TIER_CONFIG[tier];
    const { x, y } = positions[nodePath];
    const resourceType = getResourceType(nodePath);

    const rectId = `rect-${i}`;
    const textId = `text-${i}`;
    posMap[nodePath] = { x, y, w: cfg.w, h: cfg.h, rectId, textId };

    const action = getPrimaryAction(nodes[nodePath]);
    const bgColor = ACTION_COLORS[action] || ACTION_COLORS.existing;
    const strokeColor = ACTION_STROKE[action] || ACTION_STROKE.existing;
    const label = getLabel(nodePath);

    // Check for icon
    const iconElements = cfg.iconSize > 0 ? getIconForType(resourceType) : null;
    const hasIcon = iconElements && iconElements.length > 0;
    const iconPad = 12;
    const iconArea = hasIcon ? cfg.iconSize + iconPad : 0;

    elements.push(
      makeBaseElement({
        type: "rectangle",
        id: rectId,
        x,
        y,
        width: cfg.w,
        height: cfg.h,
        strokeColor,
        strokeWidth: cfg.strokeWidth,
        backgroundColor: bgColor,
        roundness: { type: 3 },
        boundElements: [{ id: textId, type: "text" }],
        strokeStyle: action === "external" ? "dashed" : "solid",
      }),
    );

    // Text: shifted right if icon present
    const textX = x + iconArea + 8;
    const textW = cfg.w - iconArea - 16;

    elements.push(
      makeBaseElement({
        type: "text",
        id: textId,
        x: textX,
        y: y + 10,
        width: textW,
        height: cfg.h - 20,
        text: label,
        fontSize: cfg.fontSize,
        fontFamily: 3,
        textAlign: hasIcon ? "left" : "center",
        verticalAlign: "middle",
        containerId: rectId,
        originalText: label,
        autoResize: false,
        lineHeight: 1.25,
        strokeColor: "#1e1e1e",
      }),
    );

    // Icon elements (scaled and positioned inside the rectangle)
    if (hasIcon) {
      const iconX = x + iconPad;
      const iconY = y + (cfg.h - cfg.iconSize) / 2;
      const clonedIcons = cloneIconElements(
        iconElements,
        iconX,
        iconY,
        cfg.iconSize,
      );
      elements.push(...clonedIcons);
    }
  }

  // --- bidirectional arrows ---
  let arrowIdx = 0;
  for (const pair of edgePairs) {
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
      posA.w,
      posA.h,
      posB.w,
      posB.h,
    );

    const startX = posA.x + startFixed[0] * posA.w;
    const startY = posA.y + startFixed[1] * posA.h;
    const endX = posB.x + endFixed[0] * posB.w;
    const endY = posB.y + endFixed[1] * posB.h;

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
