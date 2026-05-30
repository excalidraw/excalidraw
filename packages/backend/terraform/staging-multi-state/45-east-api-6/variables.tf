variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_profile" {
  type    = string
  default = "admin"
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
  default = "992382747916"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "east_network_state_path" {
  type    = string
  default = "../00-east-network/terraform.tfstate"
}

variable "east_datastores_state_path" {
  type    = string
  default = "../02-east-datastores/terraform.tfstate"
}

variable "west_api8_state_path" {
  type    = string
  default = "../50-west-api-8/terraform.tfstate"
}

variable "west_api9_state_path" {
  type    = string
  default = "../51-west-api-9/terraform.tfstate"
}
