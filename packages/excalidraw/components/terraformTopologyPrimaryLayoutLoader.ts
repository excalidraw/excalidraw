/**
 * Load per–primary-type JSON layout files (no satellite registry dependency).
 */

import defaultLayoutJson from "../assets/terraform-topology-primary-layouts/default.json";
import awsLambdaLayoutJson from "../assets/terraform-topology-primary-layouts/aws_lambda_function.json";
import awsEcsServiceLayoutJson from "../assets/terraform-topology-primary-layouts/aws_ecs_service.json";
import awsApiGatewayLayoutJson from "../assets/terraform-topology-primary-layouts/aws_api_gateway_rest_api.json";
import awsApiGatewayV2LayoutJson from "../assets/terraform-topology-primary-layouts/aws_apigatewayv2_api.json";
import awsS3BucketLayoutJson from "../assets/terraform-topology-primary-layouts/aws_s3_bucket.json";
import awsTgwLayoutJson from "../assets/terraform-topology-primary-layouts/aws_ec2_transit_gateway.json";
import awsLbLayoutJson from "../assets/terraform-topology-primary-layouts/aws_lb.json";
import awsRdsClusterLayoutJson from "../assets/terraform-topology-primary-layouts/aws_rds_cluster.json";
import awsRdsClusterInstanceLayoutJson from "../assets/terraform-topology-primary-layouts/aws_rds_cluster_instance.json";
import awsDbInstanceLayoutJson from "../assets/terraform-topology-primary-layouts/aws_db_instance.json";
import awsDynamodbTableLayoutJson from "../assets/terraform-topology-primary-layouts/aws_dynamodb_table.json";
import awsEksClusterLayoutJson from "../assets/terraform-topology-primary-layouts/aws_eks_cluster.json";
import awsMskClusterLayoutJson from "../assets/terraform-topology-primary-layouts/aws_msk_cluster.json";
import awsKinesisStreamLayoutJson from "../assets/terraform-topology-primary-layouts/aws_kinesis_stream.json";
import awsKinesisFirehoseLayoutJson from "../assets/terraform-topology-primary-layouts/aws_kinesis_firehose_delivery_stream.json";
import awsGlueJobLayoutJson from "../assets/terraform-topology-primary-layouts/aws_glue_job.json";
import awsGlueCrawlerLayoutJson from "../assets/terraform-topology-primary-layouts/aws_glue_crawler.json";
import awsSnsTopicLayoutJson from "../assets/terraform-topology-primary-layouts/aws_sns_topic.json";
import awsSqsQueueLayoutJson from "../assets/terraform-topology-primary-layouts/aws_sqs_queue.json";
import awsCloudwatchEventRuleLayoutJson from "../assets/terraform-topology-primary-layouts/aws_cloudwatch_event_rule.json";
import awsCloudwatchEventBusLayoutJson from "../assets/terraform-topology-primary-layouts/aws_cloudwatch_event_bus.json";
import awsSchedulerScheduleLayoutJson from "../assets/terraform-topology-primary-layouts/aws_scheduler_schedule.json";
import awsElasticacheClusterLayoutJson from "../assets/terraform-topology-primary-layouts/aws_elasticache_cluster.json";
import awsElasticacheReplicationGroupLayoutJson from "../assets/terraform-topology-primary-layouts/aws_elasticache_replication_group.json";
import awsRedshiftClusterLayoutJson from "../assets/terraform-topology-primary-layouts/aws_redshift_cluster.json";
import awsOpensearchDomainLayoutJson from "../assets/terraform-topology-primary-layouts/aws_opensearch_domain.json";
import awsElasticsearchDomainLayoutJson from "../assets/terraform-topology-primary-layouts/aws_elasticsearch_domain.json";
import awsEfsFileSystemLayoutJson from "../assets/terraform-topology-primary-layouts/aws_efs_file_system.json";
import awsKmsKeyLayoutJson from "../assets/terraform-topology-primary-layouts/aws_kms_key.json";
import awsEmrClusterLayoutJson from "../assets/terraform-topology-primary-layouts/aws_emr_cluster.json";
import awsBatchComputeEnvironmentLayoutJson from "../assets/terraform-topology-primary-layouts/aws_batch_compute_environment.json";
import awsBatchJobDefinitionLayoutJson from "../assets/terraform-topology-primary-layouts/aws_batch_job_definition.json";
import awsInstanceLayoutJson from "../assets/terraform-topology-primary-layouts/aws_instance.json";

