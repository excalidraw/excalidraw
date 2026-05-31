variable "aws_region" {
  type    = string
  default = "us-west-1"
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
  default = ""
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "west_1_network_state_path" {
  type    = string
  default = "../04-west-1-network/terraform.tfstate"
}

variable "west_1_datastores_state_path" {
  type    = string
  default = "../04-west-1-datastores/terraform.tfstate"
}
