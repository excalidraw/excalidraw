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
  stack_name                = "10-a-api-1"
  api_name                  = "api-1"
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

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

data "terraform_remote_state" "network" {
  backend = "local"
  config = {
    path = var.network_state_path
  }
}

module "api" {
  source = "../../modules/private_api_lambda"

  name                = local.api_name
  environment         = var.environment
  aws_region          = var.aws_region
  aws_account_id      = data.terraform_remote_state.network.outputs.aws_account_id
  vpc_id              = data.terraform_remote_state.network.outputs.vpc_id
  vpc_cidr            = data.terraform_remote_state.network.outputs.vpc_cidr
  private_subnet_ids  = data.terraform_remote_state.network.outputs.private_subnet_ids
  execute_api_vpce_id = data.terraform_remote_state.network.outputs.execute_api_vpce_id

  artifact_bucket_id    = data.terraform_remote_state.network.outputs.lambda_artifacts_bucket_id
  lambda_source_file    = "${path.module}/../../shared/api_handler.py"
  openapi_template_path = "${path.module}/../../shared/openapi.tftpl"
  stage_name            = "v1"
}
