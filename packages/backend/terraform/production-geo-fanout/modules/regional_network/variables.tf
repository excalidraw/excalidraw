variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "vpc_name" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "public_subnet_cidrs" {
  type = list(string)
}

variable "private_subnet_cidrs" {
  type = list(string)
}

variable "intra_subnet_cidrs" {
  type = list(string)
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "create_transit_gateway" {
  type    = bool
  default = true
}

variable "transit_gateway_asn" {
  type    = number
  default = 64512
}

variable "configure_api_gateway_account" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
