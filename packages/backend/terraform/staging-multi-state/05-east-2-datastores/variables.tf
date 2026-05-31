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

variable "peer_vpc_cidrs" {
  type = list(string)
  default = [
    "10.60.0.0/16",
    "10.70.0.0/16",
    "10.80.0.0/16",
  ]
}
