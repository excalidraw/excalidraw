/**
 * Maps Terraform resource types → plan `values` / `change.after` string fields that best
 * represent the **human** instance name on canvas (not the full address, not bare type).
 *
 * Extend at runtime with {@link terraformRegisterHumanNameFields} or edit
 * {@link TERRAFORM_RESOURCE_HUMAN_NAME_FIELDS}.
 */

/** Built-in per-type field precedence (first non-empty string wins). */
export const TERRAFORM_RESOURCE_HUMAN_NAME_FIELDS: Record<string, readonly string[]> = {
  aws_lambda_function: ["function_name", "name"],
  aws_lambda_layer_version: ["layer_name", "description", "name"],
  aws_iam_role: ["name"],
  aws_iam_policy: ["name"],
  aws_iam_instance_profile: ["name"],
  aws_iam_user: ["name"],
  aws_iam_group: ["name"],
  aws_iam_openid_connect_provider: ["url"],
  aws_iam_role_policy: ["name"],
  aws_iam_user_policy: ["name"],
  aws_iam_group_policy: ["name"],
  aws_iam_policy_attachment: ["name"],
  aws_security_group: ["name", "name_prefix", "description"],
  aws_security_group_rule: ["description", "type", "protocol"],
  aws_default_security_group: ["name", "description", "vpc_id"],
  aws_s3_bucket: ["bucket", "name"],
  aws_s3_object: ["key", "source", "etag"],
  aws_s3_bucket_policy: ["bucket"],
  aws_s3_bucket_public_access_block: ["bucket"],
  aws_s3_bucket_server_side_encryption_configuration: ["bucket"],
  aws_s3_bucket_versioning: ["bucket"],
  aws_sqs_queue: ["name"],
  aws_sqs_queue_policy: ["queue_url"],
  aws_sqs_queue_redrive_policy: ["queue_url"],
  aws_sqs_queue_redrive_allow_policy: ["queue_url"],
  aws_sns_topic: ["name"],
  aws_sns_topic_subscription: ["endpoint"],
  aws_dynamodb_table: ["name", "hash_key"],
  aws_cloudwatch_log_group: ["name"],
  aws_cloudwatch_metric_alarm: ["alarm_name", "alarm_description"],
  aws_kms_key: ["description", "key_id"],
  aws_kms_alias: ["name"],
  aws_api_gateway_rest_api: ["name", "description"],
  aws_api_gateway_resource: ["path"],
  aws_api_gateway_method: ["http_method"],
  aws_api_gateway_stage: ["stage_name"],
  aws_instance: ["tags"],
  aws_launch_template: ["name", "name_prefix"],
  aws_autoscaling_group: ["name"],
  aws_lb: ["name"],
  aws_alb: ["name"],
  aws_elb: ["name"],
  aws_alb_target_group: ["name"],
  aws_ecs_cluster: ["name"],
  aws_ecs_service: ["name"],
  aws_ecs_task_definition: ["family"],
  aws_rds_cluster: ["cluster_identifier", "database_name"],
  aws_db_instance: ["identifier", "db_name", "name"],
  aws_elasticache_cluster: ["cluster_id", "replication_group_id"],
  aws_elasticache_replication_group: ["replication_group_id", "description"],
  aws_eks_cluster: ["name"],
  aws_redshift_cluster: ["cluster_identifier"],
  aws_neptune_cluster: ["cluster_identifier"],
  aws_docdb_cluster: ["cluster_identifier"],
  aws_opensearch_domain: ["domain_name"],
  aws_msk_cluster: ["cluster_name"],
  aws_secretsmanager_secret: ["name"],
  aws_cloudfront_distribution: ["comment", "id"],
  aws_route53_record: ["name"],
  aws_route53_zone: ["name"],
  aws_acm_certificate: ["domain_name"],
  aws_wafv2_web_acl: ["name", "description"],
  aws_wafregional_web_acl: ["name"],
  aws_subnet: ["tags", "cidr_block", "id"],
  aws_vpc: ["tags", "cidr_block", "id"],
  aws_vpc_endpoint: ["service_name", "id"],
  aws_route_table: ["vpc_id", "id"],
  aws_default_route_table: ["vpc_id", "id"],
  aws_route_table_association: ["subnet_id", "route_table_id"],
  aws_flow_log: ["log_destination", "vpc_id", "id"],
  aws_default_network_acl: ["vpc_id", "id"],
  aws_cloudformation_stack: ["name"],
  aws_stepfunctions_state_machine: ["name"],
  aws_events_rule: ["name", "description"],
  aws_scheduler_schedule: ["name"],
  aws_glue_job: ["name", "description"],
  aws_athena_workgroup: ["name"],
  aws_emr_cluster: ["name"],
  aws_batch_job_queue: ["name"],
  aws_batch_compute_environment: ["compute_environment_name", "name"],
  aws_efs_file_system: ["creation_token"],
  aws_fsx_lustre_file_system: ["import_path", "id"],
  aws_backup_vault: ["name"],
  aws_config_configuration_recorder: ["name"],
  aws_guardduty_detector: ["id"],
  aws_macie2_account: ["id"],
  aws_codebuild_project: ["name", "description"],
  aws_codepipeline: ["name"],
  aws_codecommit_repository: ["repository_name"],
  aws_codedeploy_app: ["name"],
  aws_codestarconnections_connection: ["name"],
  aws_ecr_repository: ["name"],
  aws_ecrpublic_repository: ["repository_name"],
  aws_imagebuilder_component: ["name", "version"],
  aws_transfer_server: ["id"],
  aws_transfer_user: ["user_name"],
  aws_workspaces_directory: ["directory_id"],
  aws_directory_service_directory: ["name", "id"],
  aws_cognito_user_pool: ["name"],
  aws_cognito_identity_pool: ["identity_pool_name"],
  aws_apigatewayv2_api: ["name"],
  aws_apigatewayv2_stage: ["name"],
  aws_appsync_graphql_api: ["name"],
  aws_connect_instance: ["identity_management_type", "id"],
  aws_lex_bot: ["name"],
  aws_iot_thing: ["name"],
  aws_iot_policy: ["name"],
  aws_mq_broker: ["broker_name"],
  aws_memorydb_cluster: ["name"],
  aws_timestreamwrite_database: ["database_name"],
  aws_timestreamwrite_table: ["table_name"],
  aws_quicksight_data_source: ["name"],
  aws_glue_catalog_database: ["name"],
  aws_glue_catalog_table: ["name"],
  aws_athena_named_query: ["name"],
  aws_sagemaker_notebook_instance: ["name"],
  aws_sagemaker_model: ["name"],
  aws_sagemaker_endpoint_configuration: ["name"],
  aws_elasticsearch_domain: ["domain_name"],
  aws_cloudsearch_domain: ["name"],
  aws_media_convert_queue: ["name"],
  aws_amplify_app: ["name"],
  aws_verifiedaccess_instance: ["description"],
  aws_networkfirewall_firewall: ["name"],
  aws_networkfirewall_firewall_policy: ["name"],
  aws_networkfirewall_rule_group: ["name"],
  aws_vpc_peering_connection: ["id"],
  aws_vpn_connection: ["id"],
  aws_customer_gateway: ["id"],
  aws_dx_connection: ["connection_id"],
  aws_dx_gateway: ["name"],
  aws_globalaccelerator_accelerator: ["name"],
  aws_route53_resolver_endpoint: ["name"],
  aws_service_discovery_service: ["name"],
  aws_service_discovery_http_namespace: ["name"],
  aws_appmesh_mesh: ["name"],
  aws_appmesh_virtual_node: ["name"],
  aws_appmesh_virtual_service: ["name"],
  "data.aws_region": ["endpoint", "id", "name", "region"],
  "data.aws_caller_identity": ["account_id"],
  "data.aws_partition": ["partition", "dns_suffix", "id"],
  "data.aws_availability_zones": ["state"],
  "data.aws_iam_policy_document": ["id"],
  "data.aws_secretsmanager_secret": ["name", "arn"],
  "data.aws_kms_key": ["key_id", "description"],
  "data.aws_kms_alias": ["name"],
  "data.aws_ami": ["name", "id", "image_id"],
  "data.aws_ec2_instance_type": ["id"],
  "data.aws_subnet": ["id", "cidr_block"],
  "data.aws_vpc": ["id", "cidr_block"],
  "data.aws_s3_bucket": ["bucket", "id"],
  "data.aws_s3_object": ["key", "bucket"],
  "data.aws_lambda_function": ["function_name", "qualified_arn"],
  "data.aws_iam_role": ["name", "id"],
  "data.aws_iam_policy": ["arn", "name"],
  "data.aws_cloudwatch_log_group": ["name"],
  "data.aws_sqs_queue": ["name", "url"],
  "data.aws_sns_topic": ["name", "arn"],
  "data.aws_dynamodb_table": ["name"],
  "data.aws_rds_cluster": ["cluster_identifier"],
  "data.aws_db_instance": ["db_instance_identifier"],
  terraform_data: ["id"],
};

