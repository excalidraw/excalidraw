terraform {
  required_version = ">= 1.5"

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
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

  tags = {
    environment = var.environment
    stack       = "staging-multi-state"
    state       = "20-east-messaging"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-messaging"
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

data "terraform_remote_state" "ecs" {
  backend = "local"
  config = {
    path = var.ecs_state_path
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
  source = "../../modules/encrypted_sqs_queue"

  queue_name = "${var.environment}-events.fifo"
  dlq_name   = "${var.environment}-events-dlq.fifo"

  redrive_policy = {
    maxReceiveCount = 5
  }

  tags = merge(local.tags, { component = "messaging" })
}

module "consumer_lambda" {
  source = "../../modules/lambda_service"

  function_name = "${var.environment}-sqs-consumer"
  lambda_role   = "${var.environment}-sqs-consumer"
  handler       = "consumer.handler"
  runtime       = "python3.12"

  enable_vpc = true

  s3_existing_package = {
    bucket = data.terraform_remote_state.east_network.outputs.lambda_artifacts_bucket_id
    key    = aws_s3_object.consumer_package.key
  }

  vpc_id                         = data.terraform_remote_state.east_network.outputs.vpc_id
  vpc_subnet_ids                 = data.terraform_remote_state.east_network.outputs.private_subnet_ids
  security_group_name            = "${var.environment}-sqs-consumer-sg"
  vpc_cidr_for_restricted_egress = data.terraform_remote_state.east_network.outputs.vpc_cidr

  environment_variables = {
    API_1_URL = data.terraform_remote_state.api1.outputs.api_invoke_url
    API_2_URL = data.terraform_remote_state.api2.outputs.api_invoke_url
    API_3_URL = data.terraform_remote_state.api3.outputs.api_invoke_url
    API_4_URL = data.terraform_remote_state.api4.outputs.api_invoke_url
    API_5_URL = data.terraform_remote_state.api5.outputs.api_invoke_url
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
        "${data.terraform_remote_state.api5.outputs.api_execution_arn}/*"
      ]
    }
  }
}

resource "aws_lambda_event_source_mapping" "queue_consumer" {
  event_source_arn = module.queue.queue_arn
  function_name    = module.consumer_lambda.lambda_function_arn
  batch_size       = 1
  enabled          = true
}

data "aws_iam_policy_document" "ecs_send_message" {
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

resource "aws_iam_policy" "ecs_send_message" {
  name   = "${var.environment}-ecs-send-sqs"
  policy = data.aws_iam_policy_document.ecs_send_message.json
}

resource "aws_iam_role_policy_attachment" "ecs_send_message" {
  role       = data.terraform_remote_state.ecs.outputs.ecs_task_role_name
  policy_arn = aws_iam_policy.ecs_send_message.arn
}
