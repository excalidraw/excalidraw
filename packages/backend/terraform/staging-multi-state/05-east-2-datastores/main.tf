terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
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
    state       = "05-east-2-datastores"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-2-datastores"
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

data "aws_vpc" "east_2" {
  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.east_2]
  }
}

data "terraform_remote_state" "east_2_network" {
  backend = "local"
  config = {
    path = var.east_2_network_state_path
  }
}

module "api15_aurora" {
  source = "../../modules/aurora_serverless_v2_micro"

  identifier                 = module.contract.aurora_identifiers["api-15"]
  environment                = var.environment
  vpc_id                     = data.aws_vpc.east_2.id
  database_subnet_ids        = data.terraform_remote_state.east_2_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  peer_vpc_cidr_blocks       = concat([data.aws_vpc.east_2.cidr_block], var.peer_vpc_cidrs)
  db_name                    = "api15"
  tags                       = local.tags
}

module "api16_rds" {
  source = "../../modules/rds_postgres_micro"

  identifier                 = module.contract.rds_identifiers["api-16"]
  environment                = var.environment
  vpc_id                     = data.aws_vpc.east_2.id
  database_subnet_ids        = data.terraform_remote_state.east_2_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  peer_vpc_cidr_blocks       = concat([data.aws_vpc.east_2.cidr_block], var.peer_vpc_cidrs)
  db_name                    = "api16"
  tags                       = local.tags
}
