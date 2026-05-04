resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

resource "aws_s3_bucket" "data" {
  bucket = "ts-test-lambda-data"
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_kms_key" "sqs" {
  description             = "KMS key for SQS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

resource "aws_sqs_queue" "dlq" {
  name              = "ts-test-lambda-dlq"
  kms_master_key_id = aws_kms_key.sqs.id
}

resource "aws_sqs_queue" "data" {
  name              = "ts-test-lambda-queue"
  kms_master_key_id = aws_kms_key.sqs.id

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  lambda_private_subnet_cidrs = ["10.42.1.0/24", "10.42.2.0/24"]
  lambda_private_subnet_map = {
    for idx, cidr in local.lambda_private_subnet_cidrs :
    tostring(idx) => cidr
    if idx < length(data.aws_availability_zones.available.names)
  }
}

resource "aws_vpc" "lambda" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "lambda_private" {
  for_each = local.lambda_private_subnet_map

  vpc_id                  = aws_vpc.lambda.id
  cidr_block              = each.value
  availability_zone       = data.aws_availability_zones.available.names[tonumber(each.key)]
  map_public_ip_on_launch = false
}

resource "aws_route_table" "lambda_private" {
  vpc_id = aws_vpc.lambda.id
}

resource "aws_route_table_association" "lambda_private" {
  for_each = aws_subnet.lambda_private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.lambda_private.id
}

resource "aws_security_group" "lambda" {
  name        = "ts-test-lambda-sg"
  description = "Security group for Lambda functions in VPC"
  vpc_id      = aws_vpc.lambda.id

  ingress {
    description = "Mock ingress from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.lambda.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "vpce" {
  name        = "ts-test-vpce-sg"
  description = "Security group for VPC Endpoints"
  vpc_id      = aws_vpc.lambda.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }
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
  vpc_subnet_ids         = [for subnet in aws_subnet.lambda_private : subnet.id]
  vpc_security_group_ids = [aws_security_group.lambda.id]

  tracing_mode = "Active"

  environment_variables = {
    DATA_BUCKET    = aws_s3_bucket.data.id
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
    vpc_network = {
      effect = "Allow"
      actions = [
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses",
      ]
      resources = ["*"]
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
  vpc_subnet_ids         = [for subnet in aws_subnet.lambda_private : subnet.id]
  vpc_security_group_ids = [aws_security_group.lambda.id]

  tracing_mode = "Active"

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
    vpc_network = {
      effect = "Allow"
      actions = [
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses",
      ]
      resources = ["*"]
    }
  }
}


# --- VPC Endpoints ---

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.lambda.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.lambda_private.id]
}

resource "aws_vpc_endpoint" "sqs" {
  vpc_id              = aws_vpc.lambda.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.sqs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for subnet in aws_subnet.lambda_private : subnet.id]
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.lambda.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for subnet in aws_subnet.lambda_private : subnet.id]
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true
}

resource "aws_vpc_endpoint" "xray" {
  vpc_id              = aws_vpc.lambda.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.xray"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for subnet in aws_subnet.lambda_private : subnet.id]
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true
}

# --- CloudWatch Alarms ---

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "test-writer-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alarm when Lambda errors occur"
  dimensions = {
    FunctionName = module.lambda-writer.lambda_function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "ts-test-lambda-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Alarm when DLQ has messages"
  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }
}
