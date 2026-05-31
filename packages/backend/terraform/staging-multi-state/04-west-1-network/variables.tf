variable "aws_region" {
  type    = string
  default = "us-west-1"
}

variable "east_region" {
  type    = string
  default = "us-east-1"
}

variable "west_region" {
  type    = string
  default = "us-west-2"
}

variable "east_2_region" {
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

variable "east_network_state_path" {
  type    = string
  default = "../00-east-network/terraform.tfstate"
}

variable "west_network_state_path" {
  type    = string
  default = "../01-west-network/terraform.tfstate"
}

variable "east_2_network_state_path" {
  type    = string
  default = "../05-east-2-network/terraform.tfstate"
}

variable "vpc_name" {
  type    = string
  default = "staging-west-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.80.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.80.0.0/24", "10.80.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.80.10.0/24", "10.80.11.0/24"]
}

variable "intra_subnet_cidrs" {
  type    = list(string)
  default = ["10.80.20.0/24", "10.80.21.0/24"]
}

variable "database_subnet_cidrs" {
  type    = list(string)
  default = ["10.80.30.0/24", "10.80.31.0/24"]
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "west_1_tgw_asn" {
  type    = number
  default = 64514
}

variable "peer_cidrs" {
  type = list(string)
  default = [
    "10.60.0.0/16",
    "10.70.0.0/16",
    "10.65.0.0/16",
  ]
}
