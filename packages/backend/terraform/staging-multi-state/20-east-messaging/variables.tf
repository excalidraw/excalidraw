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
  default = ""
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "east_network_state_path" {
  type    = string
  default = "../00-east-network/terraform.tfstate"
}

variable "ecs_state_path" {
  type    = string
  default = "../10-east-ecs-edge/terraform.tfstate"
}

variable "api_state_paths" {
  type = map(string)
  default = {
    api1 = "../40-east-api-1/terraform.tfstate"
    api2 = "../41-east-api-2/terraform.tfstate"
    api3 = "../42-east-api-3/terraform.tfstate"
    api4 = "../43-east-api-4/terraform.tfstate"
    api5 = "../44-east-api-5/terraform.tfstate"
  }
}
