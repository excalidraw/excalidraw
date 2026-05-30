terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, length(var.intra_subnet_cidrs))
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.5.0"

  name = var.vpc_name
  cidr = var.vpc_cidr

  azs             = local.azs
  public_subnets   = var.public_subnet_cidrs
  private_subnets  = var.private_subnet_cidrs
  intra_subnets    = var.intra_subnet_cidrs
  database_subnets = var.database_subnet_cidrs

  create_database_subnet_route_table = true

  enable_nat_gateway   = true
  single_nat_gateway   = var.single_nat_gateway
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = var.tags
}

# Ingress from VPC CIDR (not per-Lambda SGs) so this stack applies before Lambdas exist.
module "interface_endpoint_security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "5.3.0"

  name        = var.interface_endpoint_security_group_name
  description = var.interface_endpoint_security_group_description
  vpc_id      = module.vpc.vpc_id

  tags = var.tags

  ingress_with_cidr_blocks = [
    {
      rule        = "https-443-tcp"
      description = "HTTPS from VPC workloads (interface endpoints)"
      cidr_blocks = var.vpc_cidr
    }
  ]

  egress_with_cidr_blocks = [
    {
      description = "VPC only (stateful SG handles return path)"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = var.vpc_cidr
    },
  ]

  egress_rules = []
}

module "managed_service_endpoints" {
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "6.5.0"

  vpc_id = module.vpc.vpc_id

  tags = var.tags

  endpoints = {
    s3 = {
      service      = "s3"
      service_type = "Gateway"
      route_table_ids = distinct(concat(
        module.vpc.intra_route_table_ids,
        module.vpc.private_route_table_ids,
        module.vpc.database_route_table_ids,
      ))
    }
    dynamodb = {
      service         = "dynamodb"
      service_type    = "Gateway"
      route_table_ids = distinct(concat(
        module.vpc.intra_route_table_ids,
        module.vpc.private_route_table_ids,
        module.vpc.database_route_table_ids,
      ))
    }
    secretsmanager = {
      service             = "secretsmanager"
      subnet_ids          = module.vpc.intra_subnets
      security_group_ids  = [module.interface_endpoint_security_group.security_group_id]
      private_dns_enabled = true
    }
    sqs = {
      service             = "sqs"
      subnet_ids          = module.vpc.intra_subnets
      security_group_ids  = [module.interface_endpoint_security_group.security_group_id]
      private_dns_enabled = true
    }
    logs = {
      service             = "logs"
      subnet_ids          = module.vpc.intra_subnets
      security_group_ids  = [module.interface_endpoint_security_group.security_group_id]
      private_dns_enabled = true
    }
    xray = {
      service             = "xray"
      subnet_ids          = module.vpc.intra_subnets
      security_group_ids  = [module.interface_endpoint_security_group.security_group_id]
      private_dns_enabled = true
    }
  }
}

module "vpc_flow_logs" {
  source = "../vpc_flow_logs"

  name_prefix           = var.vpc_name
  log_group_name        = var.flow_logs_log_group_name
  log_retention_in_days = var.flow_logs_log_retention_in_days
  traffic_type          = var.flow_logs_traffic_type
  vpc_id                = module.vpc.vpc_id

  tags = var.tags
}
