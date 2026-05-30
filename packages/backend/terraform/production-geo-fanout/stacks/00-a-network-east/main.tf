terraform {
  required_version = ">= 1.5"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5"
    }
  }
}

locals {
  stack_name                = "00-a-network-east"
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

data "aws_caller_identity" "current" {}

module "network" {
  source = "../../modules/regional_network"

  providers = {
    aws = aws
  }

  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = data.aws_caller_identity.current.account_id

  vpc_name             = "prod-a-east"
  vpc_cidr             = "10.60.0.0/16"
  public_subnet_cidrs  = ["10.60.0.0/24", "10.60.1.0/24"]
  private_subnet_cidrs = ["10.60.10.0/24", "10.60.11.0/24"]
  intra_subnet_cidrs   = ["10.60.20.0/24", "10.60.21.0/24"]
  single_nat_gateway   = var.single_nat_gateway

  transit_gateway_asn = 64512
  tags                = local.tags
}
