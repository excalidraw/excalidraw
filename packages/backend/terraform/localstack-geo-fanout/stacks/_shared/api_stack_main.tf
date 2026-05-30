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

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "localstack_port" {
  type = number
}

variable "api_name" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "subnet_cidr" {
  type = string
}

variable "stack_label" {
  type = string
}

locals {
  localstack_base = "http://localhost:${var.localstack_port}"
}

provider "aws" {
  region                      = var.aws_region
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
    ssm        = local.localstack_base
    sts        = local.localstack_base
  }

  default_tags {
    tags = {
      environment = var.environment
      fixture     = "localstack-geo-fanout"
      stack       = var.stack_label
    }
  }
}

module "network" {
  source = "../../modules/mini_vpc"

  name        = var.api_name
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  subnet_cidr = var.subnet_cidr
}

module "api" {
  source = "../../modules/mini_api_stack"

  name                     = var.api_name
  environment              = var.environment
  aws_region               = var.aws_region
  aws_account_id           = var.aws_account_id
  vpc_id                   = module.network.vpc_id
  private_subnet_ids       = module.network.private_subnet_ids
  lambda_security_group_id = module.network.lambda_security_group_id
  lambda_source_file       = "${path.module}/../../shared/handler.py"
}

output "aws_account_id" {
  value = var.aws_account_id
}

output "aws_region" {
  value = var.aws_region
}

output "vpc_id" {
  value = module.network.vpc_id
}
