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
    state       = "45-east-api-6"
    managed_by  = "terraform"
  }

  api8_invoke_url = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
    api_id  = data.aws_api_gateway_rest_api.api8.id
    vpce_id = data.aws_vpc_endpoint.execute_api_west.id
    region  = module.contract.regions.west
    stage   = module.contract.api_stage_name
  })

  api12_invoke_url = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
    api_id  = data.aws_api_gateway_rest_api.api12.id
    vpce_id = data.aws_vpc_endpoint.execute_api_west_1.id
    region  = module.contract.regions.west_1
    stage   = module.contract.api_stage_name
  })

  api15_invoke_url = templatefile("${path.module}/../shared/templates/invoke-url.tftpl", {
    api_id  = data.aws_api_gateway_rest_api.api15.id
    vpce_id = data.aws_vpc_endpoint.execute_api_east_2.id
    region  = module.contract.regions.east_2
    stage   = module.contract.api_stage_name
  })
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-api-6"
  }

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias   = "west"
  region  = module.contract.regions.west
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-api-6-west"
  }

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias   = "west_1"
  region  = module.contract.regions.west_1
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-api-6-west-1"
  }

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias   = "east_2"
  region  = module.contract.regions.east_2
  profile = var.aws_profile

  assume_role {
    role_arn     = local.terraform_deploy_role_arn
    session_name = "terraform-staging-east-api-6-east-2"
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

data "terraform_remote_state" "east_datastores" {
  backend = "local"
  config = {
    path = var.east_datastores_state_path
  }
}

data "aws_vpc" "west" {
  provider = aws.west

  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.west]
  }
}

data "aws_vpc_endpoint" "execute_api_west" {
  provider = aws.west

  vpc_id       = data.aws_vpc.west.id
  service_name = "com.amazonaws.${module.contract.regions.west}.execute-api"

  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.west}-execute-api-vpce"]
  }
}

data "aws_api_gateway_rest_api" "api8" {
  provider = aws.west
  name     = module.contract.api_gateway_names["api-8"]
}

data "aws_vpc" "west_1" {
  provider = aws.west_1

  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.west_1]
  }
}

data "aws_vpc_endpoint" "execute_api_west_1" {
  provider = aws.west_1

  vpc_id       = data.aws_vpc.west_1.id
  service_name = "com.amazonaws.${module.contract.regions.west_1}.execute-api"

  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.west_1}-execute-api-vpce"]
  }
}

data "aws_api_gateway_rest_api" "api12" {
  provider = aws.west_1
  name     = module.contract.api_gateway_names["api-12"]
}

data "aws_vpc" "east_2" {
  provider = aws.east_2

  filter {
    name   = "tag:Name"
    values = [module.contract.vpc_names.east_2]
  }
}

data "aws_vpc_endpoint" "execute_api_east_2" {
  provider = aws.east_2

  vpc_id       = data.aws_vpc.east_2.id
  service_name = "com.amazonaws.${module.contract.regions.east_2}.execute-api"

  filter {
    name   = "tag:Name"
    values = ["${module.contract.vpc_names.east_2}-execute-api-vpce"]
  }
}

data "aws_api_gateway_rest_api" "api15" {
  provider = aws.east_2
  name     = module.contract.api_gateway_names["api-15"]
}

module "api" {
  source = "../modules/private_api_lambda"

  name                = "api-6"
  environment         = var.environment
  aws_region          = var.aws_region
  aws_account_id      = data.terraform_remote_state.east_network.outputs.aws_account_id
  vpc_id              = data.terraform_remote_state.east_network.outputs.vpc_id
  vpc_cidr            = data.terraform_remote_state.east_network.outputs.vpc_cidr
  private_subnet_ids  = data.terraform_remote_state.east_network.outputs.private_subnet_ids
  execute_api_vpce_id = data.terraform_remote_state.east_network.outputs.execute_api_vpce_id

  artifact_bucket_id    = data.terraform_remote_state.east_network.outputs.lambda_artifacts_bucket_id
  lambda_source_file    = "${path.module}/../shared/api_handler.py"
  openapi_template_path = "${path.module}/openapi.tftpl"
  stage_name            = module.contract.api_stage_name
  db_secret_arn         = data.terraform_remote_state.east_datastores.outputs.api6_secret_arn
  downstream_api_urls = {
    api8  = local.api8_invoke_url
    api12 = local.api12_invoke_url
    api15 = local.api15_invoke_url
  }
  tags = local.tags
}
