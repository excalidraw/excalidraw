# Reference provider block for LocalStack stacks.
#
# Copy into each stack root as provider.tf and set:
#   - var.aws_region
#   - var.localstack_port (4566 account A, 4567 account B)
#   - var.aws_account_id (111111111111 or 222222222222)

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "localstack_port" {
  type = number
}

variable "environment" {
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
    apigateway     = local.localstack_base
    ec2            = local.localstack_base
    iam            = local.localstack_base
    lambda         = local.localstack_base
    logs           = local.localstack_base
    s3             = local.localstack_base
    ssm            = local.localstack_base
    sts            = local.localstack_base
  }

  default_tags {
    tags = {
      environment = var.environment
      fixture     = "localstack-geo-fanout"
    }
  }
}
