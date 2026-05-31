terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5"
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
    state       = "56-east-2-api-15"
    managed_by  = "terraform"
  }

  api16_invoke_url = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
    api_id  = data.aws_api_gateway_rest_api.api16.id
    vpce_id = data.aws_vpc_endpoint.execute_api.id
    region  = module.contract.regions.east_2
    stage   = module.contract.api_stage_name
  })
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-2-api-15"
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

data "terraform_remote_state" "east_2_network" {
  backend = "local"
  config = {
    path = var.east_2_network_state_path
  }
}

data "terraform_remote_state" "east_2_datastores" {
  backend = "local"
  config = {
    path = var.east_2_datastores_state_path
  }
}

data "aws_vpc" "east_2" {
  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.east_2]
  }
}

data "aws_vpc_endpoint" "execute_api" {
  vpc_id       = data.aws_vpc.east_2.id
  service_name = "com.amazonaws.${module.contract.regions.east_2}.execute-api"

  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.east_2}-execute-api-vpce"]
  }
}

data "aws_api_gateway_rest_api" "api16" {
  name = module.contract.api_gateway_names["api-16"]
}

module "api" {
  source = "../modules/private_api_ecs"

  name                   = "api-15"
  environment            = var.environment
  aws_region             = var.aws_region
  aws_account_id         = data.terraform_remote_state.east_2_network.outputs.aws_account_id
  vpc_id                 = data.terraform_remote_state.east_2_network.outputs.vpc_id
  vpc_cidr               = data.terraform_remote_state.east_2_network.outputs.vpc_cidr
  private_subnet_ids     = data.terraform_remote_state.east_2_network.outputs.private_subnet_ids
  execute_api_vpce_id    = data.terraform_remote_state.east_2_network.outputs.execute_api_vpce_id
  execute_api_vpce_sg_id = data.terraform_remote_state.east_2_network.outputs.execute_api_vpce_sg_id
  launch_type            = "EC2"
  db_secret_arn          = data.terraform_remote_state.east_2_datastores.outputs.api15_secret_arn
  downstream_api_urls = {
    api16 = local.api16_invoke_url
  }
  stage_name = module.contract.api_stage_name
  tags       = local.tags
}
