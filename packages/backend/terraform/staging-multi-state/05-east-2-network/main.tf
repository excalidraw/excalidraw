terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.13"
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
    state       = "05-east-2-network"
    managed_by  = "terraform"
  }

  peer_cidrs = [
    module.contract.vpc_cidrs.east,
    module.contract.vpc_cidrs.west,
    module.contract.vpc_cidrs.west_1,
  ]
}

provider "aws" {
  alias   = "east_2"
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-2-network"
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
    session_name = "terraform-staging-east-2-network-east"
  }

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias   = "west"
  region  = var.west_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-2-network-west"
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

data "terraform_remote_state" "west_network" {
  backend = "local"
  config = {
    path = var.west_network_state_path
  }
}

data "aws_caller_identity" "current" {
  provider = aws.east_2
}

module "east_2_network" {
  source = "../../modules/private_workload_network"

  providers = {
    aws = aws.east_2
  }

  vpc_name              = var.vpc_name
  vpc_cidr              = var.vpc_cidr
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  intra_subnet_cidrs    = var.intra_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  single_nat_gateway    = var.single_nat_gateway

  interface_endpoint_security_group_name = "${var.vpc_name}-vpce-sg"
  flow_logs_log_group_name               = "/aws/vpc/${var.vpc_name}/flow"

  tags = local.tags
}

resource "aws_vpc_endpoint" "execute_api" {
  provider = aws.east_2

  vpc_id              = module.east_2_network.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.execute-api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.east_2_network.intra_subnets
  security_group_ids  = [module.east_2_network.interface_endpoint_security_group_id]
  private_dns_enabled = true

  tags = merge(local.tags, { Name = "${var.vpc_name}-execute-api-vpce" })
}

module "lambda_artifacts" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.8.0"

  providers = {
    aws = aws.east_2
  }

  bucket = module.contract.lambda_artifacts_bucket_names.east_2

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

data "aws_iam_policy_document" "apigw_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apigw_cloudwatch" {
  provider = aws.east_2

  name               = module.contract.apigw_cloudwatch_role_names.east_2
  assume_role_policy = data.aws_iam_policy_document.apigw_assume.json
}

