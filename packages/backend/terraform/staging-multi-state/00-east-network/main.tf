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
    state       = "00-east-network"
    managed_by  = "terraform"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-network"
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

module "east_network" {
  source = "../../modules/private_workload_network"

  vpc_name             = var.vpc_name
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  intra_subnet_cidrs   = var.intra_subnet_cidrs
  single_nat_gateway   = var.single_nat_gateway

  interface_endpoint_security_group_name = "${var.vpc_name}-vpce-sg"
  flow_logs_log_group_name               = "/aws/vpc/${var.vpc_name}/flow"

  tags = local.tags
}

resource "aws_vpc_endpoint" "execute_api" {
  vpc_id              = module.east_network.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.execute-api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.east_network.intra_subnets
  security_group_ids  = [module.east_network.interface_endpoint_security_group_id]
  private_dns_enabled = true

  tags = merge(local.tags, { Name = "${var.vpc_name}-execute-api-vpce" })
}

resource "aws_ec2_transit_gateway" "east" {
  description                     = "Transit Gateway for us-east-1 staging network"
  amazon_side_asn                 = var.east_tgw_asn
  auto_accept_shared_attachments  = "disable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"
  vpn_ecmp_support                = "enable"

  tags = merge(local.tags, { Name = "${var.environment}-east-tgw" })
}

resource "aws_ec2_transit_gateway_vpc_attachment" "east_vpc" {
  subnet_ids         = module.east_network.intra_subnets
  transit_gateway_id = aws_ec2_transit_gateway.east.id
  vpc_id             = module.east_network.vpc_id

  dns_support  = "enable"
  ipv6_support = "disable"

  tags = merge(local.tags, { Name = "${var.environment}-east-vpc-attachment" })
}

module "lambda_artifacts" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.8.0"

  bucket = "${var.environment}-${data.aws_caller_identity.current.account_id}-east-lambda-artifacts"

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  versioning = {
    status = "Enabled"
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
      bucket_key_enabled = true
    }
  }

  attach_deny_insecure_transport_policy = true

  tags = merge(local.tags, { purpose = "lambda-artifacts" })
}
