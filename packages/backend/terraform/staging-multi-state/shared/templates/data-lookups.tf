# Reference patterns for cross-stack lookups without terraform_remote_state.
# Copy relevant blocks into API / datastore stacks; do not apply this file directly.

# ---------------------------------------------------------------------------
# Contract module — single source of naming truth
# ---------------------------------------------------------------------------
#
# module "contract" {
#   source = "../shared/contract"
#
#   environment    = var.environment
#   aws_account_id = var.aws_account_id
# }
#
# module.contract.vpc_names.west_1      # => "staging-west-1"
# module.contract.api_gateway_names["api-14"]  # => "staging-api-14"
# module.contract.all_peer_cidrs          # => ["10.60.0.0/16", ...]

# ---------------------------------------------------------------------------
# VPC by contract Name tag (preferred over remote_state for vpc_id / cidr)
# ---------------------------------------------------------------------------
#
# data "aws_vpc" "west_1" {
#   filter {
#     name   = "tag:Name"
#     values = [module.contract.vpc_names.west_1]
#   }
# }

# ---------------------------------------------------------------------------
# Execute-api VPC endpoint in a regional VPC
# ---------------------------------------------------------------------------
#
# data "aws_vpc_endpoint" "execute_api" {
#   vpc_id       = data.aws_vpc.west_1.id
#   service_name = "com.amazonaws.${module.contract.regions.west_1}.execute-api"
#
#   filter {
#     name   = "tag:Name"
#     values = ["${module.contract.vpc_names.west_1}-execute-api-vpce"]
#   }
# }

# ---------------------------------------------------------------------------
# Private REST API by contract gateway name
# ---------------------------------------------------------------------------
#
# data "aws_api_gateway_rest_api" "api14" {
#   name = module.contract.api_gateway_names["api-14"]
# }

# ---------------------------------------------------------------------------
# Downstream invoke URL via shared template (same shape as module outputs)
# ---------------------------------------------------------------------------
#
# locals {
#   api14_invoke_url = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
#     api_id  = data.aws_api_gateway_rest_api.api14.id
#     vpce_id = data.aws_vpc_endpoint.execute_api.id
#     region  = module.contract.regions.west_1
#     stage   = module.contract.api_stage_name
#   })
# }

# ---------------------------------------------------------------------------
# Hub TGW IDs — remote_state until tags are standardized on TGW resources
# ---------------------------------------------------------------------------
#
# data "terraform_remote_state" "east_network" {
#   backend = "local"
#   config = {
#     path = var.east_network_state_path
#   }
# }
#
# data.terraform_remote_state.east_network.outputs.east_tgw_id

# ---------------------------------------------------------------------------
# Example: wire downstream_api_urls in a Lambda API stack
# ---------------------------------------------------------------------------
#
# module "api" {
#   source = "../modules/private_api_lambda"
#   # ...
#   downstream_api_urls = {
#     api14 = local.api14_invoke_url
#   }
# }
