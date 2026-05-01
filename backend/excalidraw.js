const fs = require("fs");
const path = require("path");

function rand() {
  return Math.floor(Math.random() * 2147483647);
}

// --- Icon library ---

const DEFAULT_ICON_LIBRARY = "aws-architecture-icons";

const ICON_LIBRARY_CONFIGS = {
  "aws-architecture-icons": {
    filename: "aws-architecture-icons.excalidrawlib",
    names: {
      aws_acm_certificate: "Certificate Manager",
      aws_alb: "ALB",
      aws_alb_listener: "ALB",
      aws_alb_listener_rule: "Rule",
      aws_alb_target_group: "ALB",
      aws_ami: "AMI",
      aws_amplify_app: "Amplify",
      aws_amplify_branch: "Amplify",
      aws_api_gateway_authorizer: "API Gateway",
      aws_api_gateway_deployment: "API Gateway",
      aws_api_gateway_integration: "API Gateway",
      aws_api_gateway_method: "API Gateway",
      aws_api_gateway_resource: "API Gateway",
      aws_api_gateway_rest_api: "API Gateway",
      aws_apigatewayv2_api: "API Gateway",
      aws_apigatewayv2_authorizer: "API Gateway",
      aws_apigatewayv2_deployment: "API Gateway",
      aws_apigatewayv2_integration: "API Gateway",
      aws_apigatewayv2_route: "API Gateway",
      aws_apigatewayv2_stage: "API Gateway",
      aws_appautoscaling_policy: "Application Auto Scaling",
      aws_appautoscaling_target: "Application Auto Scaling",
      aws_appconfig_application: "AppConfig",
      aws_appconfig_configuration_profile: "AppConfig",
      aws_appconfig_deployment: "AppConfig",
      aws_apprunner_service: "App Runner",
      aws_appsync_datasource: "AppSync",
      aws_appsync_graphql_api: "AppSync",
      aws_appsync_resolver: "AppSync",
      aws_athena_database: "Athena",
      aws_athena_workgroup: "Athena",
      aws_autoscaling_attachment: "Auto Scaling group",
      aws_autoscaling_group: "Auto Scaling group",
      aws_autoscaling_lifecycle_hook: "Auto Scaling group",
      aws_autoscaling_policy: "Auto Scaling group",
      aws_autoscaling_schedule: "Auto Scaling group",
      aws_backup_plan: "Backup",
      aws_backup_selection: "Backup",
      aws_backup_vault: "Backup",
      aws_batch_compute_environment: "Batch",
      aws_batch_job_definition: "Batch",
      aws_batch_job_queue: "Batch",
      aws_budgets_budget: "Budgets",
      aws_cloud9_environment_ec2: "Cloud9",
      aws_cloudformation_stack: "CloudFormation",
      aws_cloudformation_stack_set: "CloudFormation",
      aws_cloudfront_cache_policy: "CloudFront",
      aws_cloudfront_distribution: "CloudFront",
      aws_cloudfront_function: "CloudFront",
      aws_cloudfront_origin_access_control: "CloudFront",
      aws_cloudhsm_v2_cluster: "CloudHSM",
      aws_cloudhsm_v2_hsm: "CloudHSM",
      aws_cloudtrail: "CloudTrail",
      aws_cloudwatch_dashboard: "Dashboard",
      aws_cloudwatch_event_archive: "EventBridge",
      aws_cloudwatch_event_bus: "Event bus",
      aws_cloudwatch_event_rule: "Rule",
      aws_cloudwatch_event_target: "Event",
      aws_cloudwatch_log_group: "Logs",
      aws_cloudwatch_log_metric_filter: "Logs",
      aws_cloudwatch_metric_alarm: "Alarm",
      aws_codeartifact_domain: "CodeArtifact",
      aws_codeartifact_repository: "CodeArtifact",
      aws_codebuild_project: "CodeBuild",
      aws_codecommit_repository: "CodeCommit",
      aws_codedeploy_app: "CodeDeploy",
      aws_codedeploy_deployment_group: "CodeDeploy",
      aws_codepipeline: "CodePipeline",
      aws_cognito_identity_pool: "Cognito",
      aws_cognito_user_pool: "Cognito",
      aws_cognito_user_pool_client: "Cognito",
      aws_config_config_rule: "Config",
      aws_config_configuration_recorder: "Config",
      aws_customer_gateway: "VPN gateway",
      aws_datasync_agent: "DataSync",
      aws_datasync_location_efs: "DataSync",
      aws_datasync_location_s3: "DataSync",
      aws_datasync_task: "DataSync",
      aws_db_cluster_snapshot: "RDS",
      aws_db_event_subscription: "RDS",
      aws_db_instance: "RDS instance",
      aws_db_option_group: "RDS",
      aws_db_parameter_group: "RDS",
      aws_db_proxy: "RDS",
      aws_db_snapshot: "RDS",
      aws_db_subnet_group: "RDS",
      aws_directory_service_directory: "Directory Service",
      aws_dlm_lifecycle_policy: "EBS",
      aws_dms_endpoint: "DMS",
      aws_dms_replication_instance: "DMS",
      aws_dms_replication_task: "DMS",
      aws_docdb_cluster: "DocumentDB",
      aws_docdb_cluster_instance: "DocumentDB",
      aws_docdb_cluster_parameter_group: "DocumentDB",
      aws_dynamodb_global_table: "DynamoDB",
      aws_dynamodb_table: "DynamoDB Table",
      aws_dynamodb_table_item: "DynamoDB Table",
      aws_ebs_snapshot: "EBS",
      aws_ebs_volume: "EBS",
      aws_ec2_capacity_reservation: "EC2",
      aws_ec2_client_vpn_endpoint: "Client VPN",
      aws_ec2_client_vpn_network_association: "Client VPN",
      aws_ec2_fleet: "Spot Fleet",
      aws_ec2_instance_state: "Instance",
      aws_ec2_managed_prefix_list: "VPC",
      aws_ec2_tag: "EC2",
      aws_ec2_transit_gateway: "Transit Gateway",
      aws_ec2_transit_gateway_route: "Transit Gateway",
      aws_ec2_transit_gateway_route_table: "Transit Gateway",
      aws_ec2_transit_gateway_vpc_attachment: "Attachment",
      aws_ecr_lifecycle_policy: "ECR",
      aws_ecr_repository: "ECR",
      aws_ecr_repository_policy: "ECR",
      aws_ecs_cluster: "ECS",
      aws_ecs_service: "Service",
      aws_ecs_task_definition: "Task",
      aws_efs_access_point: "EFS",
      aws_efs_file_system: "EFS",
      aws_efs_mount_target: "EFS",
      aws_egress_only_internet_gateway: "Internet gateway",
      aws_eip: "EC2",
      aws_eks_addon: "EKS",
      aws_eks_cluster: "EKS",
      aws_eks_fargate_profile: "Fargate",
      aws_eks_node_group: "EKS",
      aws_elastic_beanstalk_application: "Elastic Beanstalk",
      aws_elastic_beanstalk_environment: "Elastic Beanstalk",
      aws_elasticache_cluster: "ElastiCache",
      aws_elasticache_parameter_group: "ElastiCache",
      aws_elasticache_replication_group: "ElastiCache",
      aws_elasticache_subnet_group: "ElastiCache",
      aws_elasticsearch_domain: "OpenSearch Service",
      aws_elb: "ELB",
      aws_emr_cluster: "EMR",
      aws_flow_log: "Flow logs",
      aws_fsx_lustre_file_system: "FSx",
      aws_fsx_ontap_file_system: "FSx",
      aws_fsx_openzfs_file_system: "FSx",
      aws_glacier_vault: "Glacier",
      aws_globalaccelerator_accelerator: "Global Accelerator",
      aws_glue_catalog_database: "DataCatalog",
      aws_glue_catalog_table: "DataCatalog",
      aws_glue_crawler: "Crawler",
      aws_glue_job: "Glue",
      aws_glue_trigger: "Glue",
      aws_guardduty_detector: "GuardDuty",
      aws_iam_access_key: "IAM",
      aws_iam_group: "IAM",
      aws_iam_group_policy: "Permissions",
      aws_iam_group_policy_attachment: "Permissions",
      aws_iam_instance_profile: "IAM",
      aws_iam_openid_connect_provider: "IAM",
      aws_iam_policy: "Permissions",
      aws_iam_policy_attachment: "Permissions",
      aws_iam_role: "Role",
      aws_iam_role_policy: "Permissions",
      aws_iam_role_policy_attachment: "Permissions",
      aws_iam_saml_provider: "IAM",
      aws_iam_service_linked_role: "Role",
      aws_iam_user: "IAM",
      aws_iam_user_policy: "Permissions",
      aws_iam_user_policy_attachment: "Permissions",
      aws_instance: "Instance",
      aws_internet_gateway: "Internet gateway",
      aws_iot_certificate: "IoT Core",
      aws_iot_policy: "IoT Core",
      aws_iot_policy_attachment: "IoT Core",
      aws_iot_thing: "IoT Core",
      aws_iot_topic_rule: "IoT topic",
      aws_kinesis_firehose_delivery_stream: "Kinesis Data Firehose",
      aws_kinesis_stream: "Kinesis Data Streams",
      aws_kinesisanalyticsv2_application: "Kinesis Data Analytics",
      aws_kms_alias: "KMS",
      aws_kms_key: "KMS",
      aws_lambda_alias: "Lambda",
      aws_lambda_event_source_mapping: "Lambda",
      aws_lambda_function: "Lambda",
      aws_lambda_function_event_invoke_config: "Lambda",
      aws_lambda_layer_version: "Lambda",
      aws_lambda_permission: "Lambda",
      aws_lb: "ELB",
      aws_lb_listener: "ELB",
      aws_lb_listener_rule: "Rule",
      aws_lb_target_group: "ELB",
      aws_launch_configuration: "Auto Scaling",
      aws_launch_template: "EC2",
      aws_macie2_account: "Macie",
      aws_mq_broker: "Amazon MQ",
      aws_msk_cluster: "Managed Streaming for Apache Kafka",
      aws_msk_configuration: "Managed Streaming for Apache Kafka",
      aws_nat_gateway: "NAT gateway",
      aws_neptune_cluster: "Neptune",
      aws_neptune_cluster_instance: "Neptune",
      aws_network_acl: "NACL",
      aws_network_acl_rule: "NACL",
      aws_network_interface: "ENI",
      aws_networkfirewall_firewall: "Network Firewall",
      aws_networkfirewall_firewall_policy: "Network Firewall",
      aws_networkfirewall_rule_group: "Network Firewall",
      aws_opensearch_domain: "OpenSearch Service",
      aws_organizations_account: "AWS account",
      aws_organizations_organization: "Organizations",
      aws_organizations_organizational_unit: "Organizations",
      aws_organizations_policy: "Organizations",
      aws_ram_resource_share: "Resource Access Manager",
      aws_ram_resource_association: "Resource Access Manager",
      aws_ram_principal_association: "Resource Access Manager",
      aws_rds_cluster: "Aurora",
      aws_rds_cluster_endpoint: "Aurora",
      aws_rds_cluster_instance: "Aurora instance",
      aws_rds_cluster_parameter_group: "Aurora",
      aws_redshift_cluster: "Redshift",
      aws_route: "Route table",
      aws_route53_record: "Route 53",
      aws_route53_resolver_endpoint: "Resolver",
      aws_route53_resolver_rule: "Resolver",
      aws_route53_zone: "Route 53",
      aws_route_table: "Route table",
      aws_route_table_association: "Route table",
      aws_s3_bucket: "S3",
      aws_s3_bucket_acl: "S3",
      aws_s3_bucket_lifecycle_configuration: "S3",
      aws_s3_bucket_notification: "S3",
      aws_s3_bucket_object: "S3",
      aws_s3_bucket_policy: "S3",
      aws_s3_bucket_public_access_block: "S3",
      aws_s3_bucket_server_side_encryption_configuration: "S3",
      aws_s3_bucket_versioning: "S3",
      aws_s3_object: "S3",
      aws_sagemaker_domain: "SageMaker",
      aws_sagemaker_endpoint: "SageMaker",
      aws_sagemaker_model: "SageMaker",
      aws_sagemaker_notebook_instance: "Notebook",
      aws_scheduler_schedule: "Scheduler",
      aws_scheduler_schedule_group: "Scheduler",
      aws_secretsmanager_secret: "Secrets Manager",
      aws_secretsmanager_secret_version: "Secrets Manager",
      aws_security_group: "Network Firewall",
      aws_security_group_rule: "Network Firewall",
      aws_ses_domain_identity: "SES",
      aws_ses_email_identity: "SES",
      aws_sfn_state_machine: "Step Functions",
      aws_shield_protection: "Shield",
      aws_sns_topic: "SNS",
      aws_sns_topic_policy: "SNS",
      aws_sns_topic_subscription: "SNS",
      aws_spot_fleet_request: "Spot Fleet",
      aws_spot_instance_request: "Spot instance",
      aws_sqs_queue: "SQS",
      aws_sqs_queue_policy: "SQS",
      aws_ssm_activation: "System Manager",
      aws_ssm_association: "System Manager",
      aws_ssm_document: "Documents",
      aws_ssm_parameter: "Parameter Store",
      aws_ssm_patch_baseline: "System Manager",
      aws_subnet: "VPC",
      aws_transfer_server: "Transfer Family",
      aws_vpc: "VPC",
      aws_vpc_endpoint: "Endpoint",
      aws_vpc_endpoint_service: "PrivateLink",
      aws_vpc_peering_connection: "Peering connection",
      aws_vpn_connection: "VPN Connection",
      aws_vpn_gateway: "VPN gateway",
      aws_wafv2_web_acl: "WAF",
      aws_xray_sampling_rule: "X-Ray",
      data_aws_caller_identity: "AWS account",
      data_aws_iam_policy_document: "Permissions",
      data_aws_partition: "AWS Cloud",
      data_aws_region: "Region",
    },
  },
};

