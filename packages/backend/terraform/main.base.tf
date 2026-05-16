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

locals {
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-excalidraw-tf"
  }
}

data "aws_caller_identity" "current" {}

check "assume_role_configured" {
  assert {
    condition     = trimspace(var.terraform_deploy_role_arn) != "" || can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Set terraform_deploy_role_arn or a 12-digit aws_account_id (see terraform.tfvars.example)."
  }
}

locals {
  # Three subnet tiers (same number of AZs each): public (ALB + NAT), private (NAT default route),
  # intra (isolated workloads + interface VPC endpoints). CIDRs must sit inside workload_vpc_cidr.
  workload_public_subnet_cidrs  = ["10.42.0.0/24", "10.42.1.0/24"]
  workload_private_subnet_cidrs = ["10.42.2.0/24", "10.42.3.0/24"]
  workload_intra_subnet_cidrs   = ["10.42.10.0/24", "10.42.11.0/24"]
  # Literal — must match private_workload_network.vpc_cidr (lambda_service SG planning).
  workload_vpc_cidr = "10.42.0.0/16"

  workload_tags = {
    environment = "dev"
    owner       = "terraform-graph-demo"
  }
}
