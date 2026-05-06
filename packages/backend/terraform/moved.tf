# State moves for renames. Flat module.vpce_* roots cannot share a "moved" target with nested paths; use `tofu state mv` if needed.

moved {
  from = module.lambda_vpc
  to   = module.private_workload_network.module.vpc
}

moved {
  from = module.vpc_private_endpoints
  to   = module.private_workload_network
}

moved {
  from = module.private_workload_network.module.vpce_security_group
  to   = module.private_workload_network.module.interface_endpoint_security_group
}

moved {
  from = module.private_workload_network.module.vpc_endpoints
  to   = module.private_workload_network.module.managed_service_endpoints
}

# Root module semantic renames
moved {
  from = module.data_bucket
  to   = module.application_data_bucket
}

moved {
  from = module.data_queue
  to   = module.application_job_queue
}

moved {
  from = module.lambda_writer
  to   = module.workload_writer_lambda
}

moved {
  from = module.lambda_reader
  to   = module.workload_reader_lambda
}

moved {
  from = module.lambda_monitoring
  to   = module.workload_monitoring_lambda
}

# Deployment artifact bucket / object (Terraform resource addresses only)
moved {
  from = data.archive_file.lambda_package
  to   = data.archive_file.lambda_deployment_package
}

moved {
  from = aws_s3_bucket.lambda_artifacts
  to   = aws_s3_bucket.lambda_deployment_artifacts
}

moved {
  from = aws_s3_bucket_public_access_block.lambda_artifacts
  to   = aws_s3_bucket_public_access_block.lambda_deployment_artifacts
}

moved {
  from = aws_s3_bucket_versioning.lambda_artifacts
  to   = aws_s3_bucket_versioning.lambda_deployment_artifacts
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.lambda_artifacts
  to   = aws_s3_bucket_server_side_encryption_configuration.lambda_deployment_artifacts
}

moved {
  from = data.aws_iam_policy_document.lambda_artifacts_tls
  to   = data.aws_iam_policy_document.lambda_deployment_artifacts_tls_only
}

moved {
  from = aws_s3_bucket_policy.lambda_artifacts
  to   = aws_s3_bucket_policy.lambda_deployment_artifacts
}

moved {
  from = aws_s3_object.lambda_zip
  to   = aws_s3_object.lambda_deployment_package
}

# VPC flow logs resources
moved {
  from = data.aws_iam_policy_document.vpc_flow_logs_assume
  to   = data.aws_iam_policy_document.vpc_flow_logs_publish_assume
}

moved {
  from = aws_iam_role.vpc_flow_logs
  to   = aws_iam_role.vpc_flow_logs_publish
}

moved {
  from = aws_cloudwatch_log_group.vpc_flow
  to   = aws_cloudwatch_log_group.workload_vpc_flow
}

moved {
  from = aws_flow_log.lambda_vpc
  to   = aws_flow_log.workload_vpc_all_traffic
}