/**
 * When no per-type entry exists, try these attribute keys in order on `values` / `change.after`.
 * Keep human-oriented fields before opaque ids.
 */
export const TERRAFORM_RESOURCE_HUMAN_NAME_FIELD_FALLBACKS: readonly string[] = [
  "function_name",
  "bucket",
  "queue_name",
  "repository_name",
  "table_name",
  "cluster_identifier",
  "cluster_id",
  "replication_group_id",
  "db_name",
  "identifier",
  "domain_name",
  "secret_name",
  "alarm_name",
  "log_group_name",
  "family",
  "stage_name",
  "service_name",
  "user_name",
  "broker_name",
  "database_name",
  "compute_environment_name",
  "graphql_url",
  "name",
  "name_prefix",
  "title",
  "description",
  "key",
  "endpoint",
  "url",
  "cidr_block",
  "id",
];

let humanNameFieldOverrides: Record<string, readonly string[]> = {};

/**
 * Merge extra type → field list mappings (e.g. from app init). Later keys win over earlier
 * registrations for the same type.
 */
export function terraformRegisterHumanNameFields(
  partial: Record<string, readonly string[]>,
): void {
  humanNameFieldOverrides = { ...humanNameFieldOverrides, ...partial };
}

export function terraformResetHumanNameFieldOverrides(): void {
  humanNameFieldOverrides = {};
}

