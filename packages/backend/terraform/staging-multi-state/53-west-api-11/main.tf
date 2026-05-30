terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5"
    }
  }
}

locals {
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

  tags = {
    environment = var.environment
    stack       = "staging-multi-state"
    state       = "53-west-api-11"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-west-api-11"
  }

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias   = "east"
  region  = var.east_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-west-api-11-east"
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

data "terraform_remote_state" "west_network" {
  backend = "local"
  config = {
    path = var.west_network_state_path
  }
}

data "terraform_remote_state" "west_datastores" {
  backend = "local"
  config = {
    path = var.west_datastores_state_path
  }
}

module "api" {
  source = "../modules/private_api_ecs"

  name                   = "api-11"
  environment            = var.environment
  aws_region             = var.aws_region
  aws_account_id         = data.terraform_remote_state.west_network.outputs.aws_account_id
  vpc_id                 = data.terraform_remote_state.west_network.outputs.vpc_id
  vpc_cidr               = data.terraform_remote_state.west_network.outputs.vpc_cidr
  private_subnet_ids     = data.terraform_remote_state.west_network.outputs.private_subnet_ids
  execute_api_vpce_id    = data.terraform_remote_state.west_network.outputs.execute_api_vpce_id
  execute_api_vpce_sg_id = data.terraform_remote_state.west_network.outputs.execute_api_vpce_sg_id
  launch_type            = "FARGATE"
  db_secret_arn          = data.terraform_remote_state.west_datastores.outputs.api11_secret_arn
  stage_name             = "v1"
  tags                   = local.tags
}
