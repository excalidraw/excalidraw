# Deployment artifact bucket moves into terraform-aws-modules/s3-bucket/aws.
moved {
  from = aws_s3_bucket.lambda_deployment_artifacts
  to   = module.lambda_deployment_artifacts.aws_s3_bucket.this[0]
}

moved {
  from = aws_s3_bucket_public_access_block.lambda_deployment_artifacts
  to   = module.lambda_deployment_artifacts.aws_s3_bucket_public_access_block.this[0]
}

moved {
  from = aws_s3_bucket_versioning.lambda_deployment_artifacts
  to   = module.lambda_deployment_artifacts.aws_s3_bucket_versioning.this[0]
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.lambda_deployment_artifacts
  to   = module.lambda_deployment_artifacts.aws_s3_bucket_server_side_encryption_configuration.this[0]
}

moved {
  from = aws_s3_bucket_policy.lambda_deployment_artifacts
  to   = module.lambda_deployment_artifacts.aws_s3_bucket_policy.this[0]
}
