import { stripStackPrefixForModuleParsing } from "./terraformStackAddress";

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

const CLUSTER_FRAME_COLORS = {
  compute: { strokeColor: "#ea580c", backgroundColor: "#fff7ed" },
  data: { strokeColor: "#059669", backgroundColor: "#ecfdf5" },
  messaging: { strokeColor: "#e11d48", backgroundColor: "#fff1f2" },
  networking: { strokeColor: "#0284c7", backgroundColor: "#f0f9ff" },
  security: { strokeColor: "#d97706", backgroundColor: "#fffbeb" },
  management: { strokeColor: "#7c3aed", backgroundColor: "#f5f3ff" },
  default: { strokeColor: "#64748b", backgroundColor: "#f8fafc" },
} as const;

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
