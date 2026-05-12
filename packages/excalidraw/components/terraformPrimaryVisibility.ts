/**
 * Default “primary” resource visibility for Terraform diagrams (explode / overview).
 *
 * Keep in sync with `packages/backend/excalidraw-elements.js` (PRIMARY_* + getResourceType +
 * isPrimaryVisibleResourceType).
 */

const PRIMARY_COMPUTE_TYPES = new Set([
  "aws_lb",
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

const PRIMARY_SPARK_TYPES = new Set<string>();

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

/** True for resource types shown in the default overview (compute/storage/messaging/module). */
export function isPrimaryVisibleResourceType(resourceType: string): boolean {
  return PRIMARY_VISIBLE_TYPES.has(resourceType);
}

export function isChangedTerraformAction(action: string): boolean {
  return (
    action === "create" ||
    action === "update" ||
    action === "delete" ||
    action === "replace"
  );
}

export function isInitiallyVisibleTerraformResource(
  resourceType: string,
  action: string,
): boolean {
  return (
    isPrimaryVisibleResourceType(resourceType) ||
    isChangedTerraformAction(action)
  );
}

/** Subnet / default-VPC / flow-log tiles in semantic topology (not ELK “primary” overview types). */
const TOPOLOGY_SEMANTIC_INFRA_TYPES = new Set([
  "aws_eip",
  "aws_internet_gateway",
  "aws_lambda_permission",
  "aws_lb",
  "aws_lb_listener",
  "aws_lb_target_group",
  "aws_lb_target_group_attachment",
  "aws_nat_gateway",
  "aws_route",
  "aws_route_table_association",
  "aws_subnet",
  "aws_default_network_acl",
  "aws_default_route_table",
  "aws_default_security_group",
  "aws_flow_log",
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

/**
 * Terraform provider type segment parsed from `nodePath` (handles `module.*` prefixes and `data`).
 */
export function getTerraformResourceTypeFromNodePath(nodePath: string): string {
  const parts = nodePath.split(".");
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
