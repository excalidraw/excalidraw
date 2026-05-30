variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "peer_region" {
  type    = string
  default = "eu-west-1"
}

variable "aws_profile" {
  type    = string
  default = "admin-account-b"
}

variable "terraform_deploy_role_name" {
  type    = string
  default = "TerraformDeploy"
}

variable "terraform_deploy_role_arn" {
  type    = string
  default = ""
}

variable "aws_account_id" {
  type    = string
  default = ""
}

variable "environment" {
  type    = string
  default = "production"
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "eu_west_network_state_path" {
  type    = string
  default = "../02-b-network-eu-west/terraform.tfstate"
}
