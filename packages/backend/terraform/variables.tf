variable "aws_region" {
  type        = string
  description = "AWS region for the default provider."
  default     = "us-east-1"
}

variable "aws_profile" {
  type        = string
  description = "Named AWS CLI profile for base credentials (must be allowed to sts:AssumeRole on the deploy role when assume is enabled)."
  default     = "admin"
}

variable "terraform_deploy_role_name" {
  type        = string
  description = "IAM role name in the target account for Terraform to assume."
  default     = "TerraformDeploy"
}

variable "terraform_deploy_role_arn" {
  type        = string
  description = "Full ARN of the role to assume. If non-empty, overrides aws_account_id + terraform_deploy_role_name."
  default     = ""
}

variable "aws_account_id" {
  type        = string
  description = "12-digit AWS account ID that hosts terraform_deploy_role_name. Ignored when terraform_deploy_role_arn is set."
  default     = ""
}
