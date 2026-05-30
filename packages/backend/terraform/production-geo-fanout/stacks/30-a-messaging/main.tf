terraform {
  required_version = ">= 1.5"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

locals {
  stack_name                = "30-a-messaging"
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

  peer_vpc_cidrs = [
    data.terraform_remote_state.east_network.outputs.vpc_cidr,
    data.terraform_remote_state.west_network.outputs.vpc_cidr,
    data.terraform_remote_state.eu_west_network.outputs.vpc_cidr,
    data.terraform_remote_state.eu_central_network.outputs.vpc_cidr,
  ]

  tags = {
    environment = var.environment
    stack       = "production-geo-fanout"
    state       = local.stack_name
    managed_by  = "terraform"
    account     = "a"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-prod-geo-${local.stack_name}"
  }

  default_tags {
    tags = local.tags
  }
}

check "assume_role_configured" {
  assert {
    condition     = trimspace(var.terraform_deploy_role_arn) != "" || can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Set terraform_deploy_role_arn or a 12-digit aws_account_id."
  }
}

data "terraform_remote_state" "east_network" {
  backend = "local"
  config = {
    path = var.east_network_state_path
  }
}

data "terraform_remote_state" "west_network" {
  backend = "local"
  config = {
    path = var.west_network_state_path
  }
}

data "terraform_remote_state" "eu_west_network" {
  backend = "local"
  config = {
    path = var.eu_west_network_state_path
  }
}

data "terraform_remote_state" "eu_central_network" {
  backend = "local"
  config = {
    path = var.eu_central_network_state_path
  }
}

data "terraform_remote_state" "api1" {
  backend = "local"
  config  = { path = var.api_state_paths.api1 }
}

data "terraform_remote_state" "api2" {
  backend = "local"
  config  = { path = var.api_state_paths.api2 }
}

data "terraform_remote_state" "api3" {
  backend = "local"
  config  = { path = var.api_state_paths.api3 }
}

data "terraform_remote_state" "api4" {
  backend = "local"
  config  = { path = var.api_state_paths.api4 }
}

data "terraform_remote_state" "api5" {
  backend = "local"
  config  = { path = var.api_state_paths.api5 }
}

data "terraform_remote_state" "api6" {
  backend = "local"
  config  = { path = var.api_state_paths.api6 }
}

data "archive_file" "consumer_zip" {
  type        = "zip"
  source_file = "${path.module}/src/consumer.py"
  output_path = "${path.module}/build/consumer.zip"
}

resource "aws_s3_object" "consumer_package" {
  bucket = data.terraform_remote_state.east_network.outputs.lambda_artifacts_bucket_id
  key    = "consumer/${data.archive_file.consumer_zip.output_md5}.zip"
  source = data.archive_file.consumer_zip.output_path
  etag   = data.archive_file.consumer_zip.output_md5

  server_side_encryption = "AES256"
}

module "queue" {
  source = "../../../modules/encrypted_sqs_queue"

  queue_name = "${var.environment}-geo-fanout-events.fifo"
  dlq_name   = "${var.environment}-geo-fanout-events-dlq.fifo"

  redrive_policy = {
    maxReceiveCount = 5
  }

  tags = merge(local.tags, { component = "messaging" })
}

module "consumer_lambda" {
  source = "../../../modules/lambda_service"

  function_name = "${var.environment}-geo-fanout-consumer"
  lambda_role   = "${var.environment}-geo-fanout-consumer"
  handler       = "consumer.handler"
  runtime       = "python3.12"

  enable_vpc = true

  s3_existing_package = {
    bucket = data.terraform_remote_state.east_network.outputs.lambda_artifacts_bucket_id
    key    = aws_s3_object.consumer_package.key
  }

  vpc_id                         = data.terraform_remote_state.east_network.outputs.vpc_id
  vpc_subnet_ids                 = data.terraform_remote_state.east_network.outputs.private_subnet_ids
  security_group_name            = "${var.environment}-geo-fanout-consumer-sg"
  vpc_cidr_for_restricted_egress = data.terraform_remote_state.east_network.outputs.vpc_cidr

  environment_variables = {
    API_1_URL    = data.terraform_remote_state.api1.outputs.api_invoke_url
    API_1_REGION = data.terraform_remote_state.api1.outputs.aws_region
    API_2_URL    = data.terraform_remote_state.api2.outputs.api_invoke_url
    API_2_REGION = data.terraform_remote_state.api2.outputs.aws_region
    API_3_URL    = data.terraform_remote_state.api3.outputs.api_invoke_url
    API_3_REGION = data.terraform_remote_state.api3.outputs.aws_region
    API_4_URL    = data.terraform_remote_state.api4.outputs.api_invoke_url
    API_4_REGION = data.terraform_remote_state.api4.outputs.aws_region
    API_5_URL    = data.terraform_remote_state.api5.outputs.api_invoke_url
    API_5_REGION = data.terraform_remote_state.api5.outputs.aws_region
    API_6_URL    = data.terraform_remote_state.api6.outputs.api_invoke_url
    API_6_REGION = data.terraform_remote_state.api6.outputs.aws_region
  }

  attach_policy_statements = true
  policy_statements = {
    sqs_consume = {
      effect    = "Allow"
      actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"]
      resources = [module.queue.queue_arn]
    }
    kms_sqs = {
      effect    = "Allow"
      actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey"]
      resources = [module.queue.kms_key_arn]
    }
    execute_api = {
      effect  = "Allow"
      actions = ["execute-api:Invoke"]
      resources = [
        "${data.terraform_remote_state.api1.outputs.api_execution_arn}/*",
        "${data.terraform_remote_state.api2.outputs.api_execution_arn}/*",
        "${data.terraform_remote_state.api3.outputs.api_execution_arn}/*",
        "${data.terraform_remote_state.api4.outputs.api_execution_arn}/*",
        "${data.terraform_remote_state.api5.outputs.api_execution_arn}/*",
        "${data.terraform_remote_state.api6.outputs.api_execution_arn}/*",
      ]
    }
  }
}

resource "aws_security_group_rule" "consumer_peer_vpc_https" {
  for_each = toset([
    for cidr in local.peer_vpc_cidrs : cidr if cidr != data.terraform_remote_state.east_network.outputs.vpc_cidr
  ])

  type              = "egress"
  security_group_id = module.consumer_lambda.security_group_id
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = [each.value]
  description       = "HTTPS to peer regional VPC CIDRs for private API Gateway VPCE invoke"
}

resource "aws_lambda_event_source_mapping" "queue_consumer" {
  event_source_arn = module.queue.queue_arn
  function_name    = module.consumer_lambda.lambda_function_arn
  batch_size       = 1
  enabled          = true
}

resource "aws_cloudwatch_event_rule" "fanout_schedule" {
  name                = "${var.environment}-geo-fanout-schedule"
  description         = "Optional scheduled fanout trigger (disabled by default)"
  schedule_expression = var.schedule_expression
  state               = var.enable_schedule ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "fanout_queue" {
  count = var.enable_schedule ? 1 : 0

  rule      = aws_cloudwatch_event_rule.fanout_schedule.name
  target_id = "fanout-queue"
  arn       = module.queue.queue_arn
  role_arn  = aws_iam_role.events_fanout[0].arn

  sqs_target {
    message_group_id = "scheduled"
  }
}

data "aws_iam_policy_document" "events_send_message" {
  count = var.enable_schedule ? 1 : 0

  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [module.queue.queue_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey"]
    resources = [module.queue.kms_key_arn]
  }
}

resource "aws_iam_role" "events_fanout" {
  count = var.enable_schedule ? 1 : 0

  name = "${var.environment}-geo-fanout-events"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "events.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "events_fanout" {
  count = var.enable_schedule ? 1 : 0

  name   = "${var.environment}-geo-fanout-events-send"
  role   = aws_iam_role.events_fanout[0].id
  policy = data.aws_iam_policy_document.events_send_message[0].json
}

resource "aws_cloudwatch_metric_alarm" "consumer_errors" {
  alarm_name          = "${var.environment}-geo-fanout-consumer-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = module.consumer_lambda.lambda_function_name
  }

  alarm_description = "Consumer Lambda errors in geo fanout pipeline"
}

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "${var.environment}-geo-fanout-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = "${var.environment}-geo-fanout-events-dlq.fifo"
  }

  alarm_description = "Messages visible in geo fanout DLQ"
}
