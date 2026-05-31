variable "aws_region" {
  type    = string
  default = "us-east-2"
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

variable "east_2_network_state_path" {
  type    = string
  default = "../05-east-2-network/terraform.tfstate"
}

variable "east_2_datastores_state_path" {
  type    = string
  default = "../05-east-2-datastores/terraform.tfstate"
}
