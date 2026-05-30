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
  stack_name                = "01-a-network-west"
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
  alias   = "west"
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-prod-geo-${local.stack_name}-west"
  }

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias   = "east"
  region  = var.peer_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-prod-geo-${local.stack_name}-east"
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

module "network" {
  source = "../../modules/regional_network"

  providers = {
    aws = aws.west
  }

  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = data.terraform_remote_state.east_network.outputs.aws_account_id

  vpc_name             = "prod-a-west"
  vpc_cidr             = "10.61.0.0/16"
  public_subnet_cidrs  = ["10.61.0.0/24", "10.61.1.0/24"]
  private_subnet_cidrs = ["10.61.10.0/24", "10.61.11.0/24"]
  intra_subnet_cidrs   = ["10.61.20.0/24", "10.61.21.0/24"]
  single_nat_gateway   = var.single_nat_gateway

  transit_gateway_asn              = 64513
  configure_api_gateway_account    = false
  tags                             = local.tags
}

resource "aws_ec2_transit_gateway_peering_attachment" "west_to_east" {
  provider = aws.west

  peer_account_id         = data.terraform_remote_state.east_network.outputs.aws_account_id
  peer_region             = var.peer_region
  peer_transit_gateway_id = data.terraform_remote_state.east_network.outputs.transit_gateway_id
  transit_gateway_id      = module.network.transit_gateway_id

  tags = merge(local.tags, { Name = "${var.environment}-a-west-east-peering" })
}

resource "aws_ec2_transit_gateway_peering_attachment_accepter" "east_accept" {
  provider = aws.east

  transit_gateway_attachment_id = aws_ec2_transit_gateway_peering_attachment.west_to_east.id

  tags = merge(local.tags, { Name = "${var.environment}-a-east-west-peering-accept" })
}

resource "aws_ec2_transit_gateway_route" "west_to_east" {
  provider = aws.west

  destination_cidr_block         = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.west_to_east.id
  transit_gateway_route_table_id = module.network.transit_gateway_default_route_table_id
}

resource "aws_ec2_transit_gateway_route" "east_to_west" {
  provider = aws.east

  destination_cidr_block         = module.network.vpc_cidr
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.west_to_east.id
  transit_gateway_route_table_id = data.terraform_remote_state.east_network.outputs.transit_gateway_default_route_table_id
}

resource "aws_route" "west_private_to_tgw" {
  provider = aws.west

  route_table_id         = module.network.private_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_id     = module.network.transit_gateway_id
}

resource "aws_route" "west_intra_to_tgw" {
  provider = aws.west

  route_table_id         = module.network.intra_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_id     = module.network.transit_gateway_id
}

resource "aws_route" "east_private_to_tgw" {
  provider = aws.east
  for_each = toset(data.terraform_remote_state.east_network.outputs.private_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.network.vpc_cidr
  transit_gateway_id     = data.terraform_remote_state.east_network.outputs.transit_gateway_id
}

resource "aws_route" "east_intra_to_tgw" {
  provider = aws.east
  for_each = toset(data.terraform_remote_state.east_network.outputs.intra_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.network.vpc_cidr
  transit_gateway_id     = data.terraform_remote_state.east_network.outputs.transit_gateway_id
}
