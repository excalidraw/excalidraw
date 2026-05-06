/*
module "s3_kms" {
  source  = "terraform-aws-modules/kms/aws"
  version = "4.1.0"

  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  enable_default_policy   = true
}

module "data_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.8.0"

  bucket = "ts-test-lambda-data"

  versioning = {
    status = "Enabled"
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        kms_master_key_id = module.s3_kms.key_arn
        sse_algorithm     = "aws:kms"
      }
    }
  }

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "sqs_kms" {
  source  = "terraform-aws-modules/kms/aws"
  version = "4.1.0"

  description             = "KMS key for SQS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  enable_default_policy   = true
}

module "data_queue" {
  source  = "terraform-aws-modules/sqs/aws"
  version = "5.2.1"

  name     = "ts-test-lambda-queue"
  dlq_name = "ts-test-lambda-dlq"

  kms_master_key_id     = module.sqs_kms.key_id
  dlq_kms_master_key_id = module.sqs_kms.key_id

  create_dlq = true
  redrive_policy = {
    maxReceiveCount = 3
  }
}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  lambda_private_subnet_cidrs = ["10.42.1.0/24", "10.42.2.0/24"]
  lambda_azs                  = slice(data.aws_availability_zones.available.names, 0, length(local.lambda_private_subnet_cidrs))
}

module "lambda_vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.5.0"

  name = "ts-test-lambda"
  cidr = "10.42.0.0/16"

  azs           = local.lambda_azs
  intra_subnets = local.lambda_private_subnet_cidrs

  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    environment = "dev"
    owner       = "terraform-graph-demo"
  }
}

module "lambda_writer_security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.3.0"

  name        = "ts-test-writer-lambda-sg"
  description = "Security group for writer Lambda in VPC"
  vpc_id      = module.lambda_vpc.vpc_id

  ingress_with_cidr_blocks = [
    {
      rule        = "https-443-tcp"
      description = "Mock ingress from VPC"
      cidr_blocks = module.lambda_vpc.vpc_cidr_block
    }
  ]

  egress_rules = ["all-all"]
}

module "lambda_reader_security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.3.0"

  name        = "ts-test-reader-lambda-sg"
  description = "Security group for reader Lambda in VPC"
  vpc_id      = module.lambda_vpc.vpc_id

  ingress_with_cidr_blocks = [
    {
      rule        = "https-443-tcp"
      description = "Mock ingress from VPC"
      cidr_blocks = module.lambda_vpc.vpc_cidr_block
    }
  ]

  egress_rules = ["all-all"]
}

module "vpce_security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.3.0"

  name        = "ts-test-vpce-sg"
  description = "Security group for VPC Endpoints"
  vpc_id      = module.lambda_vpc.vpc_id

  ingress_with_source_security_group_id = [
    {
      description              = "Mock ingress from VPC"
      from_port                = 443
      to_port                  = 443
      protocol                 = "tcp"
      source_security_group_id = module.lambda_writer_security_group.security_group_id
    },
    {
      description              = "HTTPS from reader Lambda"
      from_port                = 443
      to_port                  = 443
      protocol                 = "tcp"
      source_security_group_id = module.lambda_reader_security_group.security_group_id
    }
  ]

  egress_rules = ["all-all"]
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
  vpc_subnet_ids         = module.lambda_vpc.intra_subnets
  vpc_security_group_ids = [module.lambda_writer_security_group.security_group_id]

  tracing_mode = "Active"

  environment_variables = {
    DATA_BUCKET    = module.data_bucket.s3_bucket_id
    DATA_QUEUE_URL = module.data_queue.queue_url
    TEST1 = "test2"
  }

  attach_policy_statements = true
  policy_statements = {
    s3_write = {
      effect    = "Allow"
      actions   = ["s3:PutObject"]
      resources = ["${module.data_bucket.s3_bucket_arn}/*"]
    }
    sqs_send = {
      effect    = "Allow"
      actions   = ["sqs:SendMessage"]
      resources = [module.data_queue.queue_arn]
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

# --- Lambda: monitoring (mock/no-op) ---

module "lambda-monitoring" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "8.7.0"

  function_name = "test-monitoring"
  lambda_role   = "test-monitoring"
  handler       = "main.monitoring_handler"
  runtime       = "python3.12"

  create_package = false
  s3_existing_package = {
    bucket = aws_s3_bucket.lambda_artifacts.id
    key    = aws_s3_object.lambda_zip.key
  }

  tracing_mode = "Active"

  environment_variables = {
    MOCK_MONITORING = "true"
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
  vpc_subnet_ids         = module.lambda_vpc.intra_subnets
  vpc_security_group_ids = [module.lambda_reader_security_group.security_group_id]

  tracing_mode = "Active"

  environment_variables = {
    DATA_BUCKET    = module.data_bucket.s3_bucket_id
    DATA_QUEUE_URL = module.data_queue.queue_url
  }

  attach_policy_statements = true
  policy_statements = {
    s3_read = {
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [module.data_bucket.s3_bucket_arn, "${module.data_bucket.s3_bucket_arn}/*"]
    }
    sqs_receive = {
      effect    = "Allow"
      actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      resources = [module.data_queue.queue_arn]
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

module "lambda_vpc_endpoints" {
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "6.5.0"

  vpc_id = module.lambda_vpc.vpc_id

  endpoints = {
    s3 = {
      service         = "s3"
      service_type    = "Gateway"
      route_table_ids = module.lambda_vpc.intra_route_table_ids
    }
    sqs = {
      service             = "sqs"
      subnet_ids          = module.lambda_vpc.intra_subnets
      security_group_ids  = [module.vpce_security_group.security_group_id]
      private_dns_enabled = true
    }
    logs = {
      service             = "logs"
      subnet_ids          = module.lambda_vpc.intra_subnets
      security_group_ids  = [module.vpce_security_group.security_group_id]
      private_dns_enabled = true
    }
    xray = {
      service             = "xray"
      subnet_ids          = module.lambda_vpc.intra_subnets
      security_group_ids  = [module.vpce_security_group.security_group_id]
      private_dns_enabled = true
    }
  }
}

# --- CloudWatch Alarms ---

resource "aws_cloudwatch_metric_alarm" "lambda_writer_errors" {
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

resource "aws_cloudwatch_metric_alarm" "lambda_reader_errors" {
  alarm_name          = "test-reader-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alarm when reader Lambda errors occur"
  dimensions = {
    FunctionName = module.lambda-reader.lambda_function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "queue_messages" {
  alarm_name          = "ts-test-lambda-queue-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 100
  alarm_description   = "Alarm when main queue has visible messages"
  dimensions = {
    QueueName = module.data_queue.queue_name
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
    QueueName = module.data_queue.dead_letter_queue_name
  }
}
*/