import {
  validateTopologyPrimaryLayoutJson,
  type TopologyPrimaryLayoutJson,
} from "./terraformTopologyPrimaryLayoutTypes";

const RAW_LAYOUTS: TopologyPrimaryLayoutJson[] = [
  validateTopologyPrimaryLayoutJson(defaultLayoutJson),
  // Compute
  validateTopologyPrimaryLayoutJson(awsLambdaLayoutJson),
  validateTopologyPrimaryLayoutJson(awsEcsServiceLayoutJson),
  validateTopologyPrimaryLayoutJson(awsEksClusterLayoutJson),
  validateTopologyPrimaryLayoutJson(awsEmrClusterLayoutJson),
  validateTopologyPrimaryLayoutJson(awsBatchComputeEnvironmentLayoutJson),
  validateTopologyPrimaryLayoutJson(awsBatchJobDefinitionLayoutJson),
  validateTopologyPrimaryLayoutJson(awsInstanceLayoutJson),
  validateTopologyPrimaryLayoutJson(awsGlueJobLayoutJson),
  validateTopologyPrimaryLayoutJson(awsGlueCrawlerLayoutJson),
  // API / networking
  validateTopologyPrimaryLayoutJson(awsApiGatewayLayoutJson),
  validateTopologyPrimaryLayoutJson(awsApiGatewayV2LayoutJson),
  validateTopologyPrimaryLayoutJson(awsLbLayoutJson),
  validateTopologyPrimaryLayoutJson(awsTgwLayoutJson),
  // Storage
  validateTopologyPrimaryLayoutJson(awsS3BucketLayoutJson),
  validateTopologyPrimaryLayoutJson(awsDynamodbTableLayoutJson),
  validateTopologyPrimaryLayoutJson(awsRdsClusterLayoutJson),
  validateTopologyPrimaryLayoutJson(awsRdsClusterInstanceLayoutJson),
  validateTopologyPrimaryLayoutJson(awsDbInstanceLayoutJson),
  validateTopologyPrimaryLayoutJson(awsElasticacheClusterLayoutJson),
  validateTopologyPrimaryLayoutJson(awsElasticacheReplicationGroupLayoutJson),
  validateTopologyPrimaryLayoutJson(awsRedshiftClusterLayoutJson),
  validateTopologyPrimaryLayoutJson(awsOpensearchDomainLayoutJson),
  validateTopologyPrimaryLayoutJson(awsElasticsearchDomainLayoutJson),
  validateTopologyPrimaryLayoutJson(awsEfsFileSystemLayoutJson),
  validateTopologyPrimaryLayoutJson(awsKmsKeyLayoutJson),
  // Messaging / streaming
  validateTopologyPrimaryLayoutJson(awsMskClusterLayoutJson),
  validateTopologyPrimaryLayoutJson(awsKinesisStreamLayoutJson),
  validateTopologyPrimaryLayoutJson(awsKinesisFirehoseLayoutJson),
  validateTopologyPrimaryLayoutJson(awsSnsTopicLayoutJson),
  validateTopologyPrimaryLayoutJson(awsSqsQueueLayoutJson),
  validateTopologyPrimaryLayoutJson(awsCloudwatchEventRuleLayoutJson),
  validateTopologyPrimaryLayoutJson(awsCloudwatchEventBusLayoutJson),
  validateTopologyPrimaryLayoutJson(awsSchedulerScheduleLayoutJson),
];

const LAYOUT_BY_PRIMARY_TYPE = new Map<string, TopologyPrimaryLayoutJson>();
for (const layout of RAW_LAYOUTS) {
  LAYOUT_BY_PRIMARY_TYPE.set(layout.primaryType, layout);
}

export function getRegisteredTopologyPrimaryLayoutTypes(): string[] {
  return [...LAYOUT_BY_PRIMARY_TYPE.keys()].sort();
}

export function getTopologyPrimaryLayoutJson(
  primaryType: string,
): TopologyPrimaryLayoutJson {
  return (
    LAYOUT_BY_PRIMARY_TYPE.get(primaryType) ??
    LAYOUT_BY_PRIMARY_TYPE.get("default")!
  );
}

/** @internal tests */
export const __topologyPrimaryLayoutsForTest = RAW_LAYOUTS;
