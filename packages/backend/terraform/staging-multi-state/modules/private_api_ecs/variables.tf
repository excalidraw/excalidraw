variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "execute_api_vpce_id" {
  type = string
}

variable "execute_api_vpce_sg_id" {
  type    = string
  default = ""
}

variable "stage_name" {
  type    = string
  default = "v1"
}

variable "launch_type" {
  type = string

  validation {
    condition     = contains(["FARGATE", "EC2"], var.launch_type)
    error_message = "launch_type must be FARGATE or EC2."
  }
}

variable "container_image" {
  type    = string
  default = "public.ecr.aws/docker/library/python:3.12-slim"
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "desired_count" {
  type    = number
  default = 2
}

variable "dynamodb_table_arn" {
  type    = string
  default = ""
}

variable "s3_bucket_arns" {
  type    = list(string)
  default = []
}

variable "db_secret_arn" {
  type    = string
  default = ""
}

variable "additional_db_secret_arns" {
  type    = list(string)
  default = []
}

variable "downstream_api_urls" {
  type    = map(string)
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