function resourceTypeKey(resource: Record<string, unknown> | null | undefined): string {
  const t = typeof resource?.type === "string" ? resource.type : "";
  const mode = typeof resource?.mode === "string" ? resource.mode : "";
  if (!t) {
    return "";
  }
  if (mode === "data") {
    return `data.${t}`;
  }
  return t;
}

function collectValueBags(resource: Record<string, unknown> | null | undefined): Record<
  string,
  unknown
>[] {
  if (!resource || typeof resource !== "object") {
    return [];
  }
  const out: Record<string, unknown>[] = [];
  const change = resource.change as { after?: unknown; before?: unknown } | undefined;
  const after = change?.after;
  const before = change?.before;
  const values = resource.values;
  for (const bag of [after, values, before]) {
    if (bag && typeof bag === "object" && !Array.isArray(bag)) {
      out.push(bag as Record<string, unknown>);
    }
  }
  return out;
}

function isUsableLabelString(value: string): boolean {
  const t = value.trim();
  if (t.length === 0 || t.length > 240) {
    return false;
  }
  if (t.startsWith("{") || t.startsWith("[")) {
    return false;
  }
  if (t.startsWith("arn:") && t.length > 80) {
    return false;
  }
  return true;
}

function readStringField(
  bag: Record<string, unknown>,
  field: string,
): string | null {
  const v = bag[field];
  if (typeof v !== "string") {
    return null;
  }
  return isUsableLabelString(v) ? v.trim() : null;
}

function readTagsName(bags: Record<string, unknown>[]): string | null {
  for (const bag of bags) {
    const tags = bag.tags;
    if (tags && typeof tags === "object" && !Array.isArray(tags)) {
      const n = (tags as Record<string, unknown>).Name;
      if (typeof n === "string" && isUsableLabelString(n)) {
        return n.trim();
      }
    }
  }
  return null;
}

function fieldListForType(typeKey: string): readonly string[] {
  const fromOverride = humanNameFieldOverrides[typeKey];
  if (fromOverride?.length) {
    return fromOverride;
  }
  const builtIn = TERRAFORM_RESOURCE_HUMAN_NAME_FIELDS[typeKey];
  if (builtIn?.length) {
    return builtIn;
  }
  return TERRAFORM_RESOURCE_HUMAN_NAME_FIELD_FALLBACKS;
}

function pickFromBags(
  bags: Record<string, unknown>[],
  fields: readonly string[],
): string | null {
  for (const field of fields) {
    if (field === "tags") {
      const tagName = readTagsName(bags);
      if (tagName) {
        return tagName;
      }
      continue;
    }
    for (const bag of bags) {
      const s = readStringField(bag, field);
      if (s) {
        return s;
      }
    }
  }
  return null;
}

/**
 * Best short human label from plan JSON (`values`, `change.after`, `change.before`), or null.
 */
export function terraformHumanNameFromPlanResource(
  resource: Record<string, unknown> | null | undefined,
): string | null {
  if (!resource) {
    return null;
  }
  const typeKey = resourceTypeKey(resource);
  const bags = collectValueBags(resource);
  if (bags.length === 0) {
    return null;
  }

  if (!typeKey) {
    return (
      readTagsName(bags) ??
      pickFromBags(bags, TERRAFORM_RESOURCE_HUMAN_NAME_FIELD_FALLBACKS)
    );
  }

  const specific = pickFromBags(bags, fieldListForType(typeKey));
  if (specific) {
    return specific;
  }

  const tagName = readTagsName(bags);
  if (tagName) {
    return tagName;
  }

  return pickFromBags(bags, TERRAFORM_RESOURCE_HUMAN_NAME_FIELD_FALLBACKS);
}
