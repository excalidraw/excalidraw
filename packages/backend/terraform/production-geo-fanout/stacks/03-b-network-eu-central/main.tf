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
  stack_name                = "03-b-network-eu-central"
  terraform_deploy_role_arn = trimspace(var.terraform_deploy_role_arn) != "" ? trimspace(var.terraform_deploy_role_arn) : "arn:aws:iam::${var.aws_account_id}:role/${var.terraform_deploy_role_name}"

  tags = {
    environment = var.environment
    stack       = "production-geo-fanout"
    state       = local.stack_name
    managed_by  = "terraform"
    account     = "b"
  }
}

provider "aws" {
  alias   = "eu_central"
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-prod-geo-${local.stack_name}-central"
  }

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias   = "eu_west"
  region  = var.peer_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-prod-geo-${local.stack_name}-west"
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

data "terraform_remote_state" "eu_west_network" {
  backend = "local"
  config = {
    path = var.eu_west_network_state_path
  }
}

module "network" {
  source = "../../modules/regional_network"

  providers = {
    aws = aws.eu_central
  }

  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = data.terraform_remote_state.eu_west_network.outputs.aws_account_id

  vpc_name             = "prod-b-eu-central"
  vpc_cidr             = "10.71.0.0/16"
  public_subnet_cidrs  = ["10.71.0.0/24", "10.71.1.0/24"]
  private_subnet_cidrs = ["10.71.10.0/24", "10.71.11.0/24"]
  intra_subnet_cidrs   = ["10.71.20.0/24", "10.71.21.0/24"]
  single_nat_gateway   = var.single_nat_gateway

  transit_gateway_asn           = 64515
  configure_api_gateway_account = false
  tags                          = local.tags
}

resource "aws_ec2_transit_gateway_peering_attachment" "central_to_west" {
  provider = aws.eu_central

  peer_account_id         = data.terraform_remote_state.eu_west_network.outputs.aws_account_id
  peer_region             = var.peer_region
  peer_transit_gateway_id = data.terraform_remote_state.eu_west_network.outputs.transit_gateway_id
  transit_gateway_id      = module.network.transit_gateway_id

  tags = merge(local.tags, { Name = "${var.environment}-b-central-west-peering" })
}

resource "aws_ec2_transit_gateway_peering_attachment_accepter" "west_accept" {
  provider = aws.eu_west

  transit_gateway_attachment_id = aws_ec2_transit_gateway_peering_attachment.central_to_west.id

  tags = merge(local.tags, { Name = "${var.environment}-b-west-central-peering-accept" })
}

resource "aws_ec2_transit_gateway_route" "central_to_west" {
  provider = aws.eu_central

  destination_cidr_block         = data.terraform_remote_state.eu_west_network.outputs.vpc_cidr
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.central_to_west.id
  transit_gateway_route_table_id = module.network.transit_gateway_default_route_table_id
}

resource "aws_ec2_transit_gateway_route" "west_to_central" {
  provider = aws.eu_west

  destination_cidr_block         = module.network.vpc_cidr
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.central_to_west.id
  transit_gateway_route_table_id = data.terraform_remote_state.eu_west_network.outputs.transit_gateway_default_route_table_id
}

resource "aws_route" "central_private_to_tgw" {
  provider = aws.eu_central

  route_table_id         = module.network.private_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.eu_west_network.outputs.vpc_cidr
  transit_gateway_id     = module.network.transit_gateway_id
}

resource "aws_route" "central_intra_to_tgw" {
  provider = aws.eu_central

  route_table_id         = module.network.intra_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.eu_west_network.outputs.vpc_cidr
  transit_gateway_id     = module.network.transit_gateway_id
}

resource "aws_route" "west_private_to_tgw" {
  provider = aws.eu_west
  for_each = toset(data.terraform_remote_state.eu_west_network.outputs.private_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.network.vpc_cidr
  transit_gateway_id     = data.terraform_remote_state.eu_west_network.outputs.transit_gateway_id
}

resource "aws_route" "west_intra_to_tgw" {
  provider = aws.eu_west
  for_each = toset(data.terraform_remote_state.eu_west_network.outputs.intra_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.network.vpc_cidr
  transit_gateway_id     = data.terraform_remote_state.eu_west_network.outputs.transit_gateway_id
}
