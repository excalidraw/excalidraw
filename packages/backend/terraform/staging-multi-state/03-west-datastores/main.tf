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
    state       = "03-west-datastores"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-west-datastores"
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
    session_name = "terraform-staging-west-datastores-east"
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

data "terraform_remote_state" "east_network" {
  backend = "local"
  config = {
    path = var.east_network_state_path
  }
}

module "api8_west_bucket" {
  source = "../../modules/s3_app_bucket"

  bucket_name = "staging-${data.terraform_remote_state.east_network.outputs.aws_account_id}-api-8-west"
  tags        = local.tags
}

module "api9_west_rds" {
  source = "../../modules/rds_postgres_micro"

  identifier                 = "staging-api-9-west"
  environment                = var.environment
  vpc_id                     = data.terraform_remote_state.west_network.outputs.vpc_id
  database_subnet_ids        = data.terraform_remote_state.west_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  peer_vpc_cidr_blocks = [
    data.terraform_remote_state.west_network.outputs.vpc_cidr,
    data.terraform_remote_state.east_network.outputs.vpc_cidr,
  ]
  db_name = "api9west"
  tags    = local.tags
}

module "api10_table" {
  source = "../../modules/dynamodb_app_table"

  name = "staging-api-10"
  tags = local.tags
}

module "api11_aurora" {
  source = "../../modules/aurora_serverless_v2_micro"

  identifier                 = "staging-api-11"
  environment                = var.environment
  vpc_id                     = data.terraform_remote_state.west_network.outputs.vpc_id
  database_subnet_ids        = data.terraform_remote_state.west_network.outputs.database_subnet_ids
  allowed_security_group_ids = []
  db_name                    = "api11"
  tags                       = local.tags
}
