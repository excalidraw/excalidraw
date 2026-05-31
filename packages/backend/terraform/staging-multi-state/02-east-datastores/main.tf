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

locals {
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

  tags = {
    environment = var.environment
    stack       = "staging-multi-state"
    state       = "02-east-datastores"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-datastores"
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

module "api1_table" {
  source = "../../modules/dynamodb_app_table"

  name = "staging-api-1"
  tags = local.tags
}

module "api2_rds" {
  source = "../../modules/rds_postgres_micro"

  identifier                 = "staging-api-2"
  environment                = var.environment
  vpc_id                     = data.terraform_remote_state.east_network.outputs.vpc_id
  database_subnet_ids        = data.terraform_remote_state.east_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  peer_vpc_cidr_blocks       = [data.terraform_remote_state.east_network.outputs.vpc_cidr]
  db_name                    = "api2"
  tags                       = local.tags
}

module "api3_aurora" {
  source = "../../modules/aurora_serverless_v2_micro"

  identifier                 = "staging-api-3"
  environment                = var.environment
  vpc_id                     = data.terraform_remote_state.east_network.outputs.vpc_id
  database_subnet_ids        = data.terraform_remote_state.east_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  peer_vpc_cidr_blocks       = [data.terraform_remote_state.east_network.outputs.vpc_cidr]
  db_name                    = "api3"
  tags                       = local.tags
}

module "api4_bucket" {
  source = "../../modules/s3_app_bucket"

  bucket_name = "staging-${data.terraform_remote_state.east_network.outputs.aws_account_id}-api-4"
  tags        = local.tags
}

module "api5_table" {
  source = "../../modules/dynamodb_app_table"

  name = "staging-api-5"
  tags = local.tags
}

module "api6_rds" {
  source = "../../modules/rds_postgres_micro"

  identifier                 = "staging-api-6"
  environment                = var.environment
  vpc_id                     = data.terraform_remote_state.east_network.outputs.vpc_id
  database_subnet_ids        = data.terraform_remote_state.east_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  peer_vpc_cidr_blocks       = [data.terraform_remote_state.east_network.outputs.vpc_cidr]
  db_name                    = "api6"
  tags                       = local.tags
}

module "api7_aurora" {
  source = "../../modules/aurora_serverless_v2_micro"

  identifier                 = "staging-api-7"
  environment                = var.environment
  vpc_id                     = data.terraform_remote_state.east_network.outputs.vpc_id
  database_subnet_ids        = data.terraform_remote_state.east_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  peer_vpc_cidr_blocks       = [data.terraform_remote_state.east_network.outputs.vpc_cidr]
  db_name                    = "api7"
  tags                       = local.tags
}
