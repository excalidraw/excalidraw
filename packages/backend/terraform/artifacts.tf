data "archive_file" "lambda_deployment_package" {
  type        = "zip"
  source_file = "${path.module}/test-package/main.py"
  output_path = "${path.module}/builds/main.zip"
}

resource "aws_s3_bucket" "lambda_deployment_artifacts" {
  bucket = "ts-test-lambda-artifacts"
  tags = {
    visual = "ignore"
  }
}

resource "aws_s3_bucket_public_access_block" "lambda_deployment_artifacts" {
  bucket = aws_s3_bucket.lambda_deployment_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "lambda_deployment_artifacts" {
  bucket = aws_s3_bucket.lambda_deployment_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_deployment_artifacts" {
  bucket = aws_s3_bucket.lambda_deployment_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

data "aws_iam_policy_document" "lambda_deployment_artifacts_tls_only" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.lambda_deployment_artifacts.arn,
      "${aws_s3_bucket.lambda_deployment_artifacts.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "lambda_deployment_artifacts" {
  bucket = aws_s3_bucket.lambda_deployment_artifacts.id
  policy = data.aws_iam_policy_document.lambda_deployment_artifacts_tls_only.json
}

resource "aws_s3_object" "lambda_deployment_package" {
  bucket = aws_s3_bucket.lambda_deployment_artifacts.id
  key    = "main.zip"
  source = data.archive_file.lambda_deployment_package.output_path
  etag   = data.archive_file.lambda_deployment_package.output_md5

  server_side_encryption = "AES256"

  tags = {
    visual = "ignore"
  }
}
