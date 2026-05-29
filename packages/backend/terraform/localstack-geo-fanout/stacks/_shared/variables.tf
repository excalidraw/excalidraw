# Shared stack variables for localstack-geo-fanout stacks.

variable "environment" {
  type    = string
  default = "local"
}

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "localstack_port" {
  type    = number
  default = 4566
}
