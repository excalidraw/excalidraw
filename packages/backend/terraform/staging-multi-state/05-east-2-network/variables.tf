variable "aws_region" {
  type    = string
  default = "us-east-2"
}

variable "east_region" {
  type    = string
  default = "us-east-1"
}

variable "west_region" {
  type    = string
  default = "us-west-2"
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

variable "west_network_state_path" {
  type    = string
  default = "../01-west-network/terraform.tfstate"
}

variable "vpc_name" {
  type    = string
  default = "staging-east-2"
}

variable "vpc_cidr" {
  type    = string
  default = "10.65.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.65.0.0/24", "10.65.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.65.10.0/24", "10.65.11.0/24"]
}

variable "intra_subnet_cidrs" {
  type    = list(string)
  default = ["10.65.20.0/24", "10.65.21.0/24"]
}

variable "database_subnet_cidrs" {
  type    = list(string)
  default = ["10.65.30.0/24", "10.65.31.0/24"]
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "east_2_tgw_asn" {
  type    = number
  default = 64515
}
