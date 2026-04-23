data "archive_file" "lambda_package" {
  type        = "zip"
  source_file = "${path.module}/test-package/main.py"
  output_path = "${path.module}/builds/main.zip"
}

resource "aws_s3_bucket" "lambda_artifacts" {
  bucket = "ts-test-lambda-artifacts"
  tags = {
    visual = "ignore"
  }
}

resource "aws_s3_object" "lambda_zip" {
  bucket = aws_s3_bucket.lambda_artifacts.id
  key    = "main.zip"
  source = data.archive_file.lambda_package.output_path
  etag   = data.archive_file.lambda_package.output_md5
  tags = {
    visual = "ignore"
  }
}