resource "aws_iam_role_policy_attachment" "apigw_cloudwatch" {
  provider = aws.east_2

  role       = aws_iam_role.apigw_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "east_2" {
  provider = aws.east_2

  cloudwatch_role_arn = aws_iam_role.apigw_cloudwatch.arn

  depends_on = [aws_iam_role_policy_attachment.apigw_cloudwatch]
}

resource "aws_ec2_transit_gateway" "east_2" {
  provider = aws.east_2

  description                     = "Transit Gateway for us-east-2 staging network"
  amazon_side_asn                 = var.east_2_tgw_asn
  auto_accept_shared_attachments  = "disable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"
  vpn_ecmp_support                = "enable"

  tags = merge(local.tags, { Name = module.contract.tgw_names.east_2 })
}

resource "aws_ec2_transit_gateway_vpc_attachment" "east_2_vpc" {
  provider = aws.east_2

  subnet_ids         = module.east_2_network.intra_subnets
  transit_gateway_id = aws_ec2_transit_gateway.east_2.id
  vpc_id             = module.east_2_network.vpc_id

  dns_support  = "enable"
  ipv6_support = "disable"

  tags = merge(local.tags, { Name = "${var.environment}-east-2-vpc-attachment" })
}

# --- TGW peering mesh: east-2 <-> east hub (00) ---

resource "aws_ec2_transit_gateway_peering_attachment" "east_2_to_east" {
  provider = aws.east_2

  peer_account_id         = data.terraform_remote_state.east_network.outputs.aws_account_id
  peer_region             = var.east_region
  peer_transit_gateway_id = data.terraform_remote_state.east_network.outputs.east_tgw_id
  transit_gateway_id      = aws_ec2_transit_gateway.east_2.id

  tags = merge(local.tags, { Name = "${var.environment}-east-2-east-peering" })
}

resource "aws_ec2_transit_gateway_peering_attachment_accepter" "east_accept_east_2" {
  provider = aws.east

  transit_gateway_attachment_id = aws_ec2_transit_gateway_peering_attachment.east_2_to_east.id

  tags = merge(local.tags, { Name = "${var.environment}-east-east-2-peering-accept" })
}

# --- TGW peering mesh: east-2 <-> west hub (01) ---

resource "aws_ec2_transit_gateway_peering_attachment" "east_2_to_west" {
  provider = aws.east_2

  peer_account_id         = data.terraform_remote_state.west_network.outputs.aws_account_id
  peer_region             = var.west_region
  peer_transit_gateway_id = data.terraform_remote_state.west_network.outputs.west_tgw_id
  transit_gateway_id      = aws_ec2_transit_gateway.east_2.id

  tags = merge(local.tags, { Name = "${var.environment}-east-2-west-peering" })
}

resource "aws_ec2_transit_gateway_peering_attachment_accepter" "west_accept_east_2" {
  provider = aws.west

  transit_gateway_attachment_id = aws_ec2_transit_gateway_peering_attachment.east_2_to_west.id

  tags = merge(local.tags, { Name = "${var.environment}-west-east-2-peering-accept" })
}

resource "time_sleep" "wait_for_tgw_peering" {
  depends_on = [
    aws_ec2_transit_gateway_peering_attachment_accepter.east_accept_east_2,
    aws_ec2_transit_gateway_peering_attachment_accepter.west_accept_east_2,
  ]

  create_duration = "45s"
}

data "aws_ec2_transit_gateway_route_table" "west_default" {
  provider = aws.west

  filter {
    name   = "transit-gateway-id"
    values = [data.terraform_remote_state.west_network.outputs.west_tgw_id]
  }

  filter {
    name   = "default-association-route-table"
    values = ["true"]
  }
}

# --- TGW routes on east-2 TGW toward peer hubs ---

resource "aws_ec2_transit_gateway_route" "east_2_to_east" {
  provider = aws.east_2

  destination_cidr_block         = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.east_2_to_east.id
  transit_gateway_route_table_id = aws_ec2_transit_gateway.east_2.association_default_route_table_id

  depends_on = [time_sleep.wait_for_tgw_peering]
}

resource "aws_ec2_transit_gateway_route" "east_2_to_west" {
  provider = aws.east_2

  destination_cidr_block         = data.terraform_remote_state.west_network.outputs.vpc_cidr
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.east_2_to_west.id
  transit_gateway_route_table_id = aws_ec2_transit_gateway.east_2.association_default_route_table_id

  depends_on = [time_sleep.wait_for_tgw_peering]
}

# --- TGW routes on peer TGWs back to east-2 ---

resource "aws_ec2_transit_gateway_route" "east_to_east_2" {
  provider = aws.east

  destination_cidr_block         = module.east_2_network.vpc_cidr_block
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.east_2_to_east.id
  transit_gateway_route_table_id = data.terraform_remote_state.east_network.outputs.east_tgw_default_route_table_id

  depends_on = [time_sleep.wait_for_tgw_peering]
}

resource "aws_ec2_transit_gateway_route" "west_to_east_2" {
  provider = aws.west

  destination_cidr_block         = module.east_2_network.vpc_cidr_block
  transit_gateway_attachment_id  = aws_ec2_transit_gateway_peering_attachment.east_2_to_west.id
  transit_gateway_route_table_id = data.aws_ec2_transit_gateway_route_table.west_default.id

  depends_on = [time_sleep.wait_for_tgw_peering]
}

# --- VPC routes: east-2 local tiers to peer CIDRs (10.60, 10.70; 10.80 via 04 peering) ---

resource "aws_route" "east_2_private_to_east" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.private_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_private_to_west" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.private_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.west_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_private_to_west_1" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.private_route_table_ids[0]
  destination_cidr_block = module.contract.vpc_cidrs.west_1
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_intra_to_east" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.intra_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_intra_to_west" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.intra_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.west_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_intra_to_west_1" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.intra_route_table_ids[0]
  destination_cidr_block = module.contract.vpc_cidrs.west_1
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_db_to_east" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.database_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.east_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_db_to_west" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.database_route_table_ids[0]
  destination_cidr_block = data.terraform_remote_state.west_network.outputs.vpc_cidr
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

resource "aws_route" "east_2_db_to_west_1" {
  provider = aws.east_2

  route_table_id         = module.east_2_network.database_route_table_ids[0]
  destination_cidr_block = module.contract.vpc_cidrs.west_1
  transit_gateway_id     = aws_ec2_transit_gateway.east_2.id
}

# --- VPC routes on east hub (00) toward east-2 ---

resource "aws_route" "east_private_to_east_2" {
  provider = aws.east
  for_each = toset(data.terraform_remote_state.east_network.outputs.private_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.east_2_network.vpc_cidr_block
  transit_gateway_id     = data.terraform_remote_state.east_network.outputs.east_tgw_id
}

resource "aws_route" "east_intra_to_east_2" {
  provider = aws.east
  for_each = toset(data.terraform_remote_state.east_network.outputs.intra_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.east_2_network.vpc_cidr_block
  transit_gateway_id     = data.terraform_remote_state.east_network.outputs.east_tgw_id
}

resource "aws_route" "east_db_to_east_2" {
  provider = aws.east
  for_each = toset(data.terraform_remote_state.east_network.outputs.database_route_table_ids)

  route_table_id         = each.value
  destination_cidr_block = module.east_2_network.vpc_cidr_block
  transit_gateway_id     = data.terraform_remote_state.east_network.outputs.east_tgw_id
}

# --- VPC routes on west hub (01) toward east-2 ---

data "aws_vpc" "west_hub" {
  provider = aws.west

  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.west]
  }
}

data "aws_route_tables" "west_hub" {
  provider = aws.west
  vpc_id   = data.aws_vpc.west_hub.id
}

resource "aws_route" "west_hub_to_east_2" {
  provider = aws.west
  for_each = toset(data.aws_route_tables.west_hub.ids)

  route_table_id         = each.value
  destination_cidr_block = module.east_2_network.vpc_cidr_block
  transit_gateway_id     = data.terraform_remote_state.west_network.outputs.west_tgw_id
}
