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

variable "vpc_name" {
  type    = string
  default = "staging-east"
}

variable "vpc_cidr" {
  type    = string
  default = "10.60.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.60.0.0/24", "10.60.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.60.10.0/24", "10.60.11.0/24"]
}

variable "intra_subnet_cidrs" {
  type    = list(string)
  default = ["10.60.20.0/24", "10.60.21.0/24"]
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "east_tgw_asn" {
  type    = number
  default = 64512
}
