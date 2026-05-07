data "archive_file" "lambda_deployment_package" {
  type        = "zip"
  source_file = "${path.module}/test-package/main.py"
  output_path = "${path.module}/builds/main.zip"
}

module "lambda_deployment_artifacts" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.8.0"

  bucket = "ts-test-lambda-artifacts"

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  versioning = {
    status = "Enabled"
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
      bucket_key_enabled = true
    }
  }

  attach_deny_insecure_transport_policy = true

  tags = {
    visual = "ignore"
  }
}

resource "aws_s3_object" "lambda_deployment_package" {
  bucket = module.lambda_deployment_artifacts.s3_bucket_id
  key    = "main.zip"
  source = data.archive_file.lambda_deployment_package.output_path
  etag   = data.archive_file.lambda_deployment_package.output_md5

  server_side_encryption = "AES256"

  tags = {
    visual = "ignore"
  }
}
