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

variable "artifact_bucket_id" {
  type = string
}

variable "lambda_source_file" {
  type = string
}

variable "openapi_template_path" {
  type = string
}

variable "stage_name" {
  type    = string
  default = "v1"
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
