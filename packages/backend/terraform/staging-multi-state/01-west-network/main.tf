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
    state       = "01-west-network"
    managed_by  = "terraform"
  }
}

provider "aws" {
  alias   = "west"
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-west-network"
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
    session_name = "terraform-staging-west-network-east"
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

module "west_network" {
  source = "../../modules/private_workload_network"

  providers = {
    aws = aws.west
  }

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

resource "aws_ec2_transit_gateway" "west" {
  provider = aws.west

  description                     = "Transit Gateway for us-west-2 staging network"
  amazon_side_asn                 = var.west_tgw_asn
  auto_accept_shared_attachments  = "disable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"
  vpn_ecmp_support                = "enable"

  tags = merge(local.tags, { Name = "${var.environment}-west-tgw" })
}

resource "aws_ec2_transit_gateway_vpc_attachment" "west_vpc" {
  provider = aws.west

  subnet_ids         = module.west_network.intra_subnets
  transit_gateway_id = aws_ec2_transit_gateway.west.id
  vpc_id             = module.west_network.vpc_id

  dns_support  = "enable"
  ipv6_support = "disable"

  tags = merge(local.tags, { Name = "${var.environment}-west-vpc-attachment" })
}

resource "aws_ec2_transit_gateway_peering_attachment" "west_to_east" {
  provider = aws.west

  peer_account_id         = data.terraform_remote_state.east_network.outputs.aws_account_id
  peer_region             = var.east_region
  peer_transit_gateway_id = data.terraform_remote_state.east_network.outputs.east_tgw_id
  transit_gateway_id      = aws_ec2_transit_gateway.west.id

  tags = merge(local.tags, { Name = "${var.environment}-west-east-peering" })
}

resource "aws_ec2_transit_gateway_peering_attachment_accepter" "east_accept" {
  provider = aws.east

  transit_gateway_attachment_id = aws_ec2_transit_gateway_peering_attachment.west_to_east.id

  tags = merge(local.tags, { Name = "${var.environment}-east-west-peering-accept" })
}

resource "aws_ec2_transit_gateway_route" "west_to_east" {
  provider = aws.west

  destination_cidr_block         = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.west_to_east.id
  transit_gateway_route_table_id = aws_ec2_transit_gateway.west.association_default_route_table_id
}

resource "aws_ec2_transit_gateway_route" "east_to_west" {
  provider = aws.east

  destination_cidr_block         = module.west_network.vpc_cidr_block
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.west_to_east.id
  transit_gateway_route_table_id = data.terraform_remote_state.east_network.outputs.east_tgw_default_route_table_id
}

resource "aws_route" "west_private_to_tgw" {
  provider = aws.west
  for_each = toset(module.west_network.private_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.west.id
}

resource "aws_route" "west_intra_to_tgw" {
  provider = aws.west
  for_each = toset(module.west_network.intra_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.west.id
}

resource "aws_route" "east_private_to_tgw" {
  provider = aws.east
  for_each = toset(data.terraform_remote_state.east_network.outputs.private_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.west_network.vpc_cidr_block
  transit_gateway_id     = data.terraform_remote_state.east_network.outputs.east_tgw_id
}

resource "aws_route" "east_intra_to_tgw" {
  provider = aws.east
  for_each = toset(data.terraform_remote_state.east_network.outputs.intra_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.west_network.vpc_cidr_block
  transit_gateway_id     = data.terraform_remote_state.east_network.outputs.east_tgw_id
}
