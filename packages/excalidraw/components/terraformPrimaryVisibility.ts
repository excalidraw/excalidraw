import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  TERRAFORM_CLUSTER_FRAME_COLORS,
  TERRAFORM_CONTEXT_FRAME_COLORS,
} from "./terraformPastelColors";
import { stripStackPrefixForModuleParsing } from "./terraformStackAddress";

/** Frame tint mode: resource/hierarchy categories vs default frames (plan action colors on cards). */
export type TerraformColorMode = "category" | "action";

export const TERRAFORM_COLOR_MODE_DEFAULT: TerraformColorMode = "category";

/** Default Excalidraw frame styling used in plan-action mode (resource cards keep action tints). */
export const TERRAFORM_DEFAULT_FRAME_COLORS = {
  strokeColor: "#bbb",
  backgroundColor: "transparent",
} as const;

let layoutColorMode: TerraformColorMode = TERRAFORM_COLOR_MODE_DEFAULT;

export const getActiveTerraformLayoutColorMode = (): TerraformColorMode =>
  layoutColorMode;

export const withTerraformLayoutColorMode = <T>(
  colorMode: TerraformColorMode,
  fn: () => T,
): T => {
  const prev = layoutColorMode;
  layoutColorMode = colorMode;
  try {
    return fn();
  } finally {
    layoutColorMode = prev;
  }
};

export const withTerraformLayoutColorModeAsync = async <T>(
  colorMode: TerraformColorMode,
  fn: () => Promise<T>,
): Promise<T> => {
  const prev = layoutColorMode;
  layoutColorMode = colorMode;
  try {
    return await fn();
  } finally {
    layoutColorMode = prev;
  }
};

/**
 * Default “primary” resource visibility for Terraform diagrams (explode / overview).
 * Primary types and `getResourceType` / `isPrimaryVisibleResourceType` live in this module.
 */

