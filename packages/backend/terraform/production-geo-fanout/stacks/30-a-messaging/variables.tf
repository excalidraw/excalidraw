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
  default = "production"
}

variable "east_network_state_path" {
  type    = string
  default = "../00-a-network-east/terraform.tfstate"
}

variable "west_network_state_path" {
  type    = string
  default = "../01-a-network-west/terraform.tfstate"
}

variable "eu_west_network_state_path" {
  type    = string
  default = "../02-b-network-eu-west/terraform.tfstate"
}

variable "eu_central_network_state_path" {
  type    = string
  default = "../03-b-network-eu-central/terraform.tfstate"
}

variable "api_state_paths" {
  type = map(string)
  default = {
    api1 = "../10-a-api-1/terraform.tfstate"
    api2 = "../11-a-api-2/terraform.tfstate"
    api3 = "../12-a-api-3/terraform.tfstate"
    api4 = "../20-b-api-4/terraform.tfstate"
    api5 = "../21-b-api-5/terraform.tfstate"
    api6 = "../22-b-api-6/terraform.tfstate"
  }
}

variable "enable_schedule" {
  type        = bool
  default     = false
  description = "Enable EventBridge schedule to enqueue fanout messages (optional ingress path)."
}

variable "schedule_expression" {
  type    = string
  default = "rate(5 minutes)"
}
