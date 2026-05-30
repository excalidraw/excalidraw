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

variable "cross_account_invoker_role_arns" {
  type        = list(string)
  default     = []
  description = "IAM role ARNs allowed to invoke this private API cross-account (e.g. consumer Lambda role in another account)."
}
