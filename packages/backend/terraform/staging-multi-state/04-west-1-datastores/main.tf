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
    state       = "04-west-1-datastores"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-west-1-datastores"
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

data "aws_vpc" "west_1" {
  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.west_1]
  }
}

data "terraform_remote_state" "west_1_network" {
  backend = "local"
  config = {
    path = var.west_1_network_state_path
  }
}

data "aws_caller_identity" "current" {}

module "api12_bucket" {
  source = "../../modules/s3_app_bucket"

  bucket_name = module.contract.s3_bucket_names["api-12-west"]
  tags        = local.tags
}

module "api14_table" {
  source = "../../modules/dynamodb_app_table"

  name = module.contract.dynamodb_table_names["api-14"]
  tags = local.tags
}