function normalizeIconLibraryName(value) {
  if (!value) {
    return DEFAULT_ICON_LIBRARY;
  }

  return path.basename(value, ".excalidrawlib");
}

function getIconLibraryConfig() {
  const requested = normalizeIconLibraryName(
    process.env.AWS_ICON_LIBRARY || process.env.AWS_ICON_LIB,
  );

  return (
    ICON_LIBRARY_CONFIGS[requested] ||
    ICON_LIBRARY_CONFIGS[DEFAULT_ICON_LIBRARY]
  );
}

function getIconLibraryPath(config) {
  if (process.env.AWS_ICON_LIB_PATH) {
    return path.resolve(process.env.AWS_ICON_LIB_PATH);
  }

  return path.join(__dirname, config.filename);
}

let iconLibItems = null;
let iconLibCacheKey = null;
let iconLibNameIndex = {};
function loadIconLib() {
  const config = getIconLibraryConfig();
  const iconLibPath = getIconLibraryPath(config);
  const cacheKey = `${config.filename}:${iconLibPath}`;
  if (iconLibItems && iconLibCacheKey === cacheKey) return iconLibItems;

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

function getIconForType(resourceType) {
  const items = loadIconLib();
  const config = getIconLibraryConfig();
  const iconName = config.names?.[resourceType];
  const idx =
    config.index?.[resourceType] ??
    (iconName ? iconLibNameIndex[iconName.toLowerCase()] : undefined);
  if (idx === undefined || idx >= items.length) return null;
  const item = items[idx];
  // v1: item is element array; v2: item.elements
  return Array.isArray(item) ? item : item.elements || null;
}

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

function getResourceType(nodePath) {
  const parts = nodePath.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (parts[i] === "data") return "data";
  return parts[i] || nodePath;
}

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

function isImportantType(resourceType) {
  return TIER_1_TYPES.has(resourceType);
}

function isLowPriorityType(resourceType) {
  return resourceType === "data" || TIER_3_TYPES.has(resourceType);
}

// Builds a tier map for all nodes. Tier 0 = most prominent, higher = less prominent.
// Important services are bumped one tier above their depth peers; low-priority types
// are pushed one tier below.
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

// Interpolates tier visual configs across the actual tier range found in the graph.
// More nodes → smaller boxes and stronger repulsion to avoid crowding.
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

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

const UNKNOWN_VALUE_PLACEHOLDER = "Known after apply";

const HIDDEN_ATTRIBUTES_BY_TYPE = {
  aws_iam_role_policy: new Set(["id", "name_prefix"]),
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

function isDisplayableConfigValue(value) {
  return (
    value !== null &&
    typeof value !== "undefined" &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0) &&
    !(isPlainObject(value) && Object.keys(value).length === 0)
  );
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCurrentResourceConfig(resource) {
  const change = resource.change || {};
  if (isPlainObject(change.after)) {
    return change.after;
  }
  if (isPlainObject(resource.values)) {
    return resource.values;
  }
  if (isPlainObject(change.before)) {
    return change.before;
  }
  return {};
}

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

function getUnknownTopLevelKeys(afterUnknown) {
  if (!afterUnknown || typeof afterUnknown !== "object") {
    return [];
  }

  return Object.entries(afterUnknown)
    .filter(([, marker]) => hasUnknownAfterMarker(marker))
    .map(([key]) => key);
}

function shouldHideTerraformAttribute(resourceType, key) {
  const hidden = HIDDEN_ATTRIBUTES_BY_TYPE[resourceType];
  return Boolean(hidden && hidden.has(key));
}

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

function getOwningModulePath(nodePath) {
  const chain = getModulePathChain(nodePath);
  return chain.length ? chain[chain.length - 1] : null;
}

function getModuleRelativeResourcePath(nodePath, modulePath) {
  const prefix = `${modulePath}.`;
  if (!nodePath.startsWith(prefix)) {
    return nodePath;
  }
  return nodePath.slice(prefix.length);
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

function isLambdaModuleSource(source) {
  return source === LAMBDA_MODULE_SOURCE;
}

function isLikelyLambdaModule(resourceFragments, moduleGroup = null) {
  return (
    isLambdaModuleSource(moduleGroup?.source) ||
    (resourceFragments.has("aws_lambda_function.this") &&
      resourceFragments.has("aws_iam_role.lambda"))
  );
}

function applyModulePresets(
  positions,
  nodeKeys,
  moduleGroupByPath = new Map(),
) {
  const moduleMembers = new Map();

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
    const fragments = new Set(
      members.map((nodePath) =>
        getModuleRelativeResourcePath(nodePath, modulePath),
      ),
    );

    if (!isLikelyLambdaModule(fragments, moduleGroupByPath.get(modulePath))) {
      continue;
    }

    const anchorPath = `${modulePath}.aws_lambda_function.this`;
    const fallback = positions[members[0]];
    const anchor = positions[anchorPath] || fallback;
    if (!anchor) {
      continue;
    }

    for (const nodePath of members) {
      const fragment = getModuleRelativeResourcePath(nodePath, modulePath);
      const offset = LAMBDA_MODULE_PRESET_OFFSETS[fragment];
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

function normalizeRegion(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAccountId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^\d{12}$/.test(trimmed) ? trimmed : null;
}

function normalizeVpcId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^vpc-[0-9a-f]+$/i.test(trimmed) ? trimmed : null;
}

function normalizeSubnetId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^subnet-[0-9a-f]+$/i.test(trimmed) ? trimmed : null;
}

function collectAwsIdsFromValue(value, normalizer, out, depth = 0) {
  if (depth > 8 || value === null || typeof value === "undefined") {
    return;
  }

  const normalized = normalizer(value);
  if (normalized) {
    out.add(normalized);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectAwsIdsFromValue(entry, normalizer, out, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    for (const entry of Object.values(value)) {
      collectAwsIdsFromValue(entry, normalizer, out, depth + 1);
    }
  }
}

function extractVpcIdsFromConfig(config) {
  const ids = new Set();
  collectAwsIdsFromValue(config, normalizeVpcId, ids);
  return [...ids];
}

function extractSubnetIdsFromConfig(config) {
  const ids = new Set();
  collectAwsIdsFromValue(config, normalizeSubnetId, ids);
  return [...ids];
}

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

function buildNodeLocationMap(nodes) {
  const nodeLocations = new Map();
  const regionCounts = new Map();
  const accountCounts = new Map();

  for (const [nodePath, node] of Object.entries(nodes)) {
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

function buildNodeAdjacencyMap(nodes) {
  const adjacency = new Map();

  for (const nodePath of Object.keys(nodes)) {
    adjacency.set(nodePath, new Set());
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
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

function buildNodeVpcMap(nodes) {
  const nodeVpcMap = new Map();
  const anchorByNodePath = new Map();
  const vpcLabelByKey = new Map();
  const subnetVpcKeyMap = new Map();

  for (const [nodePath, node] of Object.entries(nodes)) {
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

function buildNodeSubnetMap(nodes, nodeVpcMap) {
  const nodeSubnetMap = new Map();
  const subnetAnchorByNodePath = new Map();
  const subnetLabelByKey = new Map();
  const subnetVpcKeyBySubnetKey = new Map();

  for (const [nodePath, node] of Object.entries(nodes)) {
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
    let subnetKey = null;
    let subnetLabel = null;
    let subnetVpcKey = null;

    if (subnetAnchorByNodePath.has(nodePath)) {
      const anchor = subnetAnchorByNodePath.get(nodePath);
      subnetKey = anchor.subnetKey;
      subnetLabel = anchor.subnetLabel;
      subnetVpcKey = subnetVpcKeyBySubnetKey.get(subnetKey) || null;
    } else {
      for (const resource of Object.values(node.resources || {})) {
        const config = getCurrentResourceConfig(resource);
        const explicitSubnetIds = extractSubnetIdsFromConfig(config);
        if (explicitSubnetIds.length > 0) {
          const subnetId = [...explicitSubnetIds].sort()[0];
          subnetKey = subnetId;
          subnetLabel = subnetId;
          subnetVpcKey = subnetVpcKeyBySubnetKey.get(subnetId) || null;
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
    });
  }

  return nodeSubnetMap;
}

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
        if (!vpcGroup.subnets.has(subnet.subnetKey)) {
          vpcGroup.subnets.set(subnet.subnetKey, {
            subnetKey: subnet.subnetKey,
            subnetLabel: subnet.subnetLabel,
            accountId,
            region,
            vpcKey: vpc.vpcKey,
            nodePaths: [],
          });
        }

        vpcGroup.subnets.get(subnet.subnetKey).nodePaths.push(nodePath);
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
    customData: { terraform: true },
    ...overrides,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getEdgePointTowardTarget(pos, w, h, target) {
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return {
      x: cx,
      y: cy,
      fixedPoint: [0.5, 0.5],
    };
  }

  const halfW = Math.max(w / 2, 1e-6);
  const halfH = Math.max(h / 2, 1e-6);
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  const x = cx + dx * scale;
  const y = cy + dy * scale;

  return {
    x,
    y,
    fixedPoint: [clamp((x - pos.x) / w, 0, 1), clamp((y - pos.y) / h, 0, 1)],
  };
}

function getCenterClippedBindingPoints(posA, posB, wA, hA, wB, hB) {
  const centerA = { x: posA.x + wA / 2, y: posA.y + hA / 2 };
  const centerB = { x: posB.x + wB / 2, y: posB.y + hB / 2 };

  const start = getEdgePointTowardTarget(posA, wA, hA, centerB);
  const end = getEdgePointTowardTarget(posB, wB, hB, centerA);

  return {
    startPoint: { x: start.x, y: start.y },
    endPoint: { x: end.x, y: end.y },
    // Keep focus points at centroids so bound arrows stay sensible after moves.
    startFixed: [0.5, 0.5],
    endFixed: [0.5, 0.5],
  };
}

// --- Edge collection ---

function collectDirectedEdges(nodes) {
  const edgeMap = new Map();

  const addEdge = (source, target, kind, origin) => {
    if (!nodes[source] || !nodes[target]) {
      return;
    }

    const key = `${source}|||${target}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.kinds.add(kind);
      existing.origins.add(origin);
      return;
    }

    edgeMap.set(key, {
      source,
      target,
      kinds: new Set([kind]),
      origins: new Set([origin]),
    });
  };

  for (const [nodePath, node] of Object.entries(nodes)) {
    for (const target of node.edges_new || []) {
      addEdge(nodePath, target, "planned_dependency", "dot");
    }
    for (const target of node.edges_existing || []) {
      addEdge(nodePath, target, "existing_dependency", "terraform_state");
    }
  }

  return [...edgeMap.values()].map((edge) => ({
    ...edge,
    kinds: [...edge.kinds],
    origins: [...edge.origins],
  }));
}

function coalesceRelationshipPairs(directedEdges) {
  const pairMap = new Map();

  for (const edge of directedEdges) {
    const pairKey = [edge.source, edge.target].sort().join("|||");
    const existing = pairMap.get(pairKey);

    if (!existing) {
      pairMap.set(pairKey, {
        key: pairKey,
        nodes: [edge.source, edge.target].sort(),
        directions: [edge],
      });
      continue;
    }

    existing.directions.push(edge);
  }

  return [...pairMap.values()].map((pair) => {
    const uniqueDirections = new Map();

    for (const direction of pair.directions) {
      uniqueDirections.set(
        `${direction.source}|||${direction.target}`,
        direction,
      );
    }

    const directions = [...uniqueDirections.values()];
    const isBidirectional = directions.length > 1;
    const [defaultSource, defaultTarget] = isBidirectional
      ? pair.nodes
      : [directions[0].source, directions[0].target];

    return {
      source: defaultSource,
      target: defaultTarget,
      directed: !isBidirectional,
      bidirectional: isBidirectional,
      directions: directions.map((direction) => ({
        source: direction.source,
        target: direction.target,
        kinds: direction.kinds,
        origins: direction.origins,
      })),
      kinds: [...new Set(directions.flatMap((direction) => direction.kinds))],
      origins: [
        ...new Set(directions.flatMap((direction) => direction.origins)),
      ],
    };
  });
}

// --- Force layout ---

async function forceLayout(
  nodeKeys,
  directedEdges,
  tierMap,
  tierConfigs,
  layoutSizes = {},
) {
  const d3 = await import("d3-force");

  const tiers = Object.values(tierMap);
  const minTier = Math.min(...tiers);
  const maxTier = Math.max(...tiers);
  const tierRange = maxTier - minTier || 1;

  const simNodes = nodeKeys.map((id) => ({
    id,
    tier: tierMap[id],
  }));

  const simLinks = directedEdges.map(({ source, target }) => ({
    source,
    target,
  }));
  const getCollisionRadius = (node) => {
    const size = layoutSizes[node.id];
    if (size) {
      return Math.max(size.w, size.h) / 2 + 90;
    }
    return tierConfigs[node.tier].collide;
  };

  const simulation = d3
    .forceSimulation(simNodes)
    .force(
      "charge",
      d3.forceManyBody().strength((d) => tierConfigs[d.tier].charge),
    )
    .force(
      "link",
      d3
        .forceLink(simLinks)
        .id((d) => d.id)
        .distance((link) => {
          // Prominent nodes (low tier number) push further apart
          const t1 = (link.source.tier - minTier) / tierRange;
          const t2 = (link.target.tier - minTier) / tierRange;
          const avgFrac = (t1 + t2) / 2;
          return Math.round(lerp(500, 150, avgFrac));
        })
        .strength((link) => {
          const maxRelTier =
            Math.max(link.source.tier, link.target.tier) - minTier;
          return maxRelTier >= 1 ? 1.2 : 0.7;
        }),
    )
    .force("center", d3.forceCenter(0, 0))
    .force("collide", d3.forceCollide().radius(getCollisionRadius))
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

function buildCollapsibleModuleSet(moduleGroups) {
  const collapsibleModules = new Set();

  for (const group of moduleGroups) {
    if (!group.source) {
      continue;
    }

    const parentModulePaths = getModulePathChain(
      `${group.modulePath}.placeholder`,
    ).slice(0, -1);
    if (
      parentModulePaths.some((modulePath) => collapsibleModules.has(modulePath))
    ) {
      continue;
    }

    collapsibleModules.add(group.modulePath);
  }

  return collapsibleModules;
}

function getCollapsedModulePath(nodePath, collapsibleModules) {
  const chain = getModulePathChain(nodePath)
    .filter((modulePath) => collapsibleModules.has(modulePath))
    .sort((a, b) => b.length - a.length);

  return chain[0] || null;
}

function buildCollapsedLayoutModel(
  nodeKeys,
  directedEdges,
  tierMap,
  collapsibleModules,
) {
  const nodeToLayoutId = new Map();
  const moduleMembers = new Map();
  const layoutNodeSet = new Set();

  for (const nodePath of nodeKeys) {
    const modulePath = getCollapsedModulePath(nodePath, collapsibleModules);
    const layoutId = modulePath || nodePath;
    nodeToLayoutId.set(nodePath, layoutId);
    layoutNodeSet.add(layoutId);

    if (modulePath) {
      if (!moduleMembers.has(modulePath)) {
        moduleMembers.set(modulePath, []);
      }
      moduleMembers.get(modulePath).push(nodePath);
    }
  }

  const layoutEdgeMap = new Map();
  for (const edge of directedEdges) {
    const source = nodeToLayoutId.get(edge.source);
    const target = nodeToLayoutId.get(edge.target);
    if (!source || !target || source === target) {
      continue;
    }

    const key = `${source}|||${target}`;
    if (!layoutEdgeMap.has(key)) {
      layoutEdgeMap.set(key, { source, target });
    }
  }

  const layoutTierMap = {};
  for (const layoutId of layoutNodeSet) {
    const members = moduleMembers.get(layoutId);
    layoutTierMap[layoutId] = members
      ? Math.min(...members.map((nodePath) => tierMap[nodePath]))
      : tierMap[layoutId];
  }

  return {
    layoutNodeKeys: [...layoutNodeSet],
    layoutEdges: [...layoutEdgeMap.values()],
    layoutTierMap,
    moduleMembers,
  };
}

function buildModuleInternalOffsets(members, modulePath, moduleGroup = null) {
  const offsets = {};
  const fragments = new Set(
    members.map((nodePath) =>
      getModuleRelativeResourcePath(nodePath, modulePath),
    ),
  );
  const useLambdaPreset = isLikelyLambdaModule(fragments, moduleGroup);
  const remaining = [];

  for (const nodePath of members) {
    const fragment = getModuleRelativeResourcePath(nodePath, modulePath);
    const offset = useLambdaPreset
      ? LAMBDA_MODULE_PRESET_OFFSETS[fragment]
      : null;

    if (offset) {
      offsets[nodePath] = offset;
    } else {
      remaining.push(nodePath);
    }
  }

  const columns = Math.min(3, Math.max(1, remaining.length));
  const rows = Math.ceil(remaining.length / columns);
  const gapX = 280;
  const gapY = 160;
  const startX = -((columns - 1) * gapX) / 2;
  const startY = useLambdaPreset ? 340 : -((rows - 1) * gapY) / 2;

  for (let index = 0; index < remaining.length; index++) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    offsets[remaining[index]] = {
      x: startX + col * gapX,
      y: startY + row * gapY,
    };
  }

  return offsets;
}

function estimateModuleLayoutSizes(
  moduleMembers,
  moduleGroupByPath,
  tierMap,
  tierConfigs,
) {
  const sizes = {};

  for (const [modulePath, members] of moduleMembers.entries()) {
    const moduleGroup = moduleGroupByPath.get(modulePath);
    const offsets = buildModuleInternalOffsets(
      members,
      modulePath,
      moduleGroup,
    );
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const nodePath of members) {
      const offset = offsets[nodePath];
      const cfg = tierConfigs[tierMap[nodePath]];
      if (!offset || !cfg) {
        continue;
      }

      minX = Math.min(minX, offset.x);
      minY = Math.min(minY, offset.y);
      maxX = Math.max(maxX, offset.x + cfg.w);
      maxY = Math.max(maxY, offset.y + cfg.h);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      continue;
    }

    sizes[modulePath] = {
      w: maxX - minX + 120,
      h: maxY - minY + 120,
    };
  }

  return sizes;
}

function expandCollapsedModulePositions(
  layoutPositions,
  nodeKeys,
  moduleMembers,
  moduleGroupByPath,
) {
  const positions = {};
  const collapsedNodeSet = new Set(
    [...moduleMembers.values()].flatMap((members) => members),
  );

  for (const nodePath of nodeKeys) {
    if (!collapsedNodeSet.has(nodePath)) {
      positions[nodePath] = layoutPositions[nodePath];
    }
  }

  for (const [modulePath, members] of moduleMembers.entries()) {
    const anchor = layoutPositions[modulePath];
    if (!anchor) {
      continue;
    }

    const moduleGroup = moduleGroupByPath.get(modulePath);
    const offsets = buildModuleInternalOffsets(
      members,
      modulePath,
      moduleGroup,
    );

    for (const nodePath of members) {
      const offset = offsets[nodePath];
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

// --- Main conversion ---

async function nodesToExcalidraw(nodes) {
  const nodeElements = [];
  const locationElements = [];
  const moduleElements = [];
  const arrowElements = [];
  const nodeKeys = Object.keys(nodes);
  const directedEdges = collectDirectedEdges(nodes);
  const relationships = coalesceRelationshipPairs(directedEdges);
  const nodeLocationMap = buildNodeLocationMap(nodes);
  const nodeVpcMap = buildNodeVpcMap(nodes);
  const nodeSubnetMap = buildNodeSubnetMap(nodes, nodeVpcMap);
  const accountRegionGroups = collectAccountRegionGroups(
    nodeKeys,
    nodeLocationMap,
    nodeVpcMap,
    nodeSubnetMap,
  );
  const moduleGroups = collectModuleGroups(nodeKeys, nodes);
  const moduleGroupIdByPath = new Map(
    moduleGroups.map((group) => [group.modulePath, `module-group-${rand()}`]),
  );
  const moduleGroupByPath = new Map(
    moduleGroups.map((group) => [group.modulePath, group]),
  );

  const tierMap = buildTierMap(nodeKeys);
  const collapsibleModules = buildCollapsibleModuleSet(moduleGroups);
  const { layoutNodeKeys, layoutEdges, layoutTierMap, moduleMembers } =
    buildCollapsedLayoutModel(
      nodeKeys,
      directedEdges,
      tierMap,
      collapsibleModules,
    );
  const tierConfigs = buildTierConfigs(tierMap, nodeKeys.length);
  const layoutTierConfigs = buildTierConfigs(
    layoutTierMap,
    layoutNodeKeys.length,
  );
  const layoutSizes = estimateModuleLayoutSizes(
    moduleMembers,
    moduleGroupByPath,
    tierMap,
    tierConfigs,
  );

  const layoutPositions = await forceLayout(
    layoutNodeKeys,
    layoutEdges,
    layoutTierMap,
    layoutTierConfigs,
    layoutSizes,
  );
  const positions = expandCollapsedModulePositions(
    layoutPositions,
    nodeKeys,
    moduleMembers,
    moduleGroupByPath,
  );
  applyModulePresets(positions, nodeKeys, moduleGroupByPath);
  const posMap = {};
  const nodeRectById = new Map();

  // --- rectangles + labels + icons ---
  for (let i = 0; i < nodeKeys.length; i++) {
    const nodePath = nodeKeys[i];
    const tier = tierMap[nodePath];
    const cfg = tierConfigs[tier];
    const { x, y } = positions[nodePath];
    const resourceType = getResourceType(nodePath);
    const groupId = `node-${rand()}`;
    const moduleGroupIds = getModulePathChain(nodePath)
      .reverse()
      .map((modulePath) => moduleGroupIdByPath.get(modulePath))
      .filter(Boolean);
    const groupIds = [groupId, ...moduleGroupIds];

    const rectId = `rect-${i}`;
    const textId = `text-${i}`;
    posMap[nodePath] = { x, y, w: cfg.w, h: cfg.h, rectId, textId };

    const action = getPrimaryAction(nodes[nodePath]);
    const bgColor = ACTION_COLORS[action] || ACTION_COLORS.existing;
    const strokeColor = ACTION_STROKE[action] || ACTION_STROKE.existing;
    const label = getLabel(nodePath);
    const terraformResources = buildTerraformResourceDetails(nodes[nodePath]);
    const nodeLocation = nodeLocationMap.get(nodePath) || null;
    const nodeVpc = nodeVpcMap.get(nodePath) || null;
    const nodeSubnet = nodeSubnetMap.get(nodePath) || null;

    // Check for icon
    const iconElements = cfg.iconSize > 0 ? getIconForType(resourceType) : null;
    const hasIcon = iconElements && iconElements.length > 0;
    const iconPad = 12;
    const iconArea = hasIcon ? cfg.iconSize + iconPad : 0;

    const rectElement = makeBaseElement({
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
      groupIds,
      boundElements: [{ id: textId, type: "text" }],
      strokeStyle: action === "external" ? "dashed" : "solid",
      customData: {
        terraform: true,
        resourceType,
        nodePath,
        action,
        region: nodeLocation?.region || null,
        accountId: nodeLocation?.accountId || null,
        vpcId: nodeVpc?.vpcKey || null,
        vpcLabel: nodeVpc?.vpcLabel || null,
        subnetId: nodeSubnet?.subnetKey || null,
        subnetLabel: nodeSubnet?.subnetLabel || null,
        terraformResources,
      },
    });
    nodeElements.push(rectElement);
    nodeRectById.set(rectId, rectElement);

    // Text: shifted right if icon present
    const textX = x + iconArea + 8;
    const textW = cfg.w - iconArea - 16;

    nodeElements.push(
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
        groupIds,
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
        groupIds,
      );
      nodeElements.push(...clonedIcons);
    }
  }

  // --- module grouping boxes ---
  const MODULE_STROKES = ["#5c7cfa", "#339af0", "#22b8cf", "#20c997"];
  const MODULE_PADDING_X = 28;
  const MODULE_PADDING_TOP = 42;
  const MODULE_PADDING_BOTTOM = 20;
  const moduleBoundsByPath = new Map();

  for (let i = 0; i < moduleGroups.length; i++) {
    const group = moduleGroups[i];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const nodePath of group.nodePaths) {
      const pos = posMap[nodePath];
      if (!pos) {
        continue;
      }
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.w);
      maxY = Math.max(maxY, pos.y + pos.h);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      continue;
    }

    const depthInset = Math.max(0, (group.depth - 1) * 6);
    const padX = Math.max(14, MODULE_PADDING_X - depthInset);
    const padTop = Math.max(28, MODULE_PADDING_TOP - depthInset);
    const padBottom = MODULE_PADDING_BOTTOM;
    const boxX = minX - padX;
    const boxY = minY - padTop;
    const boxW = maxX - minX + padX * 2;
    const boxH = maxY - minY + padTop + padBottom;
    moduleBoundsByPath.set(group.modulePath, {
      x: boxX,
      y: boxY,
      w: boxW,
      h: boxH,
    });
    const groupId = moduleGroupIdByPath.get(group.modulePath);
    const parentGroupIds = getModulePathChain(group.modulePath)
      .slice(0, -1)
      .reverse()
      .map((modulePath) => moduleGroupIdByPath.get(modulePath))
      .filter(Boolean);
    const boxGroupIds = [groupId, ...parentGroupIds];
    const boxId = `module-box-${i}`;
    const labelId = `module-label-${i}`;
    const strokeColor =
      MODULE_STROKES[(group.depth - 1) % MODULE_STROKES.length];

    moduleElements.push(
      makeBaseElement({
        type: "rectangle",
        id: boxId,
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        strokeColor,
        strokeWidth: group.depth <= 1 ? 2 : 1,
        strokeStyle: "dashed",
        backgroundColor: "transparent",
        roundness: { type: 3 },
        groupIds: boxGroupIds,
        boundElements: [{ id: labelId, type: "text" }],
        customData: {
          terraform: false,
          terraformModuleGroup: true,
          modulePath: group.modulePath,
          moduleDepth: group.depth,
          moduleSource: group.source,
          moduleVersion: group.version,
        },
      }),
    );

    moduleElements.push(
      makeBaseElement({
        type: "text",
        id: labelId,
        x: boxX + 10,
        y: boxY + 8,
        width: Math.max(80, boxW - 20),
        height: 24,
        text: `module ${group.moduleLabel}`,
        fontSize: group.depth <= 1 ? 18 : 16,
        fontFamily: 3,
        textAlign: "left",
        verticalAlign: "top",
        groupIds: boxGroupIds,
        containerId: boxId,
        originalText: `module ${group.moduleLabel}`,
        autoResize: false,
        lineHeight: 1.2,
        strokeColor,
        customData: {
          terraform: false,
          terraformModuleGroup: true,
          modulePath: group.modulePath,
          moduleSource: group.source,
          moduleVersion: group.version,
        },
      }),
    );
  }

  const getVisualBoundsForNodePath = (nodePath) => {
    const modulePath = getOwningModulePath(nodePath);
    if (modulePath && moduleBoundsByPath.has(modulePath)) {
      return moduleBoundsByPath.get(modulePath);
    }
    return posMap[nodePath];
  };

  const getUniqueVisualBounds = (nodePaths) => {
    const boundsByKey = new Map();

    for (const nodePath of nodePaths) {
      const modulePath = getOwningModulePath(nodePath);
      const key =
        modulePath && moduleBoundsByPath.has(modulePath)
          ? modulePath
          : nodePath;
      const bounds = getVisualBoundsForNodePath(nodePath);
      if (bounds && !boundsByKey.has(key)) {
        boundsByKey.set(key, bounds);
      }
    }

    return [...boundsByKey.values()];
  };

  const measureBounds = (boundsList) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const bounds of boundsList) {
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.w);
      maxY = Math.max(maxY, bounds.y + bounds.h);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return null;
    }

    return { minX, minY, maxX, maxY };
  };

  // --- account / region grouping boxes ---
  const ACCOUNT_STROKE = "#0b7285";
  const REGION_STROKE = "#1864ab";
  const ACCOUNT_PADDING_X = 44;
  const ACCOUNT_PADDING_TOP = 56;
  const ACCOUNT_PADDING_BOTTOM = 28;
  const REGION_PADDING_X = 24;
  const REGION_PADDING_TOP = 40;
  const REGION_PADDING_BOTTOM = 18;
  const VPC_STROKE = "#2b8a3e";
  const VPC_PADDING_X = 14;
  const VPC_PADDING_TOP = 32;
  const VPC_PADDING_BOTTOM = 12;
  const SUBNET_STROKE = "#099268";
  const SUBNET_PADDING_X = 10;
  const SUBNET_PADDING_TOP = 26;
  const SUBNET_PADDING_BOTTOM = 10;

  let accountBoxIndex = 0;
  let regionBoxIndex = 0;
  let vpcBoxIndex = 0;
  for (const accountGroup of accountRegionGroups) {
    const accountBounds = measureBounds(
      getUniqueVisualBounds(accountGroup.nodePaths),
    );
    if (!accountBounds) {
      continue;
    }

    const accountGroupId = `account-group-${rand()}`;
    const accountBoxX = accountBounds.minX - ACCOUNT_PADDING_X;
    const accountBoxY = accountBounds.minY - ACCOUNT_PADDING_TOP;
    const accountBoxW =
      accountBounds.maxX - accountBounds.minX + ACCOUNT_PADDING_X * 2;
    const accountBoxH =
      accountBounds.maxY -
      accountBounds.minY +
      ACCOUNT_PADDING_TOP +
      ACCOUNT_PADDING_BOTTOM;
    const accountBoxId = `account-box-${accountBoxIndex}`;
    const accountLabelId = `account-label-${accountBoxIndex}`;
    accountBoxIndex += 1;

    locationElements.push(
      makeBaseElement({
        type: "rectangle",
        id: accountBoxId,
        x: accountBoxX,
        y: accountBoxY,
        width: accountBoxW,
        height: accountBoxH,
        strokeColor: ACCOUNT_STROKE,
        strokeWidth: 2,
        strokeStyle: "solid",
        backgroundColor: "transparent",
        roundness: { type: 3 },
        groupIds: [accountGroupId],
        boundElements: [{ id: accountLabelId, type: "text" }],
        customData: {
          terraform: false,
          terraformAccountGroup: true,
          accountId: accountGroup.accountId,
        },
      }),
    );

    locationElements.push(
      makeBaseElement({
        type: "text",
        id: accountLabelId,
        x: accountBoxX + 10,
        y: accountBoxY + 8,
        width: Math.max(120, accountBoxW - 20),
        height: 24,
        text: `account ${accountGroup.accountId}`,
        fontSize: 18,
        fontFamily: 3,
        textAlign: "left",
        verticalAlign: "top",
        groupIds: [accountGroupId],
        containerId: accountBoxId,
        originalText: `account ${accountGroup.accountId}`,
        autoResize: false,
        lineHeight: 1.2,
        strokeColor: ACCOUNT_STROKE,
        customData: {
          terraform: false,
          terraformAccountGroup: true,
          accountId: accountGroup.accountId,
        },
      }),
    );

    for (const regionGroup of accountGroup.regions) {
      const regionBounds = measureBounds(
        getUniqueVisualBounds(regionGroup.nodePaths),
      );
      if (!regionBounds) {
        continue;
      }

      const regionGroupId = `region-group-${rand()}`;
      const regionBoxX = regionBounds.minX - REGION_PADDING_X;
      const regionBoxY = regionBounds.minY - REGION_PADDING_TOP;
      const regionBoxW =
        regionBounds.maxX - regionBounds.minX + REGION_PADDING_X * 2;
      const regionBoxH =
        regionBounds.maxY -
        regionBounds.minY +
        REGION_PADDING_TOP +
        REGION_PADDING_BOTTOM;
      const regionBoxId = `region-box-${regionBoxIndex}`;
      const regionLabelId = `region-label-${regionBoxIndex}`;
      regionBoxIndex += 1;

      const regionGroupIds = [regionGroupId, accountGroupId];

      locationElements.push(
        makeBaseElement({
          type: "rectangle",
          id: regionBoxId,
          x: regionBoxX,
          y: regionBoxY,
          width: regionBoxW,
          height: regionBoxH,
          strokeColor: REGION_STROKE,
          strokeWidth: 1,
          strokeStyle: "dashed",
          backgroundColor: "transparent",
          roundness: { type: 3 },
          groupIds: regionGroupIds,
          boundElements: [{ id: regionLabelId, type: "text" }],
          customData: {
            terraform: false,
            terraformRegionGroup: true,
            accountId: regionGroup.accountId,
            region: regionGroup.region,
          },
        }),
      );

      locationElements.push(
        makeBaseElement({
          type: "text",
          id: regionLabelId,
          x: regionBoxX + 10,
          y: regionBoxY + 8,
          width: Math.max(100, regionBoxW - 20),
          height: 22,
          text: `region ${regionGroup.region}`,
          fontSize: 16,
          fontFamily: 3,
          textAlign: "left",
          verticalAlign: "top",
          groupIds: regionGroupIds,
          containerId: regionBoxId,
          originalText: `region ${regionGroup.region}`,
          autoResize: false,
          lineHeight: 1.2,
          strokeColor: REGION_STROKE,
          customData: {
            terraform: false,
            terraformRegionGroup: true,
            accountId: regionGroup.accountId,
            region: regionGroup.region,
          },
        }),
      );

      for (const vpcGroup of regionGroup.vpcs || []) {
        const vpcBounds = measureBounds(
          getUniqueVisualBounds(vpcGroup.nodePaths),
        );
        if (!vpcBounds) {
          continue;
        }

        const vpcGroupId = `vpc-group-${rand()}`;
        const vpcBoxX = vpcBounds.minX - VPC_PADDING_X;
        const vpcBoxY = vpcBounds.minY - VPC_PADDING_TOP;
        const vpcBoxW = vpcBounds.maxX - vpcBounds.minX + VPC_PADDING_X * 2;
        const vpcBoxH =
          vpcBounds.maxY -
          vpcBounds.minY +
          VPC_PADDING_TOP +
          VPC_PADDING_BOTTOM;
        const vpcBoxId = `vpc-box-${vpcBoxIndex}`;
        const vpcLabelId = `vpc-label-${vpcBoxIndex}`;
        vpcBoxIndex += 1;

        const vpcGroupIds = [vpcGroupId, regionGroupId, accountGroupId];

        locationElements.push(
          makeBaseElement({
            type: "rectangle",
            id: vpcBoxId,
            x: vpcBoxX,
            y: vpcBoxY,
            width: vpcBoxW,
            height: vpcBoxH,
            strokeColor: VPC_STROKE,
            strokeWidth: 1,
            strokeStyle: "dashed",
            backgroundColor: "transparent",
            roundness: { type: 3 },
            groupIds: vpcGroupIds,
            boundElements: [{ id: vpcLabelId, type: "text" }],
            customData: {
              terraform: false,
              terraformVpcGroup: true,
              accountId: vpcGroup.accountId,
              region: vpcGroup.region,
              vpcId: vpcGroup.vpcKey,
              vpcLabel: vpcGroup.vpcLabel,
            },
          }),
        );

        locationElements.push(
          makeBaseElement({
            type: "text",
            id: vpcLabelId,
            x: vpcBoxX + 10,
            y: vpcBoxY + 8,
            width: Math.max(90, vpcBoxW - 20),
            height: 20,
            text: `vpc ${vpcGroup.vpcLabel}`,
            fontSize: 14,
            fontFamily: 3,
            textAlign: "left",
            verticalAlign: "top",
            groupIds: vpcGroupIds,
            containerId: vpcBoxId,
            originalText: `vpc ${vpcGroup.vpcLabel}`,
            autoResize: false,
            lineHeight: 1.2,
            strokeColor: VPC_STROKE,
            customData: {
              terraform: false,
              terraformVpcGroup: true,
              accountId: vpcGroup.accountId,
              region: vpcGroup.region,
              vpcId: vpcGroup.vpcKey,
              vpcLabel: vpcGroup.vpcLabel,
            },
          }),
        );

        for (const subnetGroup of vpcGroup.subnets || []) {
          const subnetBounds = measureBounds(
            getUniqueVisualBounds(subnetGroup.nodePaths),
          );
          if (!subnetBounds) {
            continue;
          }

          const subnetGroupId = `subnet-group-${rand()}`;
          const subnetBoxX = subnetBounds.minX - SUBNET_PADDING_X;
          const subnetBoxY = subnetBounds.minY - SUBNET_PADDING_TOP;
          const subnetBoxW =
            subnetBounds.maxX - subnetBounds.minX + SUBNET_PADDING_X * 2;
          const subnetBoxH =
            subnetBounds.maxY -
            subnetBounds.minY +
            SUBNET_PADDING_TOP +
            SUBNET_PADDING_BOTTOM;
          const subnetBoxId = `subnet-box-${vpcBoxIndex}-${rand()}`;
          const subnetLabelId = `subnet-label-${vpcBoxIndex}-${rand()}`;

          const subnetGroupIds = [
            subnetGroupId,
            vpcGroupId,
            regionGroupId,
            accountGroupId,
          ];

          locationElements.push(
            makeBaseElement({
              type: "rectangle",
              id: subnetBoxId,
              x: subnetBoxX,
              y: subnetBoxY,
              width: subnetBoxW,
              height: subnetBoxH,
              strokeColor: SUBNET_STROKE,
              strokeWidth: 1,
              strokeStyle: "dashed",
              backgroundColor: "transparent",
              roundness: { type: 3 },
              groupIds: subnetGroupIds,
              boundElements: [{ id: subnetLabelId, type: "text" }],
              customData: {
                terraform: false,
                terraformSubnetGroup: true,
                accountId: subnetGroup.accountId,
                region: subnetGroup.region,
                vpcId: subnetGroup.vpcKey,
                subnetId: subnetGroup.subnetKey,
                subnetLabel: subnetGroup.subnetLabel,
              },
            }),
          );

          locationElements.push(
            makeBaseElement({
              type: "text",
              id: subnetLabelId,
              x: subnetBoxX + 8,
              y: subnetBoxY + 6,
              width: Math.max(86, subnetBoxW - 16),
              height: 18,
              text: `subnet ${subnetGroup.subnetLabel}`,
              fontSize: 13,
              fontFamily: 3,
              textAlign: "left",
              verticalAlign: "top",
              groupIds: subnetGroupIds,
              containerId: subnetBoxId,
              originalText: `subnet ${subnetGroup.subnetLabel}`,
              autoResize: false,
              lineHeight: 1.2,
              strokeColor: SUBNET_STROKE,
              customData: {
                terraform: false,
                terraformSubnetGroup: true,
                accountId: subnetGroup.accountId,
                region: subnetGroup.region,
                vpcId: subnetGroup.vpcKey,
                subnetId: subnetGroup.subnetKey,
                subnetLabel: subnetGroup.subnetLabel,
              },
            }),
          );
        }
      }
    }
  }

  // --- dependency lines ---
  let arrowIdx = 0;
  for (const relationship of relationships) {
    const {
      source,
      target,
      directed,
      bidirectional,
      directions,
      kinds,
      origins,
    } = relationship;
    const posA = posMap[source];
    const posB = posMap[target];
    const arrowId = `arrow-${arrowIdx++}`;

    const rectA = nodeRectById.get(posA.rectId);
    const rectB = nodeRectById.get(posB.rectId);
    if (!rectA || !rectB) {
      continue;
    }
    rectA.boundElements.push({ id: arrowId, type: "arrow" });
    rectB.boundElements.push({ id: arrowId, type: "arrow" });

    const { startFixed, endFixed, startPoint, endPoint } =
      getCenterClippedBindingPoints(posA, posB, posA.w, posA.h, posB.w, posB.h);

    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;

    arrowElements.push(
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
        startArrowhead: null,
        endArrowhead: null,
        strokeStyle: "solid",
        roundness: { type: 2 },
        customData: {
          terraform: true,
          relationship: {
            source,
            target,
            directions,
            kinds,
            origins,
            directed,
            bidirectional,
          },
        },
      }),
    );
  }

  const elementsOrdered = [
    ...arrowElements,
    ...locationElements,
    ...moduleElements,
    ...nodeElements,
  ];

  return {
    type: "excalidraw",
    version: 2,
    source: "terraform-pipeline",
    elements: elementsOrdered,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null,
    },
  };
}

module.exports = { nodesToExcalidraw };
