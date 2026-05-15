# Import existing S3 bucket and related settings created outside current state.
# Run: terraform plan  (verify no unexpected changes)
# Then remove this file after a successful apply.

import {
  to = module.lambda_deployment_artifacts.aws_s3_bucket.this[0]
  id = "ts-test-lambda-artifacts"
}

import {
  to = module.lambda_deployment_artifacts.aws_s3_bucket_public_access_block.this[0]
  id = "ts-test-lambda-artifacts"
}

import {
  to = module.lambda_deployment_artifacts.aws_s3_bucket_versioning.this[0]
  id = "ts-test-lambda-artifacts"
}

import {
  to = module.lambda_deployment_artifacts.aws_s3_bucket_server_side_encryption_configuration.this[0]
  id = "ts-test-lambda-artifacts"
}

import {
  to = module.lambda_deployment_artifacts.aws_s3_bucket_policy.this[0]
  id = "ts-test-lambda-artifacts"
}
