terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

variable "environment" {
  type    = string
  default = "local"
}

locals {
  aws_region      = "us-east-1"
  aws_account_id  = "111111111111"
  localstack_port = 4566
  localstack_base = "http://localhost:${local.localstack_port}"
}

provider "aws" {
  region                      = local.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    apigateway = local.localstack_base
    ec2        = local.localstack_base
    iam        = local.localstack_base
    lambda     = local.localstack_base
    logs       = local.localstack_base
    s3         = local.localstack_base
    sqs        = local.localstack_base
    ssm        = local.localstack_base
    sts        = local.localstack_base
    kms        = local.localstack_base
  }

  default_tags {
    tags = {
      environment = var.environment
      fixture     = "production-geo-fanout-localstack"
      stack       = "30-a-messaging"
    }
  }
}

module "network" {
  source = "../../../../localstack-geo-fanout/modules/mini_vpc"

  name        = "messaging"
  environment = var.environment
  vpc_cidr    = "10.65.0.0/16"
  subnet_cidr = "10.65.1.0/24"
}

resource "aws_sqs_queue" "fanout" {
  name                        = "${var.environment}-geo-fanout-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
}

module "consumer" {
  source = "../../../../localstack-geo-fanout/modules/consumer_lambda"

  environment              = var.environment
  aws_region               = local.aws_region
  aws_account_id           = local.aws_account_id
  vpc_id                   = module.network.vpc_id
  private_subnet_ids       = module.network.private_subnet_ids
  lambda_security_group_id = module.network.lambda_security_group_id
  lambda_source_file       = "../../../../localstack-geo-fanout/shared/handler.py"
}

resource "aws_lambda_event_source_mapping" "queue_consumer" {
  event_source_arn = aws_sqs_queue.fanout.arn
  function_name    = module.consumer.lambda_function_name
  batch_size       = 1
  enabled          = true
}

output "aws_account_id" {
  value = local.aws_account_id
}

output "aws_region" {
  value = local.aws_region
}

output "vpc_id" {
  value = module.network.vpc_id
}

output "queue_arn" {
  value = aws_sqs_queue.fanout.arn
}
