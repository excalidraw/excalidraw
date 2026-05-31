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

module "contract" {
  source = "../shared/contract"

  environment    = var.environment
  aws_account_id = var.aws_account_id
}

locals {
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

  tags = {
    environment = var.environment
    stack       = "staging-multi-state"
    state       = "20-east-messaging"
    managed_by  = "terraform"
  }

  api_invoke_urls = {
    api1 = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
      api_id  = data.aws_api_gateway_rest_api.api1.id
      vpce_id = data.aws_vpc_endpoint.execute_api.id
      region  = module.contract.regions.east
      stage   = module.contract.api_stage_name
    })
    api2 = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
      api_id  = data.aws_api_gateway_rest_api.api2.id
      vpce_id = data.aws_vpc_endpoint.execute_api.id
      region  = module.contract.regions.east
      stage   = module.contract.api_stage_name
    })
    api3 = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
      api_id  = data.aws_api_gateway_rest_api.api3.id
      vpce_id = data.aws_vpc_endpoint.execute_api.id
      region  = module.contract.regions.east
      stage   = module.contract.api_stage_name
    })
    api4 = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
      api_id  = data.aws_api_gateway_rest_api.api4.id
      vpce_id = data.aws_vpc_endpoint.execute_api.id
      region  = module.contract.regions.east
      stage   = module.contract.api_stage_name
    })
    api5 = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
      api_id  = data.aws_api_gateway_rest_api.api5.id
      vpce_id = data.aws_vpc_endpoint.execute_api.id
      region  = module.contract.regions.east
      stage   = module.contract.api_stage_name
    })
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

data "aws_vpc" "east" {
  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.east]
  }
}

data "aws_subnets" "east_private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.east.id]
  }
  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.east}-private-*"]
  }
}

data "aws_vpc_endpoint" "execute_api" {
  vpc_id       = data.aws_vpc.east.id
  service_name = "com.amazonaws.${module.contract.regions.east}.execute-api"

  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.east}-execute-api-vpce"]
  }
}

data "aws_s3_bucket" "lambda_artifacts" {
  bucket = module.contract.lambda_artifacts_bucket_names.east
}

data "aws_api_gateway_rest_api" "api1" {
  name = module.contract.api_gateway_names["api-1"]
}

data "aws_api_gateway_rest_api" "api2" {
  name = module.contract.api_gateway_names["api-2"]
}

data "aws_api_gateway_rest_api" "api3" {
  name = module.contract.api_gateway_names["api-3"]
}

data "aws_api_gateway_rest_api" "api4" {
  name = module.contract.api_gateway_names["api-4"]
}

data "aws_api_gateway_rest_api" "api5" {
  name = module.contract.api_gateway_names["api-5"]
}

data "aws_iam_role" "ecs_task" {
  name = "${var.environment}-ecs-task"
}

data "archive_file" "consumer_zip" {
  type        = "zip"
  source_file = "${path.module}/src/consumer.py"
  output_path = "${path.module}/build/consumer.zip"
}

resource "aws_s3_object" "consumer_package" {
  bucket = data.aws_s3_bucket.lambda_artifacts.id
  key    = "consumer/${data.archive_file.consumer_zip.output_md5}.zip"
  source = data.archive_file.consumer_zip.output_path
  etag   = data.archive_file.consumer_zip.output_md5

  server_side_encryption = "AES256"
}

module "ingress_queue" {
  source = "../../modules/encrypted_sqs_queue"

  queue_name = module.contract.ingress_queue_name
  dlq_name   = "${var.environment}-events-dlq.fifo"

  redrive_policy = {
    maxReceiveCount = 5
  }

  tags = merge(local.tags, { component = "messaging-ingress" })
}

module "egress_queue" {
  source = "../../modules/encrypted_sqs_queue"

  queue_name = module.contract.egress_queue_name
  dlq_name   = "${var.environment}-egress-dlq"
  create_dlq = true

  redrive_policy = {
    maxReceiveCount = 5
  }

  tags = merge(local.tags, { component = "messaging-egress" })
}

module "consumer_lambda" {
  source = "../../modules/lambda_service"

  function_name = module.contract.sqs_consumer_lambda_name
  lambda_role   = module.contract.sqs_consumer_lambda_name
  handler       = "consumer.handler"
  runtime       = "python3.12"

  enable_vpc = true

  s3_existing_package = {
    bucket = data.aws_s3_bucket.lambda_artifacts.id
    key    = aws_s3_object.consumer_package.key
  }

  vpc_id                         = data.aws_vpc.east.id
  vpc_subnet_ids                 = data.aws_subnets.east_private.ids
  security_group_name            = "${var.environment}-sqs-consumer-sg"
  vpc_cidr_for_restricted_egress = module.contract.vpc_cidrs.east

  environment_variables = {
    API_1_URL        = local.api_invoke_urls.api1
    API_2_URL        = local.api_invoke_urls.api2
    API_3_URL        = local.api_invoke_urls.api3
    API_4_URL        = local.api_invoke_urls.api4
    API_5_URL        = local.api_invoke_urls.api5
    EGRESS_QUEUE_URL = module.egress_queue.queue_url
  }

  attach_policy_statements = true
  policy_statements = {
    sqs_consume = {
      effect    = "Allow"
      actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"]
      resources = [module.ingress_queue.queue_arn]
    }
    sqs_egress_send = {
      effect    = "Allow"
      actions   = ["sqs:SendMessage"]
      resources = [module.egress_queue.queue_arn]
    }
    kms_sqs = {
      effect    = "Allow"
      actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey"]
      resources = [module.ingress_queue.kms_key_arn, module.egress_queue.kms_key_arn]
    }
    execute_api = {
      effect  = "Allow"
      actions = ["execute-api:Invoke"]
      resources = [
        "${data.aws_api_gateway_rest_api.api1.execution_arn}/*",
        "${data.aws_api_gateway_rest_api.api2.execution_arn}/*",
        "${data.aws_api_gateway_rest_api.api3.execution_arn}/*",
        "${data.aws_api_gateway_rest_api.api4.execution_arn}/*",
        "${data.aws_api_gateway_rest_api.api5.execution_arn}/*",
      ]
    }
  }
}

resource "aws_lambda_event_source_mapping" "queue_consumer" {
  event_source_arn = module.ingress_queue.queue_arn
  function_name    = module.consumer_lambda.lambda_function_arn
  batch_size       = 1
  enabled          = true
}

data "aws_iam_policy_document" "ecs_send_message" {
  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [module.ingress_queue.queue_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey"]
    resources = [module.ingress_queue.kms_key_arn]
  }
}

resource "aws_iam_policy" "ecs_send_message" {
  name   = "${var.environment}-ecs-send-sqs"
  policy = data.aws_iam_policy_document.ecs_send_message.json
}

resource "aws_iam_role_policy_attachment" "ecs_send_message" {
  role       = data.aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_send_message.arn
}
