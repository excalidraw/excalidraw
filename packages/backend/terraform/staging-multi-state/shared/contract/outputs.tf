output "environment" {
  value = local.environment
}

output "regions" {
  value = local.regions
}

output "vpc_names" {
  value = local.vpc_names
}

output "vpc_cidrs" {
  value = local.vpc_cidrs
}

output "all_peer_cidrs" {
  value = local.all_peer_cidrs
}

output "subnet_cidrs" {
  value = local.subnet_cidrs
}

output "tgw_asns" {
  value = local.tgw_asns
}

output "tgw_names" {
  value = local.tgw_names
}

output "api_logical_names" {
  value = local.api_logical_names
}

output "api_gateway_names" {
  value = local.api_gateway_names
}

output "ingress_queue_name" {
  value = local.ingress_queue_name
}

output "egress_queue_name" {
  value = local.egress_queue_name
}

output "sqs_consumer_lambda_name" {
  value = local.sqs_consumer_lambda_name
}

output "producer_ecs_name" {
  value = local.producer_ecs_name
}

output "egress_ecs_name" {
  value = local.egress_ecs_name
}

output "dynamodb_table_names" {
  value = local.dynamodb_table_names
}

output "rds_identifiers" {
  value = local.rds_identifiers
}

output "aurora_identifiers" {
  value = local.aurora_identifiers
}

output "s3_bucket_names" {
  value = local.s3_bucket_names
}

output "lambda_artifacts_bucket_names" {
  value = local.lambda_artifacts_bucket_names
}

output "lambda_artifacts_bucket_suffixes" {
  value = local.lambda_artifacts_bucket_suffixes
}

output "apigw_cloudwatch_role_names" {
  value = local.apigw_cloudwatch_role_names
}

output "api_stage_name" {
  value = local.api_stage_name
}