const PRIMARY_COMPUTE_TYPES = new Set([
  "aws_lb",
  "aws_lambda_function",
  "aws_ecs_cluster",
  "aws_ecs_service",
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

/** Regional API frontends (VPC-less; placed in the regional-primary strip). */
const PRIMARY_API_TYPES = new Set([
  "aws_api_gateway_rest_api",
  "aws_apigatewayv2_api",
]);

const PRIMARY_SPARK_TYPES = new Set<string>();

const PRIMARY_CRYPTO_TYPES = new Set(["aws_kms_key"]);

/** Regional networking primaries (no VPC/subnet placement). */
const PRIMARY_NETWORKING_TYPES = new Set(["aws_ec2_transit_gateway"]);

/** Synthetic Terraform module call nodes (pipeline injects for graph semantics). */
const PRIMARY_MODULE_TYPES = new Set(["terraform_module"]);

const PRIMARY_VISIBLE_TYPES = new Set([
  ...PRIMARY_COMPUTE_TYPES,
  ...PRIMARY_STORAGE_TYPES,
  ...PRIMARY_MESSAGING_TYPES,
  ...PRIMARY_API_TYPES,
  ...PRIMARY_SPARK_TYPES,
  ...PRIMARY_CRYPTO_TYPES,
  ...PRIMARY_NETWORKING_TYPES,
  ...PRIMARY_MODULE_TYPES,
]);

export function isGenericManagedProviderResourceType(
  resourceType: string,
): boolean {
  if (!/^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(resourceType)) {
    return false;
  }
  if (
    resourceType.startsWith("aws_") ||
    resourceType.startsWith("data_") ||
    resourceType.startsWith("terraform_")
  ) {
    return false;
  }
  return true;
}

/** True for resource types shown in the default overview (compute/storage/messaging/module). */
export function isPrimaryVisibleResourceType(resourceType: string): boolean {
  return (
    PRIMARY_VISIBLE_TYPES.has(resourceType) ||
    isGenericManagedProviderResourceType(resourceType)
  );
}

export function isChangedTerraformAction(action: string): boolean {
  return (
    action === "create" ||
    action === "update" ||
    action === "delete" ||
    action === "replace"
  );
}

/** Managed resource types that belong on topology diagrams (not data sources / bookkeeping). */
export function isManagedTopologyResourceType(resourceType: string): boolean {
  if (!resourceType || resourceType === "data") {
    return false;
  }
  if (resourceType === "terraform_data" || resourceType.startsWith("null_")) {
    return false;
  }
  if (resourceType.startsWith("aws_")) {
    return true;
  }
  return isGenericManagedProviderResourceType(resourceType);
}

/**
 * Drawn as its own tile in VPC zones / regional strips (excludes types that are
 * only rendered as satellites under another primary).
 */
export function isTopologyPlacementResourceType(resourceType: string): boolean {
  if (!isManagedTopologyResourceType(resourceType)) {
    return false;
  }
  if (resourceType === "aws_lambda_permission") {
    return false;
  }
  /** Drawn only as satellites under `aws_ecs_service` (see `terraformTopologyEcsLinks`). */
  if (resourceType === "aws_ecs_task_definition") {
    return false;
  }
  if (
    resourceType === "aws_ecs_capacity_provider" ||
    resourceType === "aws_ecs_cluster_capacity_providers"
  ) {
    return false;
  }
  /**
   * Drawn only as satellites under compute primaries (Lambda / ECS IAM stacks).
   * See `terraformTopologyIamLinks`.
   */
  if (
    resourceType === "aws_iam_role" ||
    resourceType === "aws_iam_role_policy" ||
    resourceType === "aws_iam_role_policy_attachment" ||
    resourceType === "aws_iam_policy"
  ) {
    return false;
  }
  /** Drawn only as satellites under `aws_lb` (see `terraformTopologyAlbLinks`). */
  if (
    resourceType === "aws_lb_listener" ||
    resourceType === "aws_lb_target_group" ||
    resourceType === "aws_lb_target_group_attachment"
  ) {
    return false;
  }
  /** Drawn to the left of `aws_api_gateway_rest_api` (see `terraformTopologyApiGatewayLinks`). */
  if (resourceType === "aws_api_gateway_vpc_link") {
    return false;
  }
  /** Drawn only as satellites under `aws_ec2_transit_gateway`. */
  if (
    resourceType === "aws_ec2_transit_gateway_vpc_attachment" ||
    resourceType === "aws_ec2_transit_gateway_peering_attachment" ||
    resourceType === "aws_ec2_transit_gateway_peering_attachment_accepter" ||
    resourceType === "aws_ec2_transit_gateway_connect_attachment" ||
    resourceType === "aws_ec2_transit_gateway_vpn_attachment" ||
    resourceType === "aws_ec2_transit_gateway_route" ||
    resourceType === "aws_ec2_transit_gateway_route_table" ||
    resourceType === "aws_ec2_transit_gateway_route_table_association" ||
    resourceType === "aws_ec2_transit_gateway_route_table_propagation"
  ) {
    return false;
  }
  /** Subnets are structural (`subnetZone` frames), not resource tiles. */
  if (resourceType === "aws_subnet") {
    return false;
  }
  /**
   * Relationship resources; route tables are placed on zone/VPC bottom edges
   * (`terraformTopologyPlacement.ts`).
   */
  if (resourceType === "aws_route_table_association") {
    return false;
  }
  /** Drawn only as tier-2 satellites under `aws_route_table` (see `terraformTopologyRouteLinks`). */
  if (resourceType === "aws_route") {
    return false;
  }
  /** Drawn only as satellites under `aws_sqs_queue` (see `terraformTopologySqsLinks`). */
  if (
    resourceType === "aws_sqs_queue_policy" ||
    resourceType === "aws_sqs_queue_redrive_policy" ||
    resourceType === "aws_sqs_queue_redrive_allow_policy"
  ) {
    return false;
  }
  /** Drawn only as satellites under `aws_rds_cluster` (see `terraformTopologyDatastoreLinks`). */
  if (resourceType === "aws_rds_cluster_instance") {
    return false;
  }
  /** Drawn only as satellites under RDS/Aurora primaries. */
  if (resourceType === "aws_db_subnet_group") {
    return false;
  }
  return true;
}

/** Default import visibility: show all managed resources, including no-op plans. */
export function isInitiallyVisibleTerraformResource(
  resourceType: string,
  action: string,
): boolean {
  if (isManagedTopologyResourceType(resourceType)) {
    return true;
  }
  return isChangedTerraformAction(action);
}

/**
 * Subnet / default-VPC / flow-log tiles in semantic topology (not ELK “primary” overview types).
 * `aws_lambda_permission` is intentionally omitted: it is drawn only as a satellite under
 * `aws_lambda_function` (see `terraformTopologyLambdaPermissionLinks` + layout), not as a
 * standalone zone tile.
 */
const TOPOLOGY_SEMANTIC_INFRA_TYPES = new Set([
  "aws_eip",
  "aws_internet_gateway",
  "aws_lb",
  "aws_lb_listener",
  "aws_lb_target_group",
  "aws_lb_target_group_attachment",
  "aws_nat_gateway",
  "aws_route_table_association",
  "aws_default_network_acl",
  "aws_default_route_table",
  "aws_default_security_group",
  "aws_flow_log",
  "aws_ec2_transit_gateway",
]);

/** Visibility for topology resource rectangles (includes semantic-only infra types). */
export function isInitiallyVisibleTerraformTopologyTile(
  resourceType: string,
  action: string,
): boolean {
  if (TOPOLOGY_SEMANTIC_INFRA_TYPES.has(resourceType)) {
    return true;
  }
  return isInitiallyVisibleTerraformResource(resourceType, action);
}

const CLUSTER_FRAME_COLORS = TERRAFORM_CLUSTER_FRAME_COLORS;

/** Frame border + background color keyed by primary resource type for pipeline/topology cluster frames. */
export function getClusterFrameColorForResourceType(resourceType: string): {
  strokeColor: string;
  backgroundColor: string;
} {
  if (PRIMARY_COMPUTE_TYPES.has(resourceType)) {
    return CLUSTER_FRAME_COLORS.compute;
  }
  if (PRIMARY_STORAGE_TYPES.has(resourceType)) {
    return CLUSTER_FRAME_COLORS.data;
  }
  if (PRIMARY_MESSAGING_TYPES.has(resourceType)) {
    return CLUSTER_FRAME_COLORS.messaging;
  }
  if (
    PRIMARY_NETWORKING_TYPES.has(resourceType) ||
    PRIMARY_API_TYPES.has(resourceType) ||
    resourceType.startsWith("aws_vpc") ||
    resourceType.startsWith("aws_route53_") ||
    resourceType.startsWith("aws_cloudfront_") ||
    resourceType === "aws_lb"
  ) {
    return CLUSTER_FRAME_COLORS.networking;
  }
  if (
    PRIMARY_CRYPTO_TYPES.has(resourceType) ||
    resourceType.startsWith("aws_iam_") ||
    resourceType.startsWith("aws_secretsmanager_") ||
    resourceType.startsWith("aws_acm_") ||
    resourceType.startsWith("aws_wafv2_") ||
    resourceType.startsWith("aws_waf_") ||
    resourceType.startsWith("aws_shield_")
  ) {
    return CLUSTER_FRAME_COLORS.security;
  }
  if (
    resourceType.startsWith("aws_organizations_") ||
    resourceType.startsWith("aws_cloudwatch_") ||
    resourceType.startsWith("aws_ssm_") ||
    resourceType.startsWith("aws_cloudtrail_") ||
    resourceType.startsWith("aws_config_")
  ) {
    return CLUSTER_FRAME_COLORS.management;
  }
  return CLUSTER_FRAME_COLORS.default;
}

export function resolveClusterFrameColors(
  resourceType: string,
  colorMode: TerraformColorMode = layoutColorMode,
): { strokeColor: string; backgroundColor: string } {
  if (colorMode === "action") {
    return TERRAFORM_DEFAULT_FRAME_COLORS;
  }
  return getClusterFrameColorForResourceType(resourceType);
}

/** Spread helper for layout skeletons — uses active layout color mode. */
export function spreadClusterFrameColors(resourceType: string): {
  strokeColor: string;
  backgroundColor: string;
} {
  return resolveClusterFrameColors(resourceType, layoutColorMode);
}

export type TerraformContextFrameRole =
  | "provider"
  | "account"
  | "region"
  | "vpc"
  | "subnetZone";

const CONTEXT_FRAME_COLORS = TERRAFORM_CONTEXT_FRAME_COLORS;

/** Frame border + background for topology context hierarchy (provider → account → region → VPC → subnet). */
export function getContextFrameColorForTopologyRole(
  role: TerraformContextFrameRole,
  options?: { subnetTier?: string | null },
): { strokeColor: string; backgroundColor: string } {
  if (role === "subnetZone") {
    switch (options?.subnetTier) {
      case "public":
        return CONTEXT_FRAME_COLORS.subnetPublic;
      case "private":
        return CONTEXT_FRAME_COLORS.subnetPrivate;
      case "intra":
        return CONTEXT_FRAME_COLORS.subnetIntra;
      default:
        return CONTEXT_FRAME_COLORS.subnetDefault;
    }
  }
  return CONTEXT_FRAME_COLORS[role];
}

export function resolveContextFrameColors(
  role: TerraformContextFrameRole,
  colorMode: TerraformColorMode = layoutColorMode,
  options?: { subnetTier?: string | null },
): { strokeColor: string; backgroundColor: string } {
  if (colorMode === "action") {
    return TERRAFORM_DEFAULT_FRAME_COLORS;
  }
  return getContextFrameColorForTopologyRole(role, options);
}

/** Spread helper for layout skeletons — uses active layout color mode. */
export function spreadContextFrameColors(
  role: TerraformContextFrameRole,
  options?: { subnetTier?: string | null },
): { strokeColor: string; backgroundColor: string } {
  return resolveContextFrameColors(role, layoutColorMode, options);
}

const TOPOLOGY_CONTEXT_FRAME_ROLES = new Set<TerraformContextFrameRole>([
  "provider",
  "account",
  "region",
  "vpc",
  "subnetZone",
]);

const isTopologyContextFrameRole = (
  role: string,
): role is TerraformContextFrameRole =>
  TOPOLOGY_CONTEXT_FRAME_ROLES.has(role as TerraformContextFrameRole);

/** Re-tint topology frame elements without re-running layout. */
export function applyTerraformColorModeToElements(
  elements: readonly ExcalidrawElement[],
  colorMode: TerraformColorMode,
): ExcalidrawElement[] {
  return elements.map((el) => {
    if (el.type !== "frame" || el.isDeleted) {
      return el;
    }
    const role = el.customData?.terraformTopologyRole;
    if (typeof role !== "string") {
      return el;
    }

    let colors: { strokeColor: string; backgroundColor: string } | null = null;
    if (role === "primaryCluster") {
      const primaryAddress = el.customData?.terraformPrimaryAddress;
      const resourceType =
        typeof primaryAddress === "string"
          ? getTerraformResourceTypeFromNodePath(primaryAddress)
          : "terraform_module";
      colors = resolveClusterFrameColors(resourceType, colorMode);
    } else if (isTopologyContextFrameRole(role)) {
      colors = resolveContextFrameColors(role, colorMode, {
        subnetTier:
          typeof el.customData?.terraformSubnetTier === "string"
            ? el.customData.terraformSubnetTier
            : undefined,
      });
    }

    if (
      !colors ||
      (el.strokeColor === colors.strokeColor &&
        el.backgroundColor === colors.backgroundColor)
    ) {
      return el;
    }

    return newElementWith(el, colors);
  });
}

export type TerraformColorLegendEntry = {
  id: string;
  label: string;
  strokeColor: string;
  backgroundColor: string;
};

/** Primary cluster frame colors keyed by AWS resource category. */
export const TERRAFORM_RESOURCE_CATEGORY_LEGEND: readonly TerraformColorLegendEntry[] =
  [
    { id: "compute", label: "Compute", ...CLUSTER_FRAME_COLORS.compute },
    { id: "data", label: "Data", ...CLUSTER_FRAME_COLORS.data },
    { id: "messaging", label: "Messaging", ...CLUSTER_FRAME_COLORS.messaging },
    {
      id: "networking",
      label: "Networking",
      ...CLUSTER_FRAME_COLORS.networking,
    },
    { id: "security", label: "Security", ...CLUSTER_FRAME_COLORS.security },
    {
      id: "management",
      label: "Management",
      ...CLUSTER_FRAME_COLORS.management,
    },
    { id: "default", label: "Other", ...CLUSTER_FRAME_COLORS.default },
  ];

/** Context hierarchy frame colors (provider → account → region → VPC → subnet). */
export const TERRAFORM_HIERARCHY_LEGEND: readonly TerraformColorLegendEntry[] =
  [
    { id: "provider", label: "Provider", ...CONTEXT_FRAME_COLORS.provider },
    { id: "account", label: "Account", ...CONTEXT_FRAME_COLORS.account },
    { id: "region", label: "Region", ...CONTEXT_FRAME_COLORS.region },
    { id: "vpc", label: "VPC", ...CONTEXT_FRAME_COLORS.vpc },
    {
      id: "subnet-public",
      label: "Subnet · public",
      ...CONTEXT_FRAME_COLORS.subnetPublic,
    },
    {
      id: "subnet-private",
      label: "Subnet · private",
      ...CONTEXT_FRAME_COLORS.subnetPrivate,
    },
    {
      id: "subnet-intra",
      label: "Subnet · intra",
      ...CONTEXT_FRAME_COLORS.subnetIntra,
    },
    {
      id: "subnet-other",
      label: "Subnet · other",
      ...CONTEXT_FRAME_COLORS.subnetDefault,
    },
  ];

/**
 * Terraform provider type segment parsed from `nodePath` (handles `module.*` prefixes and `data`).
 */
export function getTerraformResourceTypeFromNodePath(nodePath: string): string {
  const parts = stripStackPrefixForModuleParsing(nodePath).split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (i >= parts.length) {
    return "terraform_module";
  }
  if (parts[i] === "data") {
    return "data";
  }
  return parts[i] || nodePath;
}
