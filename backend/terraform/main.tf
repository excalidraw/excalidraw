resource "aws_s3_bucket" "data" {
  bucket = "ts-test-lambda-data"
}

resource "aws_sqs_queue" "data" {
  name = "ts-test-lambda-queue"
}

# --- Lambda: writer ---

module "lambda-writer" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.7.0"

  function_name = "test-writer"
  lambda_role   = "test-writer"
  handler       = "main.writer_handler"
  runtime       = "python3.12"

  create_package = false
  s3_existing_package = {
    bucket = aws_s3_bucket.lambda_artifacts.id
    key    = aws_s3_object.lambda_zip.key
  }

  environment_variables = {
    DATA_BUCKET   = aws_s3_bucket.data.id
    DATA_QUEUE_URL = aws_sqs_queue.data.url
  }

  attach_policy_statements = true
  policy_statements = {
    s3_write = {
      effect    = "Allow"
      actions   = ["s3:PutObject"]
      resources = ["${aws_s3_bucket.data.arn}/*"]
    }
    sqs_send = {
      effect    = "Allow"
      actions   = ["sqs:SendMessage"]
      resources = [aws_sqs_queue.data.arn]
    }
  }
}

# --- Lambda: reader ---

module "lambda-reader" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.7.0"

  function_name = "test-reader"
  lambda_role   = "test-reader"
  handler       = "main.reader_handler"
  runtime       = "python3.12"

  create_package = false
  s3_existing_package = {
    bucket = aws_s3_bucket.lambda_artifacts.id
    key    = aws_s3_object.lambda_zip.key
  }

  environment_variables = {
    DATA_BUCKET    = aws_s3_bucket.data.id
    DATA_QUEUE_URL = aws_sqs_queue.data.url
  }

  attach_policy_statements = true
  policy_statements = {
    s3_read = {
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [aws_s3_bucket.data.arn, "${aws_s3_bucket.data.arn}/*"]
    }
    sqs_receive = {
      effect    = "Allow"
      actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      resources = [aws_sqs_queue.data.arn]
    }
  }
}

