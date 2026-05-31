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
    state       = "54-west-1-api-12"
    managed_by  = "terraform"
  }

  api14_invoke_url = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
    api_id  = data.aws_api_gateway_rest_api.api14.id
    vpce_id = data.aws_vpc_endpoint.execute_api.id
    region  = module.contract.regions.west_1
    stage   = module.contract.api_stage_name
  })
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-west-1-api-12"
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

data "terraform_remote_state" "west_1_network" {
  backend = "local"
  config = {
    path = var.west_1_network_state_path
  }
}

data "terraform_remote_state" "west_1_datastores" {
  backend = "local"
  config = {
    path = var.west_1_datastores_state_path
  }
}

data "aws_vpc" "west_1" {
  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.west_1]
  }
}

data "aws_vpc_endpoint" "execute_api" {
  vpc_id       = data.aws_vpc.west_1.id
  service_name = "com.amazonaws.${module.contract.regions.west_1}.execute-api"

  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.west_1}-execute-api-vpce"]
  }
}

data "aws_api_gateway_rest_api" "api14" {
  name = module.contract.api_gateway_names["api-14"]
}

module "api" {
  source = "../modules/private_api_lambda"

  name                = "api-12"
  environment         = var.environment
  aws_region          = var.aws_region
  aws_account_id      = data.terraform_remote_state.west_1_network.outputs.aws_account_id
  vpc_id              = data.terraform_remote_state.west_1_network.outputs.vpc_id
  vpc_cidr            = data.terraform_remote_state.west_1_network.outputs.vpc_cidr
  private_subnet_ids  = data.terraform_remote_state.west_1_network.outputs.private_subnet_ids
  execute_api_vpce_id = data.terraform_remote_state.west_1_network.outputs.execute_api_vpce_id

  artifact_bucket_id    = data.terraform_remote_state.west_1_network.outputs.lambda_artifacts_bucket_id
  lambda_source_file    = "${path.module}/../shared/api_handler.py"
  openapi_template_path = "${path.module}/openapi.tftpl"
  stage_name            = module.contract.api_stage_name
  s3_bucket_arns        = [data.terraform_remote_state.west_1_datastores.outputs.api12_bucket_arn]
  downstream_api_urls = {
    api14 = local.api14_invoke_url
  }
  tags = local.tags
}
